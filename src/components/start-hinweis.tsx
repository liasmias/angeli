"use client";

import { useState } from "react";
import { getDictionary, type Lang } from "@/lib/i18n";

/**
 * Runder, pulsierender Sticker im Hero: Späteinsteiger sollen sofort sehen,
 * dass sie noch mitmachen können. Ein Klick erklärt die Gutschrift-Regel.
 */
export default function StartHinweis({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).home;
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="pulse-badge pressable absolute right-4 top-6 z-10 flex h-28 w-28 -rotate-6 items-center justify-center rounded-full bg-brand-accent p-3 text-center text-[13px] font-bold leading-snug text-brand-deep shadow-lg sm:right-10 sm:top-10 sm:h-36 sm:w-36 sm:text-base"
      >
        {t.startBadge}
      </button>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setOffen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="chamfer w-full max-w-md bg-white p-6 text-brand-deep shadow-xl"
          >
            <h2 className="mb-3 text-lg font-bold">{t.startModalTitle}</h2>
            <p className="text-sm leading-relaxed text-brand-deep/80">{t.startModalText}</p>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="pressable mt-5 rounded-full bg-brand-accent px-5 py-2 text-sm font-bold text-brand-deep"
            >
              {t.startModalClose}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
