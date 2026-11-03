"use client";

/** Opens the browser's print dialog, where "Save as PDF" makes the report file. */
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-primary shrink-0">
      Download PDF
    </button>
  );
}
