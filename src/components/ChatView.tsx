import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  ArrowRight, 
  FileText, 
  Globe, 
  ExternalLink,
  Menu,
  Plus,
  Moon,
  Sun,
  Video,
  Image as ImageIcon,
  Play,
  Paperclip,
  X,
  File,
  FileSpreadsheet,
  Loader2,
  Wifi
} from 'lucide-react';
import { ChatMessage, KnowledgeItem, RelatedMedia, AttachedFileInfo } from '../types';
import { FormattedText } from './FormattedText';
import { extractTextFromFile, fileToDataUrl, detectFileType } from '../utils/fileExtractor';
import { TemplatesModal } from './TemplatesModal';

interface ChatViewProps {
  messages: ChatMessage[];
  knowledgeItems: KnowledgeItem[];
  isLoading: boolean;
  onSendMessage: (query: string, attachedFile?: AttachedFileInfo) => Promise<void>;
  onNewConversation: () => void;
  onGoToKnowledgeBase: () => void;
  onLoadSampleData: () => Promise<void>;
  onOpenMobileMenu: () => void;
  isAdmin?: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

interface ParsedDualResponse {
  isDual: boolean;
  clientMessage?: string;
  advisorMessage?: string;
}

function parseDualResponse(text: string): ParsedDualResponse {
  if (!text) return { isDual: false };

  // Match headers for Client and Advisor sections (supporting Plantilla del Asesor variations)
  const clientRegex = /(?:^|\n)(?:#{1,4}\s*|\*\*|__)?(?:📲\s*)?(?:Mensaje|Respuesta|Plantilla)\s+(?:del\s+Asesor\s+)?(?:para el|al)\s+Cliente(?:\s*\(.*?\))?(?:\*\*|__)?[:\s]*/i;
  const advisorRegex = /(?:^|\n)(?:#{1,4}\s*|\*\*|__)?(?:🛠️\s*|📋\s*|💡\s*|🔧\s*)?(?:Gu[ií]a|Razonamiento|Explicaci[oó]n|Instrucci[oó]n)\s+(?:y\s+Razonamiento\s+)?(?:para el|al)\s+Asesor(?:\*\*|__)?[:\s]*/i;

  const clientMatch = text.match(clientRegex);
  const advisorMatch = text.match(advisorRegex);

  if (clientMatch && advisorMatch && clientMatch.index !== undefined && advisorMatch.index !== undefined) {
    const clientHeaderEnd = clientMatch.index + clientMatch[0].length;
    const advisorHeaderEnd = advisorMatch.index + advisorMatch[0].length;

    let clientMsg = '';
    let advisorMsg = '';

    if (clientHeaderEnd < advisorMatch.index) {
      clientMsg = text.substring(clientHeaderEnd, advisorMatch.index).trim();
      advisorMsg = text.substring(advisorHeaderEnd).trim();
    } else {
      advisorMsg = text.substring(advisorHeaderEnd, clientMatch.index).trim();
      clientMsg = text.substring(clientHeaderEnd).trim();
    }

    if (clientMsg && advisorMsg) {
      return {
        isDual: true,
        clientMessage: clientMsg,
        advisorMessage: advisorMsg,
      };
    }
  }

  return { isDual: false };
}

const QUICK_SUGGESTIONS = [
  { label: '📦 Traslado interno', query: '¿Cuál es la plantilla oficial del asesor para traslado interno de equipos en el mismo predio?' },
  { label: '📍 Traslado externo (Paso 1)', query: '¿Cuál es la plantilla del asesor para pedir datos y validar cobertura en traslado externo?' },
  { label: '✅ Traslado con cobertura', query: '¿Cuál es la plantilla oficial cuando el traslado externo tiene cobertura aprobada?' },
  { label: '❌ Traslado sin cobertura', query: '¿Cuál es la plantilla del asesor si no hay cobertura técnica en la nueva dirección?' },
  { label: '🔧 Falla luz LOS roja', query: '¿Cuál es la plantilla del asesor cuando el módem tiene la luz LOS en rojo?' },
  { label: '💳 Enlace de pago PSE', query: '¿Cuál es la plantilla oficial para compartir el enlace de pago PSE?' },
  { label: '🔄 Cesión de contrato', query: '¿Cuál es la plantilla oficial para la cesión o traspaso de titularidad?' },
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  knowledgeItems,
  isLoading,
  onSendMessage,
  onNewConversation,
  onGoToKnowledgeBase,
  onLoadSampleData,
  onOpenMobileMenu,
  isAdmin = false,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedClientMsgId, setCopiedClientMsgId] = useState<string | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFileInfo | null>(null);
  const [isReadingAttachment, setIsReadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const copyClientMessage = async (clientText: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(clientText);
      setCopiedClientMsgId(messageId);
      setTimeout(() => setCopiedClientMsgId(null), 2500);
    } catch (err) {
      console.error('Failed to copy client message', err);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom(messages.length <= 2 ? 'auto' : 'smooth');
  }, [messages, isLoading]);

  const processFileAttachment = async (file: File) => {
    setIsReadingAttachment(true);
    setAttachmentError(null);
    try {
      const fileType = detectFileType(file.name);
      const dataUrl = await fileToDataUrl(file);
      const { text } = await extractTextFromFile(file, { title: file.name });
      setAttachedFile({
        name: file.name,
        fileType,
        size: file.size,
        base64: dataUrl,
        thumbnail: fileType === 'image' ? dataUrl : undefined,
        text,
        mimeType: file.type || 'application/octet-stream',
      });
    } catch (err: any) {
      console.warn('Error reading attachment:', err);
      setAttachmentError(err?.message || 'No se pudo leer el archivo adjunto');
    } finally {
      setIsReadingAttachment(false);
    }
  };

  // Support paste from clipboard in chat
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            processFileAttachment(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = input.trim();
    if ((!query && !attachedFile) || isLoading || isReadingAttachment) return;
    const fileToSend = attachedFile;
    setInput('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await onSendMessage(query, fileToSend || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const hasKnowledge = knowledgeItems.length > 0;

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-[#FAF8F5] dark:bg-stone-950 text-stone-800 dark:text-stone-100 overflow-hidden transition-colors">
      {/* Top Header - Apple Warm Clean Glassmorphism */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FAF8F5]/85 dark:bg-stone-900/85 backdrop-blur-md border-b border-stone-200/60 dark:border-stone-800 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="w-9 h-9 md:hidden flex items-center justify-center rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800 active:scale-95 transition-all cursor-pointer"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-2xs shrink-0">
              <Wifi className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-sm sm:text-base text-stone-900 dark:text-stone-100 leading-tight">
                  Super Redes
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-200/60 dark:bg-stone-800 text-[10px] font-medium text-stone-600 dark:text-stone-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>{isAdmin ? 'Modo Administrador' : 'Modo Asistente'}</span>
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 font-normal">
                {knowledgeItems.length} documento{knowledgeItems.length === 1 ? '' : 's'} en base técnica
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsTemplatesOpen(true)}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/25 text-xs font-semibold shadow-2xs active:scale-95 transition-all cursor-pointer"
            title="Abrir catálogo oficial de plantillas del asesor para el cliente"
          >
            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Plantillas del Asesor</span>
            <span className="sm:hidden">Plantillas</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Cambiar tema"
          >
            {isDarkMode ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-600" />}
          </button>

          <button
            type="button"
            onClick={onNewConversation}
            className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 text-xs font-medium shadow-2xs active:scale-95 transition-all cursor-pointer"
            title="Nueva consulta"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="hidden sm:inline">Nueva consulta</span>
          </button>
        </div>
      </header>

      {/* Main Messages Scrollable Zone (Apple spacious layout, max-w-[820px]) */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 overscroll-contain">
        <div className="max-w-[820px] mx-auto w-full space-y-6">
          {/* Empty Knowledge Alert (Only if base is truly empty) */}
          {!hasKnowledge && (
            <div className="bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 rounded-2xl p-5 shadow-xs text-amber-950 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold text-sm sm:text-base text-amber-900 dark:text-amber-100">
                    Base de conocimiento vacía
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                    {isAdmin 
                      ? 'Carga archivos, enlaces, guías o fotos técnicas para que el asistente responda con la información oficial de Super Redes.' 
                      : 'La base de conocimiento está siendo actualizada por el administrador. Podrás realizar consultas tan pronto se incorporen los documentos.'}
                  </p>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={onGoToKnowledgeBase}
                        className="min-h-[38px] inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white font-medium px-3.5 py-1.5 rounded-xl shadow-2xs transition-all active:scale-[0.98] text-xs cursor-pointer"
                      >
                        <span>Gestionar documentos</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={onLoadSampleData}
                        className="min-h-[38px] inline-flex items-center gap-1.5 bg-white dark:bg-stone-850 hover:bg-stone-50 text-stone-800 dark:text-stone-200 font-medium px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 shadow-2xs transition-all active:scale-[0.98] text-xs cursor-pointer"
                      >
                        <span>Cargar datos de ejemplo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Welcome Card if empty conversation - Apple Style */}
          {messages.length === 0 && (
            <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border border-stone-200/80 dark:border-stone-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-medium text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Soporte Técnico Especializado</span>
                </div>
                <h2 className="text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 tracking-tight">
                  ¿En qué podemos ayudarte hoy?
                </h2>
                <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                  Consulta procedimientos de red, enlaces de pago verificados, políticas de garantías y especificaciones técnicas. Respuestas extraídas de la documentación corporativa de Super Redes.
                </p>
              </div>

              <div className="border-t border-stone-100 dark:border-stone-800 pt-5 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Preguntas frecuentes recomendadas:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSendMessage('¿Cuál es el enlace oficial de pago por PSE?')}
                    className="text-left p-3.5 rounded-2xl bg-stone-50/70 dark:bg-stone-850 hover:bg-amber-50/60 dark:hover:bg-stone-800 border border-stone-200/70 dark:border-stone-750 hover:border-amber-500/30 text-stone-800 dark:text-stone-200 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 block mb-0.5">Pagos y Facturación</span>
                    <span className="font-medium text-xs sm:text-sm text-stone-800 dark:text-stone-100 group-hover:text-amber-800 dark:group-hover:text-amber-300">
                      "¿Cuál es el enlace oficial de pago por PSE?"
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendMessage('¿Cuáles son los requisitos obligatorios para tramitar una garantía?')}
                    className="text-left p-3.5 rounded-2xl bg-stone-50/70 dark:bg-stone-850 hover:bg-amber-50/60 dark:hover:bg-stone-800 border border-stone-200/70 dark:border-stone-750 hover:border-amber-500/30 text-stone-800 dark:text-stone-200 transition-all cursor-pointer group active:scale-[0.99]"
                  >
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 block mb-0.5">Garantías</span>
                    <span className="font-medium text-xs sm:text-sm text-stone-800 dark:text-stone-100 group-hover:text-amber-800 dark:group-hover:text-amber-300">
                      "¿Cuáles son los requisitos obligatorios para tramitar una garantía?"
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message Bubbles List */}
          {messages.map((message) => {
            const isUser = message.role === 'user';

            if (isUser) {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[88%] sm:max-w-[78%] bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900 rounded-[22px] rounded-br-sm px-4 sm:px-5 py-3 sm:py-3.5 shadow-xs space-y-2">
                    {message.attachedFile && (
                      <div className="p-2 rounded-xl bg-stone-800 text-stone-200 dark:bg-stone-200 dark:text-stone-800 flex items-center gap-2 text-xs">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-amber-400 dark:text-amber-700" />
                        <span className="font-medium truncate">{message.attachedFile.name}</span>
                        {message.attachedFile.size && (
                          <span className="text-[10px] text-stone-400 dark:text-stone-600 ml-auto shrink-0">
                            {(message.attachedFile.size / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-[14px] sm:text-[15px] whitespace-pre-wrap leading-relaxed font-normal">
                      {message.text}
                    </p>
                  </div>
                </div>
              );
            }

            // Assistant message - Apple Clean Card
            return (
              <div key={message.id} className="flex flex-col space-y-2">
                <div className="max-w-[94%] sm:max-w-[88%] bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-[24px] rounded-bl-sm p-5 sm:p-6 shadow-xs">
                  {/* Bubble Header with Copy Button */}
                  <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-stone-100 dark:border-stone-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        Respuesta Oficial • Super Redes
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(message.text, message.id)}
                      className="min-h-[32px] inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/70 dark:hover:bg-stone-750 transition-colors cursor-pointer border border-stone-200/70 dark:border-stone-700 active:scale-95"
                      title="Copiar texto de la respuesta"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Dual message or standard format */}
                  {(() => {
                    const parsed = parseDualResponse(message.text);
                    if (parsed.isDual && parsed.clientMessage && parsed.advisorMessage) {
                      return (
                        <div className="space-y-4 my-1">
                          {/* 1. Tarjeta: Mensaje para el Cliente (Plantilla Oficial del Asesor) */}
                          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 sm:p-5 shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-emerald-500/15">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                                  📲 Mensaje para el Cliente (Plantilla del Asesor)
                                </span>
                                <span className="hidden sm:inline-block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                  Plantilla Oficial • Lista para WhatsApp
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => copyClientMessage(parsed.clientMessage!, message.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-stone-800 hover:bg-emerald-100/70 dark:hover:bg-stone-700 transition-all border border-emerald-300/80 dark:border-emerald-700/60 shadow-2xs active:scale-95 cursor-pointer ml-auto"
                                title="Copiar plantilla para enviarla al cliente"
                              >
                                {copiedClientMsgId === message.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-emerald-700 dark:text-emerald-400">¡Plantilla copiada!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Copiar Plantilla al Cliente</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="text-stone-800 dark:text-stone-100">
                              <FormattedText content={parsed.clientMessage} isDark={isDarkMode} />
                            </div>
                          </div>

                          {/* 2. Tarjeta: Guía y Razonamiento para el Asesor */}
                          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-4 sm:p-5 shadow-2xs">
                            <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-amber-500/15">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                                🛠️ Guía y Razonamiento para el Asesor
                              </span>
                              <span className="text-[10px] font-medium text-amber-800 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                                Uso Interno • Qué hacer y por qué
                              </span>
                            </div>

                            <div className="text-stone-800 dark:text-stone-100">
                              <FormattedText content={parsed.advisorMessage} isDark={isDarkMode} />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return <FormattedText content={message.text} isDark={isDarkMode} />;
                  })()}

                  {message.isRateLimited && (
                    <div className="mt-3 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-center gap-2 font-medium">
                      <span>⏳</span>
                      <span>Límite temporal alcanzado. Por favor espera un momento antes de formular otra pregunta.</span>
                    </div>
                  )}

                  {message.isError && (
                    <div className="mt-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Ocurrió un inconveniente al consultar la base. Por favor reintenta en unos instantes.</span>
                    </div>
                  )}

                  {/* Related Media Section */}
                  {message.relatedMedia && message.relatedMedia.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Recursos técnicos multimedia</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {message.relatedMedia.map((media, mIdx) => {
                          if (media.type === 'image') {
                            return (
                              <div
                                key={mIdx}
                                className="group p-2.5 rounded-2xl border border-stone-200 dark:border-stone-750 bg-stone-50/60 dark:bg-stone-850 hover:border-amber-500/40 transition-all space-y-2 flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100 mb-0.5">
                                    <ImageIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="truncate">{media.title}</span>
                                  </div>
                                  {media.description && (
                                    <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2">
                                      {media.description}
                                    </p>
                                  )}
                                </div>

                                <a
                                  href={media.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 aspect-video bg-black/5"
                                >
                                  <img
                                    src={media.thumbnail || media.url}
                                    alt={media.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                    <span className="px-2 py-1 bg-white/95 dark:bg-stone-900/95 rounded-lg text-[10px] font-medium text-stone-900 dark:text-white shadow-xs">
                                      Ver original
                                    </span>
                                  </div>
                                </a>
                              </div>
                            );
                          }

                          // Video or Link
                          return (
                            <a
                              key={mIdx}
                              href={media.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 rounded-2xl border border-stone-200 dark:border-stone-750 bg-stone-50/60 dark:bg-stone-850 hover:bg-stone-100/70 dark:hover:bg-stone-800 transition-all flex items-start gap-2.5 group"
                            >
                              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1 text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400">
                                  <span className="truncate">{media.title}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </div>
                                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                                  {media.description || media.url}
                                </p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Source Badge below the response */}
                {message.source && (
                  <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-stone-500 dark:text-stone-400">
                    <span className="font-medium text-stone-600 dark:text-stone-400">Fuente:</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-normal border border-stone-300/60 dark:border-stone-700 max-w-full truncate">
                      {message.source.startsWith('http') ? (
                        <Globe className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
                      ) : (
                        <FileText className="w-3 h-3 text-stone-500 dark:text-stone-400 shrink-0" />
                      )}
                      {message.source.startsWith('http') ? (
                        <a
                          href={message.source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-amber-700 dark:hover:text-amber-400 truncate inline-flex items-center gap-1"
                        >
                          <span className="truncate">{message.source}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="truncate">{message.source}</span>
                      )}
                    </div>
                    {message.contingency && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-medium border border-amber-500/20">
                        Búsqueda interna
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Three animated dots bubble when searching */}
          {isLoading && (
            <div className="flex flex-col space-y-2">
              <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl rounded-tl-xs p-3.5 shadow-xs max-w-[260px]">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 dark:bg-amber-500/15 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-dot-1"></span>
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-dot-2"></span>
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-dot-3"></span>
                  </div>
                  <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                    Buscando en documentos...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Bottom Input Area (Apple Floating Bar) */}
      <footer className="bg-[#FAF8F5]/90 dark:bg-stone-950/90 backdrop-blur-md border-t border-stone-200/60 dark:border-stone-800 px-4 sm:px-6 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom,0px))] shrink-0 z-10">
        <div className="max-w-[820px] mx-auto w-full space-y-2">
          {/* Quick Suggestions Chips Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            <button
              type="button"
              onClick={() => setIsTemplatesOpen(true)}
              className="min-h-[32px] inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs"
              title="Abrir catálogo oficial de plantillas"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mr-1.5" />
              <span>📋 Ver Plantillas del Asesor</span>
            </button>

            {QUICK_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSendMessage(sug.query)}
                disabled={isLoading}
                className="min-h-[32px] inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full bg-white dark:bg-stone-850 hover:bg-amber-500/10 dark:hover:bg-stone-800 border border-stone-200/70 dark:border-stone-750 text-stone-700 dark:text-stone-300 text-xs font-normal transition-all cursor-pointer disabled:opacity-50 active:scale-95 shrink-0 shadow-2xs"
              >
                {sug.label}
              </button>
            ))}
          </div>

          {/* Hidden File Input for Chat Attachments */}
          <input
            ref={chatFileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processFileAttachment(e.target.files[0]);
                e.target.value = '';
              }
            }}
            className="hidden"
          />

          {/* Reading attachment indicator */}
          {isReadingAttachment && (
            <div className="flex items-center gap-2 p-2 px-3 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 rounded-2xl text-xs text-amber-900 dark:text-amber-200 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-600" />
              <span className="font-medium">Analizando archivo adjunto con IA...</span>
            </div>
          )}

          {/* Attached file chip */}
          {attachedFile && !isReadingAttachment && (
            <div className="flex items-center justify-between gap-2 p-2 px-3 bg-white dark:bg-stone-850 border border-amber-500/30 rounded-2xl text-xs text-stone-800 dark:text-stone-200 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="font-semibold truncate">{attachedFile.name}</span>
                {attachedFile.size && (
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">
                    ({(attachedFile.size / 1024).toFixed(0)} KB)
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-medium shrink-0">
                  ✓ Leído
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                title="Quitar archivo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attachment error alert */}
          {attachmentError && (
            <div className="flex items-center justify-between gap-2 p-2 px-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{attachmentError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentError(null)}
                className="text-xs font-semibold hover:underline"
              >
                ✕
              </button>
            </div>
          )}

          {/* Text Input Floating Form - Apple Style */}
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-white dark:bg-stone-900 rounded-2xl border border-stone-300/80 dark:border-stone-750 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-500/10 shadow-xs transition-all p-1.5"
          >
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => chatFileInputRef.current?.click()}
              disabled={isLoading || isReadingAttachment}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0 disabled:opacity-40"
              title="Adjuntar archivo o imagen técnica"
              aria-label="Adjuntar archivo"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={attachedFile ? `Pregunta sobre "${attachedFile.name}"...` : "Escribe tu consulta sobre procedimientos, pagos o soporte..."}
              rows={1}
              disabled={isLoading}
              className="w-full resize-none bg-transparent px-2 py-1.5 text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-hidden max-h-32 min-h-[38px] leading-relaxed"
            />

            <button
              type="submit"
              disabled={(!input.trim() && !attachedFile) || isLoading || isReadingAttachment}
              className="h-9 px-3.5 rounded-xl inline-flex items-center justify-center gap-1.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-200 dark:disabled:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 disabled:text-stone-400 dark:disabled:text-stone-600 font-medium text-xs transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed active:scale-95 shrink-0"
              aria-label="Enviar consulta"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>

          <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 px-1 gap-1">
            <span>Presiona <strong>Enter</strong> para enviar, <strong>Shift + Enter</strong> para salto de línea.</span>
            <span>Super Redes • Asistencia Técnica</span>
          </div>
        </div>
      </footer>

      {/* Official Advisor Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onUseTemplateInChat={(query) => {
          onSendMessage(query);
        }}
        isDark={isDarkMode}
      />
    </div>
  );
};
