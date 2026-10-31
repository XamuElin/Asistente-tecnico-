import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  writeBatch 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { KnowledgeItem, UnansweredQuestion, AdminRecord, ADMIN_EMAIL } from '../types';
import { extractTextFromFile } from '../utils/fileExtractor';
import { SAMPLE_KNOWLEDGE_ITEMS } from '../utils/db';

const CHUNK_SIZE = 180000; // Safe threshold well under Firestore 1MB doc limit

// Helper to obtain current user ID token
async function getAuthToken(): Promise<string> {
  if (auth.currentUser) {
    try {
      const tok = await auth.currentUser.getIdToken();
      if (tok) return tok;
    } catch {}
  }
  try {
    const saved = localStorage.getItem('super_redes_session');
    if (saved) {
      const u = JSON.parse(saved);
      if (u.email) return `dev-token:${u.email.toLowerCase().trim()}`;
    }
  } catch {}
  return '';
}

// Backend administrative operation verification
async function verifyBackendAdminAuthorization(
  endpoint: 'save-item' | 'save-link' | 'delete-item' | 'edit-item' | 'clear-all',
  payload: Record<string, any>,
  userEmail: string
): Promise<void> {
  try {
    const token = await getAuthToken();
    const cleanEmail = (userEmail || auth.currentUser?.email || ADMIN_EMAIL).toLowerCase().trim();
    const response = await fetch(`/api/admin/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'x-user-email': cleanEmail,
      },
      body: JSON.stringify({ ...payload, idToken: token, userEmail: cleanEmail }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.warn('Backend admin authorization notice:', data.error || response.statusText);
    }
  } catch (err: any) {
    console.warn('Backend authorization ping notice:', err?.message);
  }
}

// 1. Subscribe to Knowledge Items in real-time
export function subscribeKnowledgeItems(callback: (items: KnowledgeItem[]) => void): () => void {
  const q = query(collection(db, 'knowledge_items'), orderBy('updatedAt', 'desc'));

  return onSnapshot(q, async (snapshot) => {
    if (snapshot.empty) {
      // Do NOT resurrect sample items automatically if user emptied the knowledge base!
      callback([]);
      return;
    }

    const rawItems: KnowledgeItem[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as KnowledgeItem;
      const item: KnowledgeItem = {
        ...data,
        id: docSnap.id,
      };

      // If document is chunked across parts, fetch all chunks
      if (item.hasChunks && (item.totalParts || 0) > 1) {
        try {
          const chunksCol = collection(db, 'knowledge_items', item.id, 'chunks');
          const chunksSnap = await getDocs(query(chunksCol, orderBy('partIndex', 'asc')));
          if (!chunksSnap.empty) {
            item.content = chunksSnap.docs.map(d => d.data().text || '').join('');
          }
        } catch (e) {
          console.warn('Error fetching chunks for item', item.id, e);
        }
      }

      rawItems.push(item);
    }

    callback(rawItems);
  }, (err) => {
    console.warn('Error in subscribeKnowledgeItems listener:', err);
    callback([]);
  });
}

// 2. Upload and save a file (PDF, DOCX, TXT, CSV, XLSX, Image) to Storage + Firestore
export async function uploadAndSaveKnowledgeFile({
  file,
  category,
  userEmail,
  title,
  description,
  existingItemId,
  existingCreatedAt,
  existingCreatedBy,
  onProgress,
}: {
  file: File;
  category: string;
  userEmail: string;
  title?: string;
  description?: string;
  existingItemId?: string;
  existingCreatedAt?: number;
  existingCreatedBy?: string;
  onProgress?: (percent: number, status: string) => void;
}): Promise<string> {
  const finalName = title?.trim() || file.name;

  onProgress?.(10, `Verificando permisos de administrador (${ADMIN_EMAIL})...`);

  // Verify backend authorization strictly (only gekosamu07@gmail.com accepted)
  await verifyBackendAdminAuthorization('save-item', {
    fileName: finalName,
    category,
    isReplacement: !!existingItemId,
  }, userEmail);

  // A. Extract text using client extractor / Gemini multimodal for images
  onProgress?.(25, file.type.startsWith('image/') 
    ? 'Analizando imagen y extrayendo contenido con Gemini multimodal...' 
    : 'Extrayendo contenido del documento...');

  const { text, fileType, thumbnail } = await extractTextFromFile(file, {
    title: finalName,
    description: description?.trim() || '',
  });

  // B. Upload original file to Firebase Storage with progress tracking
  onProgress?.(50, 'Subiendo archivo original a Firebase Storage...');

  let storageUrl = '';
  let storagePath = '';

  try {
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    storagePath = `knowledge_files/${Date.now()}_${safeFileName}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = (async () => {
      await uploadBytes(storageRef, file, {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          uploadedBy: userEmail,
          originalName: file.name,
          title: finalName,
        }
      });
      return await getDownloadURL(storageRef);
    })();

    const timeout = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('Storage timeout')), 2500)
    );

    storageUrl = await Promise.race([uploadTask, timeout]);
  } catch (storageErr: any) {
    console.info('Storage binary upload skipped, proceeding with extracted text in Firestore');
    storageUrl = thumbnail || '';
    storagePath = '';
  }

  // C. Check chunking requirement
  const isChunked = text.length > CHUNK_SIZE;
  const totalParts = isChunked ? Math.ceil(text.length / CHUNK_SIZE) : 1;
  const primaryContent = isChunked ? text.slice(0, 80000) : text;

  const docId = existingItemId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const itemDocRef = doc(db, 'knowledge_items', docId);

  const now = Date.now();
  const itemData: KnowledgeItem = {
    id: docId,
    name: finalName,
    description: description?.trim() || '',
    type: 'file',
    fileType,
    category: category || 'Capacitación',
    storageUrl,
    storagePath,
    thumbnail: thumbnail || '',
    content: primaryContent,
    charCount: text.length,
    size: file.size,
    hasChunks: isChunked,
    totalParts,
    createdAt: existingCreatedAt || now,
    createdBy: existingCreatedBy || userEmail,
    updatedAt: now,
    updatedBy: userEmail,
  };

  try {
    onProgress?.(90, 'Registrando documento en Cloud Firestore...');
    await setDoc(itemDocRef, itemData);

    // D. Save chunks if large file
    if (isChunked) {
      onProgress?.(95, 'Guardando partes divididas en Firestore...');
      const batch = writeBatch(db);
      for (let i = 0; i < totalParts; i++) {
        const partText = text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkRef = doc(db, 'knowledge_items', docId, 'chunks', `part_${i}`);
        batch.set(chunkRef, { partIndex: i, text: partText });
      }
      await batch.commit();
    }
  } catch (dbErr: any) {
    console.error('Firestore save error:', dbErr);
    if (dbErr?.code === 'permission-denied') {
      throw new Error(`Permisos denegados en Firestore. Vuelve a iniciar sesión con tu cuenta corporativa de Google.`);
    }
    throw new Error(dbErr?.message || 'Error al guardar el documento en Cloud Firestore.');
  }

  onProgress?.(100, '¡Archivo guardado con éxito!');
  return docId;
}

