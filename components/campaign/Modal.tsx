"use client";

import { useEffect, useRef, useState } from "react";

/** A button that opens its content in a popup. Escape, the close button or a click outside closes it. */
export function ModalButton({
  label,
  title,
  className,
  disabled,
  children,
}: {
  label: string;
  title: string;
  className: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled} className={className}>
        {label}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        aria-label={title}
        className="sheet m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3.5">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.08em]">{title}</h2>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet btn-sm">
            Close
          </button>
        </div>
        <div className="p-5 max-sm:p-4">
          {/* Mounted only while open, so each opening starts fresh. */}
          {open && children}
        </div>
      </dialog>
    </>
  );
}
