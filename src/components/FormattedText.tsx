import React, { useState } from 'react';
import { ExternalLink, Copy, Check, CreditCard, Globe } from 'lucide-react';

interface FormattedTextProps {
  content: string;
  className?: string;
  isDark?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className = '' }) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  };

  const isPaymentLink = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('pago') || lower.includes('pay') || lower.includes('checkout') || lower.includes('pse') || lower.includes('tarjeta') || lower.includes('factura');
  };

  const urlRegex = /(https?:\/\/[^\s<>)"]+)/g;
  const lines = content.split('\n');

  // Track rendered payment cards to avoid duplicate cards if mentioned inline
  const renderedPaymentUrls = new Set<string>();

  const renderInline = (text: string) => {
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        let cleanUrl = part;
        let trailingPunct = '';
        if (/[.,;:)]$/.test(cleanUrl)) {
          trailingPunct = cleanUrl.slice(-1);
          cleanUrl = cleanUrl.slice(0, -1);
        }

        // If it's a payment link, we render a standalone payment card below or inline
        if (isPaymentLink(cleanUrl)) {
          renderedPaymentUrls.add(cleanUrl);
          return (
            <React.Fragment key={index}>
              <div className="my-3 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 shadow-xs">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-300 block">
                      Enlace de Pago Oficial
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 truncate block">
                      {cleanUrl}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <a
                    href={cleanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[40px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 dark:bg-amber-600 dark:hover:bg-amber-700 active:scale-[0.98] text-white font-medium text-xs shadow-xs transition-all cursor-pointer select-none"
                  >
                    <span>Abrir enlace</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => copyUrl(cleanUrl)}
                    className="min-h-[40px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 border border-stone-200/80 dark:border-stone-700 font-medium text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer select-none"
                  >
                    {copiedUrl === cleanUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 dark:text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar enlace</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              {trailingPunct}
            </React.Fragment>
          );
        }

        // Standard link card
        return (
          <React.Fragment key={index}>
            <span className="inline-flex items-center gap-1.5 my-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 dark:bg-stone-800 border border-amber-500/20 dark:border-stone-700 align-middle text-xs">
              <Globe className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-800 dark:text-amber-300 hover:underline break-all"
              >
                {cleanUrl}
              </a>
              <button
                type="button"
                onClick={() => copyUrl(cleanUrl)}
                className="p-1 hover:bg-amber-200/40 dark:hover:bg-stone-700 rounded-md text-stone-500 dark:text-stone-400 ml-0.5 cursor-pointer"
                title="Copiar enlace"
              >
                {copiedUrl === cleanUrl ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </span>
            {trailingPunct}
          </React.Fragment>
        );
      }

      // Parse bold markdown **text**
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={index}>
          {boldParts.map((subPart, subIdx) => {
            if (subPart.startsWith('**') && subPart.endsWith('**')) {
              return (
                <strong key={subIdx} className="font-semibold text-stone-900 dark:text-stone-100">
                  {subPart.slice(2, -2)}
                </strong>
              );
            }
            return subPart;
          })}
        </span>
      );
    });
  };

  return (
    <div className={`space-y-2 text-[14px] sm:text-[15px] leading-relaxed text-stone-800 dark:text-stone-200 font-normal ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2.5 ml-1">
              <span className="text-amber-700 dark:text-amber-400 font-bold leading-6 select-none">•</span>
              <div className="flex-1">{renderInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-1">
              <span className="font-semibold text-amber-700 dark:text-amber-400 min-w-[1.2rem] select-none text-xs leading-5">
                {numMatch[1]}.
              </span>
              <div className="flex-1">{renderInline(numMatch[2])}</div>
            </div>
          );
        }

        return (
          <p key={idx} className="leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
};
