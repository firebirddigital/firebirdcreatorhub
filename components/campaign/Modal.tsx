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
        className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-y-auto border-2 border-fb-black bg-fb-white p-0 text-fb-black backdrop:bg-fb-black/60"
      >
        <div className="p-6 max-sm:p-4">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="headline text-2xl">{title}</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold underline underline-offset-4 hover:text-fb-red">
              Close
            </button>
          </div>
          {/* Mounted only while open, so each opening starts fresh. */}
          {open && children}
        </div>
      </dialog>
    </>
  );
}