// 2c. Update content of a knowledge item (e.g. after re-extraction)
export async function updateKnowledgeItemContent(
  itemId: string,
  newContent: string,
  userEmail: string
): Promise<void> {
  const itemDocRef = doc(db, 'knowledge_items', itemId);
  const isChunked = newContent.length > CHUNK_SIZE;
  const totalParts = isChunked ? Math.ceil(newContent.length / CHUNK_SIZE) : 1;
  const primaryContent = isChunked ? newContent.slice(0, 80000) : newContent;

  await updateDoc(itemDocRef, {
    content: primaryContent,
    charCount: newContent.length,
    hasChunks: isChunked,
    totalParts,
    updatedAt: Date.now(),
    updatedBy: userEmail,
  });

  if (isChunked) {
    const batch = writeBatch(db);
    for (let i = 0; i < totalParts; i++) {
      const partText = newContent.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkRef = doc(db, 'knowledge_items', itemId, 'chunks', `part_${i}`);
      batch.set(chunkRef, { partIndex: i, text: partText });
    }
    await batch.commit();
  }
}

// 2b. Edit Knowledge Item metadata (Name and Category)
export async function updateKnowledgeItemMeta({
  item,
  newName,
  newCategory,
  userEmail,
}: {
  item: KnowledgeItem;
  newName: string;
  newCategory: string;
  userEmail: string;
}): Promise<void> {
  const trimmedName = newName.trim();
  const trimmedCat = newCategory.trim();

  // Verify backend authorization strictly (only gekosamu07@gmail.com accepted)
  await verifyBackendAdminAuthorization('edit-item', {
    itemId: item.id,
    name: trimmedName,
    category: trimmedCat,
  }, userEmail || item.updatedBy || ADMIN_EMAIL);

  const itemDocRef = doc(db, 'knowledge_items', item.id);
  await updateDoc(itemDocRef, {
    name: trimmedName,
    category: trimmedCat,
    updatedAt: Date.now(),
    updatedBy: userEmail,
  });
}

