import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Link as LinkIcon, 
  Trash2, 
  FileText, 
  FileSpreadsheet, 
  Globe, 
  Image as ImageIcon,
  AlertCircle, 
  Loader2, 
  Eye, 
  X, 
  FileQuestion,
  Database,
  Plus,
  ArrowLeft,
  Search,
  Download,
  Replace,
  HelpCircle,
  Tag,
  CheckCircle2,
  Edit3,
  Play,
  ExternalLink,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { KnowledgeItem, UnansweredQuestion, ADMIN_EMAIL } from '../types';

export const CATEGORIES = [
  'Capacitación',
  'Procedimientos',
  'Pagos',
  'Precios',
  'Garantías',
  'Otros'
] as const;

export type KnowledgeCategory = typeof CATEGORIES[number];

interface KnowledgeBaseViewProps {
  items: KnowledgeItem[];
  userEmail: string;
  onUploadFile: (
    file: File, 
    category: string, 
    existingItem?: KnowledgeItem,
    title?: string,
    description?: string,
    onProgress?: (percent: number, status: string) => void
  ) => Promise<void>;
  onEditItem: (item: KnowledgeItem, newName: string, newCategory: string) => Promise<void>;
  onSaveLink: (title: string, url: string, category: string, content: string) => Promise<void>;
  onDeleteItem: (item: KnowledgeItem) => Promise<void>;
  onClearAllKnowledge?: () => Promise<void>;
  onUpdateContent?: (item: KnowledgeItem, newContent: string) => Promise<void>;
  unansweredQuestions: UnansweredQuestion[];
  onDeleteUnansweredQuestion: (id: string) => Promise<void>;
  onBackToChat: () => void;
  isDarkMode: boolean;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  items,
  userEmail,
  onUploadFile,
  onEditItem,
  onSaveLink,
  onDeleteItem,
  onClearAllKnowledge,
  onUpdateContent,
  unansweredQuestions,
  onDeleteUnansweredQuestion,
  onBackToChat,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'unanswered'>('items');

