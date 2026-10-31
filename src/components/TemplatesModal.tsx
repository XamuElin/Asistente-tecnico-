import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Copy, 
  Check, 
  FileText, 
  MessageSquare, 
  Sparkles, 
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Truck,
  Wrench,
  CreditCard,
  FileCheck2,
  SlidersHorizontal
} from 'lucide-react';
import { ADVISOR_TEMPLATES, AdvisorTemplate } from '../utils/templates';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseTemplateInChat: (query: string) => void;
  isDark?: boolean;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onUseTemplateInChat,
  isDark = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = useMemo(() => [
    { id: 'all', label: 'Todas las Plantillas', icon: SlidersHorizontal },
    { id: 'traslados', label: 'Traslados', icon: Truck },
    { id: 'soporte', label: 'Soporte y LOS', icon: Wrench },
    { id: 'pagos', label: 'Pagos y Facturación', icon: CreditCard },
    { id: 'contratos', label: 'Cesión y Contratos', icon: FileCheck2 },
    { id: 'garantias', label: 'Garantías', icon: ShieldAlert },
    { id: 'protocolo', label: 'Protocolo y Cierre', icon: MessageSquare },
  ], []);

  const filteredTemplates = useMemo(() => {
    return ADVISOR_TEMPLATES.filter((tpl) => {
      const matchCat = selectedCategory === 'all' || tpl.category === selectedCategory;
      if (!matchCat) return false;

      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      return (
        tpl.title.toLowerCase().includes(q) ||
        tpl.shortDesc.toLowerCase().includes(q) ||
        tpl.clientTemplate.toLowerCase().includes(q) ||
        tpl.advisorGuidance.toLowerCase().includes(q)
      );
    });
  }, [searchTerm, selectedCategory]);

  const handleCopy = async (tpl: AdvisorTemplate) => {
    try {
      await navigator.clipboard.writeText(tpl.clientTemplate);
      setCopiedId(tpl.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-[#FAF8F5] dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-4.5 border-b border-stone-200/70 dark:border-stone-800 bg-white/70 dark:bg-stone-900/90 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Plantillas del Asesor para el Cliente
                </h3>
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full">
                  Super Redes
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Guía oficial de respuestas estandarizadas para WhatsApp y chat de soporte
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 sm:p-5 border-b border-stone-200/70 dark:border-stone-800 bg-white/40 dark:bg-stone-900/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar plantilla por motivo (ej. traslado, cobertura, LOS, pago, paz y salvo)..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all shadow-2xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all font-medium cursor-pointer ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-750 border border-stone-200/70 dark:border-stone-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-stone-400 dark:text-stone-500 space-y-2">
              <HelpCircle className="w-9 h-9 mx-auto opacity-50" />
              <p className="text-sm font-medium">No se encontraron plantillas para "{searchTerm}"</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                className="text-xs text-amber-700 dark:text-amber-400 underline font-medium cursor-pointer"
              >
                Ver todas las plantillas
              </button>
            </div>
          ) : (
            filteredTemplates.map((tpl) => {
              const isCopied = copiedId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-850 p-4 sm:p-5 shadow-2xs hover:border-amber-500/40 transition-all flex flex-col gap-3"
                >
                  {/* Template Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">
                          {tpl.categoryLabel}
                        </span>
                        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {tpl.title}
                        </h4>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                        {tpl.shortDesc}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(tpl)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-2xs'
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>¡Copiada!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Plantilla</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          onUseTemplateInChat(tpl.recommendedQuery);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 transition-all cursor-pointer"
                        title="Preguntar a la IA sobre este caso con razonamiento completo"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Analizar con IA</span>
                      </button>
                    </div>
                  </div>

                  {/* Template Body Card (Client Ready) */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/15 p-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Texto listo para enviar al cliente</span>
                    </div>
                    <pre className="text-xs font-sans text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed select-text font-normal">
                      {tpl.clientTemplate}
                    </pre>
                  </div>

                  {/* Advisor Guidance Snippet */}
                  <div className="rounded-xl border border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/15 p-3 text-xs text-stone-700 dark:text-stone-300">
                    <span className="font-semibold text-amber-900 dark:text-amber-300 text-[11px] uppercase tracking-wider block mb-1">
                      🛠️ Guía Rápida para el Asesor:
                    </span>
                    <pre className="text-xs font-sans whitespace-pre-wrap leading-relaxed select-text font-normal">
                      {tpl.advisorGuidance}
                    </pre>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-stone-200/70 dark:border-stone-800 bg-white/70 dark:bg-stone-900/90 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>{filteredTemplates.length} plantilla(s) disponibles para asesores</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