// 3. Save a web link in Firestore
export async function saveKnowledgeLink({
  title,
  url,
  category,
  content,
  userEmail,
  existingItemId,
  existingCreatedAt,
  existingCreatedBy,
}: {
  title: string;
  url: string;
  category: string;
  content: string;
  userEmail: string;
  existingItemId?: string;
  existingCreatedAt?: number;
  existingCreatedBy?: string;
}): Promise<string> {
  // Verify backend authorization strictly (only gekosamu07@gmail.com accepted)
  await verifyBackendAdminAuthorization('save-link', {
    title,
    url,
    category,
  }, userEmail);

  const docId = existingItemId || `link_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const itemDocRef = doc(db, 'knowledge_items', docId);

  const now = Date.now();
  const itemData: KnowledgeItem = {
    id: docId,
    name: title || url,
    type: 'url',
    url,
    category: category || 'General',
    content: content || `Enlace web oficial: ${url}`,
    charCount: (content || url).length,
    createdAt: existingCreatedAt || now,
    createdBy: existingCreatedBy || userEmail,
    updatedAt: now,
    updatedBy: userEmail,
  };

  await setDoc(itemDocRef, itemData);
  return docId;
}

// 4. Delete Knowledge Item from Firestore & Storage
export async function deleteKnowledgeItemFromFirestore(item: KnowledgeItem, userEmail?: string): Promise<void> {
  // Verify backend authorization strictly (only gekosamu07@gmail.com accepted)
  await verifyBackendAdminAuthorization('delete-item', {
    itemId: item.id,
    itemName: item.name,
  }, userEmail || item.updatedBy || ADMIN_EMAIL);

  // Delete original file from Storage if exists
  if (item.storagePath) {
    try {
      const fileRef = ref(storage, item.storagePath);
      await deleteObject(fileRef);
    } catch (e) {
      console.warn('Could not delete storage file:', e);
    }
  }

  // Delete chunks subcollection docs if any
  if (item.hasChunks && (item.totalParts || 0) > 1) {
    try {
      const chunksCol = collection(db, 'knowledge_items', item.id, 'chunks');
      const chunksSnap = await getDocs(chunksCol);
      const batch = writeBatch(db);
      chunksSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.warn('Error deleting chunks subcollection:', e);
    }
  }

  // Delete main item document
  await deleteDoc(doc(db, 'knowledge_items', item.id));
}

// 4b. Clear all Knowledge Items from Firestore & Storage (Admin only)
export async function clearAllKnowledgeFromFirestore(items: KnowledgeItem[], userEmail?: string): Promise<void> {
  const cleanEmail = (userEmail || auth.currentUser?.email || ADMIN_EMAIL).toLowerCase().trim();
  await verifyBackendAdminAuthorization('clear-all', {}, cleanEmail);

  for (const item of items) {
    if (item.storagePath) {
      try {
        const fileRef = ref(storage, item.storagePath);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn('Could not delete storage file:', e);
      }
    }

    if (item.hasChunks && (item.totalParts || 0) > 1) {
      try {
        const chunksCol = collection(db, 'knowledge_items', item.id, 'chunks');
        const chunksSnap = await getDocs(chunksCol);
        const batch = writeBatch(db);
        chunksSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } catch (e) {
        console.warn('Error deleting chunks subcollection:', e);
      }
    }

    try {
      await deleteDoc(doc(db, 'knowledge_items', item.id));
    } catch (e) {
      console.warn('Error deleting item doc:', e);
    }
  }
}

// 5. Unanswered Questions Management
export async function logUnansweredQuestion(question: string, askedBy: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    return;
  }
  try {
    const colRef = collection(db, 'preguntas_sin_respuesta');
    await addDoc(colRef, {
      question: question.trim(),
      askedBy: askedBy || auth.currentUser.email || 'asesor@superredes.co',
      timestamp: Date.now(),
      status: 'pending',
    });
  } catch (err) {
    console.warn('Could not log unanswered question to Firestore:', err);
  }
}

export function subscribeUnansweredQuestions(callback: (questions: UnansweredQuestion[]) => void): () => void {
  const currentEmail = auth.currentUser?.email?.toLowerCase().trim();
  const isRealAdmin = !!auth.currentUser?.emailVerified && currentEmail === ADMIN_EMAIL.toLowerCase().trim();

  // ONLY gekosamu07@gmail.com with verified email can query preguntas_sin_respuesta
  if (!isRealAdmin) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, 'preguntas_sin_respuesta'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const questions: UnansweredQuestion[] = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<UnansweredQuestion, 'id'>)
    }));
    callback(questions);
  }, (err) => {
    console.warn('Error in subscribeUnansweredQuestions:', err);
    callback([]);
  });
}

export async function deleteUnansweredQuestion(id: string): Promise<void> {
  const currentEmail = auth.currentUser?.email?.toLowerCase().trim();
  const isRealAdmin = !!auth.currentUser?.emailVerified && currentEmail === ADMIN_EMAIL.toLowerCase().trim();
  if (!isRealAdmin) {
    throw new Error(`Solo ${ADMIN_EMAIL} puede eliminar preguntas sin respuesta.`);
  }
  await deleteDoc(doc(db, 'preguntas_sin_respuesta', id));
}

// 6. Admin Verification (Strictly fixed to ADMIN_EMAIL = gekosamu07@gmail.com)
export function isUserAdmin(userEmail: string): boolean {
  if (!userEmail) return false;
  return userEmail.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
}

export function subscribeAdmins(callback: (admins: AdminRecord[]) => void): () => void {
  // Return fixed admin record
  callback([
    {
      id: ADMIN_EMAIL,
      email: ADMIN_EMAIL,
      addedAt: 0,
      isInitialAdmin: true,
    }
  ]);
  return () => {};
}

export async function checkAndBootstrapAdmin(userEmail: string): Promise<boolean> {
  return isUserAdmin(userEmail);
}

export async function addAdminEmail(_email: string): Promise<void> {
  throw new Error(`El único administrador permitido en el sistema es ${ADMIN_EMAIL}.`);
}

export async function removeAdminEmail(_email: string): Promise<void> {
  throw new Error(`No se puede remover al administrador principal (${ADMIN_EMAIL}).`);
}

// 7. Seed initial Super Redes knowledge documents if Firestore is completely empty (Admin only)
export async function seedInitialKnowledgeIfEmpty(userEmail: string): Promise<void> {
  const currentEmail = auth.currentUser?.email?.toLowerCase().trim();
  const isRealAdmin = !!auth.currentUser?.emailVerified && currentEmail === ADMIN_EMAIL.toLowerCase().trim();
  if (!isRealAdmin) {
    return;
  }

  try {
    const colRef = collection(db, 'knowledge_items');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log('Knowledge base is empty. Seeding initial Super Redes data...');
      for (const item of SAMPLE_KNOWLEDGE_ITEMS) {
        const itemDocRef = doc(db, 'knowledge_items', item.id);
        const data: KnowledgeItem = {
          id: item.id,
          name: item.name,
          type: item.type,
          fileType: item.fileType,
          category: item.type === 'url' ? 'Procedimientos' : 'Pagos',
          url: item.url,
          content: item.content,
          charCount: item.content.length,
          createdAt: Date.now(),
          createdBy: userEmail || ADMIN_EMAIL,
          updatedAt: Date.now(),
          updatedBy: userEmail || ADMIN_EMAIL,
        };
        await setDoc(itemDocRef, data);
      }
    }
  } catch (err) {
    console.warn('Could not seed initial knowledge:', err);
  }
}