  // Filter & Search
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Upload modal state (for Files and Images)
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('Capacitación');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Link upload state
  const [urlInput, setUrlInput] = useState('');
  const [urlTitleInput, setUrlTitleInput] = useState('');
  const [urlCategory, setUrlCategory] = useState<string>('Capacitación');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlSuccess, setUrlSuccess] = useState<string | null>(null);

  // Item replacement modal state
  const [itemToReplace, setItemToReplace] = useState<KnowledgeItem | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [replaceStatus, setReplaceStatus] = useState('');
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Item edit metadata modal state (Editar nombre y categoría)
  const [itemToEdit, setItemToEdit] = useState<KnowledgeItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Capacitación');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete single item confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<KnowledgeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Clear all knowledge confirmation modal state
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearAllError, setClearAllError] = useState<string | null>(null);

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<KnowledgeItem | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewCopied, setPreviewCopied] = useState(false);
  const [isEditingPreviewContent, setIsEditingPreviewContent] = useState(false);
  const [editedPreviewContent, setEditedPreviewContent] = useState('');
  const [isSavingPreviewContent, setIsSavingPreviewContent] = useState(false);
  const [previewSaveSuccess, setPreviewSaveSuccess] = useState(false);

  // Mobile drawer state
  const [showAddModalMobile, setShowAddModalMobile] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (uploadPreviewUrl && uploadPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreviewUrl);
      }
    };
  }, [uploadPreviewUrl]);

  // Support pasting screenshots directly from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.startsWith('image/')) {
          const file = clipboardItems[i].getAsFile();
          if (file) {
            const timeStr = new Date().toLocaleTimeString().replace(/:/g, '-');
            const customName = `Captura_Super_Redes_${timeStr}.png`;
            const renamedFile = new File([file], customName, { type: file.type });
            openUploadModalForFile(renamedFile);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // When a file is selected (via picker or drag & drop)
  const openUploadModalForFile = (file: File) => {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
    const cleanBaseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    setPendingUploadFile(file);
    setUploadTitle(cleanBaseName);
    setUploadDescription('');
    setUploadCategory('Capacitación');
    setUploadProgress(0);
    setUploadStatusText('');
    setUploadError(null);
    setUploadSuccess(null);

    if (isImage) {
      const preview = URL.createObjectURL(file);
      setUploadPreviewUrl(preview);
    } else {
      setUploadPreviewUrl(null);
    }
  };

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    openUploadModalForFile(files[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (mobileFileInputRef.current) mobileFileInputRef.current.value = '';
  };

  // Submit file upload
  const handleConfirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUploadFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress(5);
    setUploadStatusText('Iniciando subida...');

    try {
      await onUploadFile(
        pendingUploadFile,
        uploadCategory,
        undefined,
        uploadTitle.trim() || pendingUploadFile.name,
        uploadDescription.trim(),
        (pct, status) => {
          setUploadProgress(pct);
          setUploadStatusText(status);
        }
      );

      setUploadProgress(100);
      setUploadStatusText('¡Completado con éxito!');
      setUploadSuccess(`"${uploadTitle || pendingUploadFile.name}" se guardó correctamente en la base de conocimiento.`);

      setTimeout(() => {
        setPendingUploadFile(null);
        setUploadPreviewUrl(null);
        setIsUploading(false);
      }, 1200);
    } catch (err: any) {
      console.error('Upload error in KnowledgeBaseView:', err);
      // Show REAL error message on screen
      setUploadError(err?.message || 'Error al subir el archivo a Firebase.');
      setIsUploading(false);
    }
  };

  // Submit Replace action
  const handleConfirmReplace = async () => {
    if (!itemToReplace || !replaceFile) return;

    setIsReplacing(true);
    setReplaceError(null);
    setReplaceProgress(10);
    setReplaceStatus('Iniciando reemplazo...');

    try {
      await onUploadFile(
        replaceFile,
        itemToReplace.category || 'Capacitación',
        itemToReplace, // Keep ID, name, and category
        itemToReplace.name,
        itemToReplace.description || '',
        (pct, status) => {
          setReplaceProgress(pct);
          setReplaceStatus(status);
        }
      );

      setReplaceProgress(100);
      setReplaceStatus('¡Reemplazado con éxito!');

      setTimeout(() => {
        setItemToReplace(null);
        setReplaceFile(null);
        setIsReplacing(false);
      }, 1000);
    } catch (err: any) {
      console.error('Replace error:', err);
      setReplaceError(err?.message || 'Error al reemplazar el documento en Firebase.');
      setIsReplacing(false);
    }
  };

  // Submit Edit metadata action (Name and Category)
  const handleConfirmEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !editName.trim()) return;

    setIsSavingEdit(true);
    setEditError(null);

    try {
      await onEditItem(itemToEdit, editName.trim(), editCategory);
      setIsSavingEdit(false);
      setItemToEdit(null);
    } catch (err: any) {
      console.error('Edit error:', err);
      setEditError(err?.message || 'Error al editar el documento.');
      setIsSavingEdit(false);
    }
  };

  // Submit Delete item action
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await onDeleteItem(itemToDelete);
      setIsDeleting(false);
      setItemToDelete(null);
    } catch (err: any) {
      console.error('Delete error:', err);
      setDeleteError(err?.message || 'Error al eliminar el documento de Firebase.');
      setIsDeleting(false);
    }
  };

  // Submit Clear All knowledge action
  const handleConfirmClearAll = async () => {
    if (!onClearAllKnowledge) return;

    setIsClearingAll(true);
    setClearAllError(null);

    try {
      await onClearAllKnowledge();
      setIsClearingAll(false);
      setShowClearAllModal(false);
    } catch (err: any) {
      console.error('Clear all error:', err);
      setClearAllError(err?.message || 'Error al vaciar la base de conocimiento.');
      setIsClearingAll(false);
    }
  };

  // Submit URL link registration
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUrl = urlInput.trim();
    if (!rawUrl) return;

    let validUrl = rawUrl;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
    }

    try {
      new URL(validUrl);
    } catch {
      setUrlError('Ingresa una URL válida (ej: https://youtube.com/watch?v=... o https://pagos.superredes.co)');
      return;
    }

    setUrlError(null);
    setUrlSuccess(null);
    setIsAddingUrl(true);

    try {
      let content = `Enlace oficial de Super Redes: ${validUrl}`;
      let title = urlTitleInput.trim() || validUrl;

      // Detect video links
      const isVideo = validUrl.includes('youtube.com') || validUrl.includes('youtu.be') || validUrl.includes('drive.google.com');
      if (isVideo) {
        content = `Video de capacitación técnica de Super Redes: ${validUrl}\nTítulo: ${title}`;
      }

      try {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: validUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!urlTitleInput.trim() && data.title) title = data.title;
          if (data.content) content = data.content;
        }
      } catch (fetchErr) {
        console.warn('Backend URL fetch notice, saving direct URL:', fetchErr);
      }

      await onSaveLink(title, validUrl, urlCategory, content);
      setUrlSuccess(`Enlace "${title}" registrado con éxito en categoría ${urlCategory}.`);
      setUrlInput('');
      setUrlTitleInput('');
      setShowAddModalMobile(false);

      setTimeout(() => setUrlSuccess(null), 3000);
    } catch (err: any) {
      console.error('Add URL error:', err);
      setUrlError(err?.message || 'Error al registrar el enlace web.');
    } finally {
      setIsAddingUrl(false);
    }
  };

  const getFileIcon = (item: KnowledgeItem) => {
    if (item.type === 'url') {
      const isVideo = (item.url || '').includes('youtube.com') || (item.url || '').includes('youtu.be') || (item.url || '').includes('drive.google.com');
      if (isVideo) {
        return <Play className="w-5 h-5 text-rose-600 dark:text-rose-400 fill-rose-600/20" />;
      }
      return <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
    if (item.fileType === 'image') {
      if (item.thumbnail || item.storageUrl) {
        return (
          <img
            src={item.thumbnail || item.storageUrl}
            alt={item.name}
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-2xs"
          />
        );
      }
      return <ImageIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
    }
    switch (item.fileType) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'txt':
        return <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
      default:
        return <FileQuestion className="w-5 h-5 text-slate-500" />;
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.url && item.url.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (item.description && item.description.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || (item.category || 'Otros') === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalChars = items.reduce((sum, item) => sum + (item.charCount || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#FAF8F5] dark:bg-stone-950 text-stone-800 dark:text-stone-100 overflow-hidden relative transition-colors">
      {/* Hidden file input for Replace action */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            setReplaceFile(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* Header - Apple Warm Clean */}
      <header className="px-4 sm:px-6 py-3 bg-[#FAF8F5]/85 dark:bg-stone-900/85 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-200 font-medium text-xs border border-stone-200/80 dark:border-stone-700 inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Volver al Chat</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                Gestión de Conocimiento
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-800 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                Solo Administrador
              </span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
              Super Redes • Almacenamiento seguro en Firebase (Firestore + Storage)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Vaciar base de conocimientos button */}
          {items.length > 0 && onClearAllKnowledge && (
            <button
              type="button"
              onClick={() => setShowClearAllModal(true)}
              className="min-h-[34px] px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-medium text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Eliminar todos los documentos y archivos de Firebase"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Vaciar base de datos</span>
            </button>
          )}

          {/* Subtab Switchers */}
          <div className="flex items-center gap-1 p-1 bg-stone-200/60 dark:bg-stone-800 rounded-xl border border-stone-200/80 dark:border-stone-700">
            <button
              type="button"
              onClick={() => setActiveSubTab('items')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSubTab === 'items'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <span>Documentos ({items.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('unanswered')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'unanswered'
                  ? 'bg-white dark:bg-stone-700 text-amber-700 dark:text-amber-300 shadow-2xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <span>Sin respuesta</span>
              {unansweredQuestions.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              )}
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                {unansweredQuestions.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 overscroll-contain">
        <div className="max-w-[1100px] mx-auto w-full space-y-6 pb-20 sm:pb-6">

          {/* SUBTAB 1: KNOWLEDGE ITEMS */}
          {activeSubTab === 'items' && (
            <>
              {/* Capacitación & Procedimientos Banner - Apple Minimalist Dark Slate */}
              <div className="bg-stone-900 dark:bg-stone-850 border border-stone-800 rounded-3xl p-5 sm:p-6 text-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎓</span>
                    <h3 className="font-semibold text-base sm:text-lg text-stone-100">
                      Módulo de Capacitación y Procedimientos
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed font-normal">
                    Sube guías paso a paso, fotos y esquemas de instalación (ONT, fibra, cableado) o enlaces a videos de YouTube / Google Drive. El asistente explicará el procedimiento paso a paso y mostrará las imágenes y videos en el chat.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                    Admin: {userEmail}
                  </span>
                </div>
              </div>

              {/* Upload Grid Desktop (Files + URLs) */}
              <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. File & Image Upload Card */}
                <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-stone-900 dark:text-stone-100">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                          <Upload className="w-4 h-4" />
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base">Subir Documento o Imagen</h3>
                      </div>
                      <span className="text-[10px] font-medium text-stone-400 uppercase">
                        PDF, Word, Excel, Fotos
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-normal">
                      Arrastra o selecciona archivos técnicos. Para fotos y diagramas podrás especificar título y descripción.
                    </p>
                  </div>

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFileSelection(e.dataTransfer.files);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                      isDragging
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-stone-850'
                        : 'border-stone-300 dark:border-stone-700 hover:border-amber-500/60 bg-stone-50/50 dark:bg-stone-850 hover:bg-amber-50/20'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => handleFileSelection(e.target.files)}
                      className="hidden"
                    />

                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                      <Upload className="w-5 h-5 stroke-[2]" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200">
                      Arrastra tu archivo o imagen aquí
                    </p>
                    <p className="text-[11px] text-stone-400 dark:text-stone-500">
                      o haz clic para explorar tus carpetas
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                    <span>💡 También puedes presionar Ctrl+V para pegar capturas</span>
                  </div>
                </div>

                {/* 2. Web & Video Link Registration Card */}
                <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-stone-900 dark:text-stone-100">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base">Registrar Enlace o Video</h3>
                      </div>
                      <span className="text-[10px] font-medium text-stone-400 uppercase">
                        Web • YouTube • Drive
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-normal">
                      Agrega enlaces oficiales (pasarelas de pago, portal de soporte) o videos tutoriales para consulta de los asesores.
                    </p>
                  </div>

                  <form onSubmit={handleAddUrl} className="space-y-2.5">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Título del recurso
                      </label>
                      <input
                        type="text"
                        value={urlTitleInput}
                        onChange={(e) => setUrlTitleInput(e.target.value)}
                        placeholder="Ej: Video tutorial: Configuración ONT Huawei HG8245"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                          Categoría
                        </label>
                        <select
                          value={urlCategory}
                          onChange={(e) => setUrlCategory(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-600"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                          URL (https://...)
                        </label>
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600"
                        />
                      </div>
                    </div>

                    {urlError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{urlError}</span>
                      </div>
                    )}

                    {urlSuccess && (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{urlSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!urlInput.trim() || isAddingUrl}
                      className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isAddingUrl ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando enlace en Firestore...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Guardar enlace en Firebase</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Knowledge Items List & Category Filter Chips */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                
                {/* Header of list + Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                      Documentos y Recursos Guardados ({items.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {totalChars.toLocaleString()} caracteres activos disponibles para responder a los asesores
                    </p>
                  </div>

                  {/* Search box */}
                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Buscar por nombre o contenido..."
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-750 bg-stone-50/70 dark:bg-stone-850 text-xs text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-hidden focus:border-amber-600 focus:ring-1 focus:ring-amber-500/20"
                    />
                  </div>
                </div>

                {/* Category Filter Chips Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('ALL')}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      categoryFilter === 'ALL'
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-2xs font-semibold'
                        : 'bg-white dark:bg-stone-850 text-stone-600 dark:text-stone-400 border border-stone-200/80 dark:border-stone-750 hover:bg-stone-100'
                    }`}
                  >
                    Todas ({items.length})
                  </button>

                  {CATEGORIES.map((cat) => {
                    const count = items.filter(it => (it.category || 'Otros') === cat).length;
                    const isSelected = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30 font-semibold shadow-2xs'
                            : 'bg-white dark:bg-stone-850 text-stone-600 dark:text-stone-400 border border-stone-200/80 dark:border-stone-750 hover:bg-stone-100'
                        }`}
                      >
                        {cat === 'Capacitación' && <span>🎓</span>}
                        {cat === 'Procedimientos' && <span>📋</span>}
                        {cat === 'Pagos' && <span>💳</span>}
                        {cat === 'Precios' && <span>💲</span>}
                        {cat === 'Garantías' && <span>🛡️</span>}
                        {cat === 'Otros' && <span>📁</span>}
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Items Grid */}
                {filteredItems.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <Database className="w-10 h-10 text-stone-300 dark:text-stone-700 mx-auto" />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-stone-800 dark:text-stone-200">
                        {items.length === 0 ? 'Base de conocimiento vacía' : 'No se encontraron documentos'}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                        {items.length === 0
                          ? 'Sube archivos, fotos o enlaces en las categorías correspondientes para comenzar.'
                          : 'Prueba cambiando el filtro de categoría o el texto de búsqueda.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-amber-500/30 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200/70 dark:border-stone-750 shrink-0">
                            {getFileIcon(item)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-medium border border-amber-500/20">
                                {item.category || 'Capacitación'}
                              </span>
                              {item.fileType === 'image' && (
                                <span className="px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-medium">
                                  Imagen
                                </span>
                              )}
                              {item.hasChunks && (
                                <span className="px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-medium">
                                  {item.totalParts} partes
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate" title={item.name}>
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                                {item.description}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              Actualizado: {new Date(item.updatedAt || item.createdAt).toLocaleDateString()} por <span className="font-medium text-slate-700 dark:text-slate-300">{item.updatedBy || ADMIN_EMAIL}</span>
                            </p>
                          </div>
                        </div>

                        {/* Card Action Buttons: Reemplazar, Editar, Ver Texto, Descargar, Eliminar */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex items-center gap-1">
                            {/* Editar nombre y categoría */}
                            <button
                              type="button"
                              onClick={() => {
                                setItemToEdit(item);
                                setEditName(item.name);
                                setEditCategory(item.category || 'Capacitación');
                                setEditError(null);
                              }}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1 cursor-pointer"
                              title="Editar nombre y categoría"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>

                            {/* Reemplazar contenido */}
                            {item.type === 'file' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemToReplace(item);
                                  setReplaceFile(null);
                                  setReplaceError(null);
                                  replaceFileInputRef.current?.click();
                                }}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1 cursor-pointer"
                                title="Reemplazar archivo conservando nombre y categoría"
                              >
                                <Replace className="w-3.5 h-3.5" />
                                <span>Reemplazar</span>
                              </button>
                            )}

                            {/* Descargar original de Firebase Storage */}
                            {item.storageUrl && (
                              <a
                                href={item.storageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="min-h-[34px] px-2 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1 cursor-pointer"
                                title="Descargar archivo original de Firebase Storage"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Original</span>
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Ver contenido texto */}
                            <button
                              type="button"
                              onClick={() => setPreviewItem(item)}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>

                            {/* Eliminar con confirmación */}
                            <button
                              type="button"
                              onClick={() => {
                                setItemToDelete(item);
                                setDeleteError(null);
                              }}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1 cursor-pointer"
                              title="Eliminar de Firestore y Storage"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Eliminar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* SUBTAB 2: UNANSWERED QUESTIONS */}
          {activeSubTab === 'unanswered' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-amber-500" />
                    <span>Preguntas Sin Respuesta ({unansweredQuestions.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Consultas donde el asistente respondió "No encontré esa información...". Úsalas para detectar qué documentos o capacitaciones faltan por cargar.
                  </p>
                </div>
              </div>

              {unansweredQuestions.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="font-bold text-base text-slate-800 dark:text-slate-200">
                    ¡Excelente! No hay preguntas sin resolver pendientes.
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    La base de conocimiento ha cubierto todas las consultas recientes de los asesores técnicos.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {unansweredQuestions.map((q) => (
                    <div key={q.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          "{q.question}"
                        </p>
                        <p className="text-xs text-slate-500">
                          Consultado por: <span className="font-semibold text-slate-700 dark:text-slate-300">{q.askedBy}</span> • {new Date(q.timestamp).toLocaleString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteUnansweredQuestion(q.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-center cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Marcar como atendida</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Floating Action Button for Mobile (+) */}
      {activeSubTab === 'items' && (
        <div className="sm:hidden fixed bottom-6 right-6 z-30">
          <button
            type="button"
            onClick={() => setShowAddModalMobile(true)}
            className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all cursor-pointer border-2 border-white dark:border-slate-800"
            aria-label="Agregar archivo o enlace"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* MODAL 1: UPLOAD FILE & IMAGE MODAL (With Title, Description, Progress Bar & Real Error) */}
      {pendingUploadFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  {pendingUploadFile.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">
                    {pendingUploadFile.type.startsWith('image/') ? 'Subir Imagen Técnica' : 'Subir Documento'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {pendingUploadFile.name} ({(pendingUploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                </div>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingUploadFile(null);
                    setUploadPreviewUrl(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleConfirmUpload} className="p-6 space-y-4">
              {/* Image Preview thumbnail if image */}
              {uploadPreviewUrl && (
                <div className="flex flex-col items-center justify-center p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <img
                    src={uploadPreviewUrl}
                    alt="Vista previa"
                    className="max-h-44 max-w-full rounded-xl object-contain shadow-xs"
                  />
                  <span className="text-[10px] text-slate-500 font-semibold mt-2">
                    Gemini multimodal procesará este esquema/captura para responder a los asesores
                  </span>
                </div>
              )}

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Título del recurso <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  disabled={isUploading}
                  placeholder="Ej: Esquema de instalación ONT Huawei"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600"
                />
              </div>

              {/* Short description input */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Descripción corta {pendingUploadFile.type.startsWith('image/') && <span className="text-blue-600">(recomendada para imágenes)</span>}
                </label>
                <textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  disabled={isUploading}
                  placeholder="Describe brevemente qué muestra (ej: Diagrama de puertos PON, led LOS en rojo, paso a paso para reiniciar módem...)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600 resize-none"
                />
              </div>

              {/* Category picker */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Categoría
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  disabled={isUploading}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Real Progress Bar */}
              {isUploading && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-blue-600 dark:text-blue-400">{uploadStatusText || 'Subiendo...'}</span>
                    <span className="text-slate-600 dark:text-slate-400">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Real Error on screen */}
              {uploadError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Error al subir</p>
                    <p className="leading-relaxed break-words">{uploadError}</p>
                  </div>
                </div>
              )}

              {/* Success Alert */}
              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => {
                    setPendingUploadFile(null);
                    setUploadPreviewUrl(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isUploading || !uploadTitle.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando en Firebase...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Subir a Firebase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT METADATA (Nombre y Categoría) */}
      {itemToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Editar Documento
                </h3>
              </div>
              {!isSavingEdit && (
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleConfirmEdit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Nombre del documento
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSavingEdit}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Categoría
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  disabled={isSavingEdit}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-600"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {editError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setItemToEdit(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>Guardar cambios</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REEMPLAZAR ARCHIVO */}
      {itemToReplace && replaceFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2 text-blue-600">
              <Replace className="w-5 h-5" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Reemplazar contenido de documento
              </h3>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-blue-900 dark:text-blue-200">
                Documento actual: "{itemToReplace.name}"
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                Categoría: <strong>{itemToReplace.category}</strong> (se conserva el nombre y categoría)
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Nuevo archivo: <strong>{replaceFile.name}</strong> ({(replaceFile.size / 1024).toFixed(1)} KB)
              </p>
            </div>

            {isReplacing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-blue-600">
                  <span>{replaceStatus || 'Reemplazando...'}</span>
                  <span>{replaceProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all rounded-full" style={{ width: `${replaceProgress}%` }} />
                </div>
              </div>
            )}

            {replaceError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{replaceError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isReplacing}
                onClick={() => {
                  setItemToReplace(null);
                  setReplaceFile(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReplacing}
                onClick={handleConfirmReplace}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md inline-flex items-center gap-2"
              >
                {isReplacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Replace className="w-4 h-4" />}
                <span>Confirmar reemplazo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION ("¿Seguro que quieres eliminar este documento?") */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Eliminar documento
                </h3>
                <p className="text-xs text-slate-500">
                  Acción irreversible en Firebase
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                ¿Seguro que quieres eliminar este documento?
              </p>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs space-y-1">
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  "{itemToDelete.name}"
                </p>
                <p className="text-slate-500">
                  Categoría: {itemToDelete.category} • {itemToDelete.type === 'file' ? 'Archivo' : 'Enlace web'}
                </p>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Se borrará permanentemente de Firestore, todas sus partes y el archivo original de Firebase Storage.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, eliminar documento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: CLEAR ALL CONFIRMATION ("¿Seguro que quieres eliminar toda la base de conocimientos?") */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Vaciar base de conocimientos
                </h3>
                <p className="text-xs text-rose-600">
                  ¡Atención! Acción de eliminación total
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <p className="font-bold">
                ¿Seguro que quieres eliminar toda la base de conocimientos?
              </p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Esta acción eliminará todos los <strong>{items.length}</strong> documentos guardados, todas sus partes en Firestore y sus archivos originales en Firebase Storage. La base quedará completamente vacía.
              </p>
            </div>

            {clearAllError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{clearAllError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isClearingAll}
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isClearingAll}
                onClick={handleConfirmClearAll}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-500/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isClearingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Vaciando base...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, vaciar completamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: PREVIEW TEXT MODAL (With full reading, inline editing, and search) */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold">
                    {previewItem.category}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                    {previewItem.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {(previewItem.charCount || previewItem.content?.length || 0).toLocaleString()} caracteres • Formato: {previewItem.fileType || previewItem.type}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Mode toggle: Edit vs View */}
                {!isEditingPreviewContent ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditedPreviewContent(previewItem.content || '');
                      setIsEditingPreviewContent(true);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    title="Editar o enriquecer el texto extraído"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Editar texto</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSavingPreviewContent}
                    onClick={async () => {
                      if (!onUpdateContent) return;
                      setIsSavingPreviewContent(true);
                      try {
                        await onUpdateContent(previewItem, editedPreviewContent);
                        setPreviewItem({
                          ...previewItem,
                          content: editedPreviewContent,
                          charCount: editedPreviewContent.length,
                        });
                        setIsEditingPreviewContent(false);
                        setPreviewSaveSuccess(true);
                        setTimeout(() => setPreviewSaveSuccess(false), 2500);
                      } catch (e: any) {
                        console.error('Error saving updated content:', e);
                      } finally {
                        setIsSavingPreviewContent(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isSavingPreviewContent ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar texto</span>
                  </button>
                )}

                {isEditingPreviewContent && (
                  <button
                    type="button"
                    disabled={isSavingPreviewContent}
                    onClick={() => setIsEditingPreviewContent(false)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(previewItem.content || '');
                      setPreviewCopied(true);
                      setTimeout(() => setPreviewCopied(false), 2000);
                    } catch {}
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  title="Copiar todo el texto extraído"
                >
                  {previewCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{previewCopied ? '¡Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewItem(null);
                    setPreviewSearch('');
                    setIsEditingPreviewContent(false);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* In-modal Search Bar (in view mode) */}
            {!isEditingPreviewContent && (
              <div className="p-2.5 px-4 bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  placeholder="Buscar palabra o frase dentro de este documento..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden"
                />
                {previewSearch && (
                  <button
                    type="button"
                    onClick={() => setPreviewSearch('')}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}

            {/* Save success toast */}
            {previewSaveSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/80 p-2.5 px-4 border-b border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">¡Texto del documento actualizado con éxito en Firestore!</span>
              </div>
            )}

            {/* Image display if available */}
            {previewItem.thumbnail && (
              <div className="bg-slate-100 dark:bg-slate-950 p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center max-h-52 overflow-hidden shrink-0">
                <img
                  src={previewItem.thumbnail}
                  alt={previewItem.name}
                  className="max-h-44 max-w-full rounded-lg object-contain shadow-xs border border-slate-300 dark:border-slate-700 bg-white"
                />
              </div>
            )}

            {/* Content text viewer / editor */}
            {isEditingPreviewContent ? (
              <div className="p-4 flex-1 flex flex-col bg-slate-900">
                <div className="text-xs text-slate-400 mb-2 font-sans flex items-center justify-between">
                  <span>Edita o escribe el contenido técnico que el asistente IA utilizará para responder:</span>
                  <span>{editedPreviewContent.length} caracteres</span>
                </div>
                <textarea
                  value={editedPreviewContent}
                  onChange={(e) => setEditedPreviewContent(e.target.value)}
                  rows={14}
                  placeholder="Pega o escribe aquí el contenido del documento, manual, procedimiento o pasos..."
                  className="w-full flex-1 p-3.5 rounded-xl bg-slate-800 text-slate-100 font-mono text-xs sm:text-sm border border-slate-700 focus:outline-hidden focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>
            ) : (
              <div className="p-5 overflow-y-auto flex-1 font-mono text-xs sm:text-sm bg-slate-900 text-slate-100 whitespace-pre-wrap leading-relaxed select-text">
                {previewItem.content && previewItem.content.trim().length > 0 ? (
                  previewSearch ? (
                    previewItem.content.split('\n').filter(line => 
                      line.toLowerCase().includes(previewSearch.toLowerCase())
                    ).join('\n') || `(No se encontraron coincidencias para "${previewSearch}" en este documento)`
                  ) : (
                    previewItem.content
                  )
                ) : (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-slate-400 italic">
                      Este documento aún no tiene texto extraído.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditedPreviewContent(previewItem.content || '');
                        setIsEditingPreviewContent(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Ingresar o pegar texto del documento</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-3">
                {previewItem.storageUrl ? (
                  <a
                    href={previewItem.storageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar archivo original</span>
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    Sincronizado con Cloud Firestore
                  </span>
                )}

                {previewItem.content && (
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([previewItem.content], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${previewItem.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_texto.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 inline-flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar texto (.txt)</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewItem(null);
                  setPreviewSearch('');
                  setIsEditingPreviewContent(false);
                }}
                className="min-h-[38px] px-5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE ADD CONTENT SHEET */}
      {showAddModalMobile && (
        <div className="fixed inset-0 z-50 sm:hidden flex items-end">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowAddModalMobile(false)}
          />
          <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 shadow-2xl z-10 max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Subir a Base de Conocimiento
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModalMobile(false)}
                className="p-1.5 rounded-xl text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile File button */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Subir Archivo o Foto
              </label>
              <input
                ref={mobileFileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  handleFileSelection(e.target.files);
                  setShowAddModalMobile(false);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => mobileFileInputRef.current?.click()}
                className="w-full min-h-[48px] p-3 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Upload className="w-5 h-5" />
                <span>Seleccionar archivo o foto</span>
              </button>
            </div>

            {/* Mobile Link Form */}
            <form onSubmit={handleAddUrl} className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. O Guardar Enlace / Video
              </label>
              <input
                type="text"
                value={urlTitleInput}
                onChange={(e) => setUrlTitleInput(e.target.value)}
                placeholder="Título del enlace o video"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
              <select
                value={urlCategory}
                onChange={(e) => setUrlCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="submit"
                disabled={!urlInput.trim() || isAddingUrl}
                className="w-full min-h-[44px] rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isAddingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Guardar en Firebase</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
