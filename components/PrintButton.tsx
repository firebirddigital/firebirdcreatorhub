"use client";

/** Opens the browser's print dialog, where "Save as PDF" makes the report file. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="subtitle shrink-0 border-2 border-fb-red bg-fb-red text-fb-white px-5 py-2.5 text-sm hover:bg-fb-black hover:border-fb-black transition-colors"
    >
      Download PDF
    </button>
  );
}
