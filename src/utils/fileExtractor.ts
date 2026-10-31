import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { auth } from '../firebase';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Initialize PDF.js worker locally from Vite bundle
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('Could not set pdf workerSrc', e);
}

export type SupportedFileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'image' | 'other';

export function detectFileType(fileName: string): SupportedFileType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'xlsx':
    case 'xls':
      return 'xlsx';
    case 'csv':
      return 'csv';
    case 'txt':
    case 'md':
    case 'log':
    case 'json':
      return 'txt';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
    case 'bmp':
    case 'svg':
      return 'image';
    default:
      return 'other';
  }
}

// Convert File to base64 data URL
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Generate lightweight resized thumbnail (under 35KB) to fit comfortably in Firestore
export function createOptimizedThumbnail(file: File, maxDim = 320): Promise<string> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          resolve('');
        }
      };
      img.onerror = () => resolve('');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// Server-side robust extraction fallback using legacy Node + Gemini multimodal OCR
export async function extractViaServer(file: File, options?: { title?: string; description?: string }): Promise<string> {
  try {
    const dataUrl = await fileToDataUrl(file);
    let token = '';
    if (auth.currentUser) {
      try {
        token = await auth.currentUser.getIdToken();
      } catch {}
    }
    if (!token) {
      try {
        const saved = localStorage.getItem('super_redes_session');
        if (saved) {
          const u = JSON.parse(saved);
          if (u.email) token = `dev-token:${u.email}`;
        }
      } catch {}
    }

    const response = await fetch('/api/extract-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        fileBase64: dataUrl,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        title: options?.title || file.name,
        description: options?.description || '',
        idToken: token,
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('Server file extraction warning:', err);
      return '';
    }

    const data = await response.json();
    return data.text || '';
  } catch (e: any) {
    console.warn('Server extraction request failed:', e?.message);
    return '';
  }
}

export async function extractTextFromFile(
  file: File,
  options?: { title?: string; description?: string }
): Promise<{ text: string; fileType: SupportedFileType; thumbnail?: string }> {
  const fileType = detectFileType(file.name);

  switch (fileType) {
    case 'image': {
      const thumbnail = await createOptimizedThumbnail(file);
      try {
        const serverText = await extractViaServer(file, options);
        const headerInfo = options?.description 
          ? `[Descripción de la imagen: ${options.description}]\n\n`
          : '';
        return {
          text: headerInfo + (serverText || `[Imagen técnica: ${options?.title || file.name}]`),
          fileType: 'image',
          thumbnail: thumbnail || '',
        };
      } catch (err: any) {
        console.warn('Image extraction fallback notice:', err);
        return {
          text: `[Recurso de Imagen: ${options?.title || file.name}]\n${options?.description ? `Descripción: ${options.description}` : ''}`,
          fileType: 'image',
          thumbnail: thumbnail || '',
        };
      }
    }

    case 'pdf': {
      let clientExtracted = '';
      let clientFailed = false;

      try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Fast client extraction: 2.5 second timeout before invoking server Gemini OCR
        const pdfPromise = (async () => {
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            useSystemFonts: true,
          });
          const pdf = await loadingTask.promise;
          let text = '';
          const maxPages = Math.min(pdf.numPages, 40);
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageStrings = textContent.items
              .map((item: any) => (item && 'str' in item ? item.str : ''))
              .filter(Boolean)
              .join(' ');
            if (pageStrings.trim()) {
              text += `[Página ${pageNum} de ${pdf.numPages}]\n${pageStrings.trim()}\n\n`;
            }
          }
          return text.trim();
        })();

        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Client PDF extraction timeout')), 2500)
        );

        clientExtracted = await Promise.race([pdfPromise, timeoutPromise]);
      } catch (pdfErr) {
        console.info('Client PDF parsing deferred to server AI extraction');
        clientFailed = true;
      }

      // If client extraction has very little or no text (e.g. scanned PDF or diagram),
      // seamlessly invoke server extraction with Gemini multimodal!
      if (clientFailed || clientExtracted.length < 120) {
        try {
          const serverText = await extractViaServer(file, options);
          if (serverText && serverText.length > clientExtracted.length) {
            return { text: serverText, fileType };
          }
        } catch (serverErr) {
          console.warn('Server PDF extraction fallback notice:', serverErr);
        }
      }

      return { 
        text: clientExtracted || `[Documento PDF: ${file.name}]`, 
        fileType 
      };
    }

    case 'docx': {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const trimmed = result.value.trim();
        if (trimmed) {
          return { text: trimmed, fileType };
        }
      } catch (docErr) {
        console.warn('Client DOCX parsing failed, trying server-side:', docErr);
      }

      // Server-side fallback
      try {
        const serverText = await extractViaServer(file, options);
        if (serverText) {
          return { text: serverText, fileType };
        }
      } catch {}

      return { text: `[Documento Word: ${file.name}]`, fileType };
    }

    case 'xlsx': {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let sheetsText = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheetsText += `--- Hoja: ${sheetName} ---\n${csv}\n\n`;
        }
        return { text: sheetsText.trim() || 'Libro de cálculo sin datos.', fileType };
      } catch {
        try {
          const serverText = await extractViaServer(file, options);
          return { text: serverText, fileType };
        } catch {
          return { text: `[Planilla Excel: ${file.name}]`, fileType };
        }
      }
    }

    case 'csv':
    case 'txt': {
      try {
        const text = await file.text();
        return { text: text.trim() || 'Archivo de texto vacío.', fileType };
      } catch {
        return { text: `[Archivo de texto: ${file.name}]`, fileType };
      }
    }

    default: {
      try {
        const text = await file.text();
        return { text: text.trim(), fileType: 'other' };
      } catch {
        try {
          const serverText = await extractViaServer(file, options);
          return { text: serverText, fileType: 'other' };
        } catch {
          return { text: `[Archivo: ${file.name}]`, fileType: 'other' };
        }
      }
    }
  }
}
