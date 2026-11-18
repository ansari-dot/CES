import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Printer, Loader2 } from 'lucide-react';

interface Props {
  title: string;
  /** Loads the PDF; called when the modal opens. */
  load: () => Promise<Blob>;
  fileName?: string;
  onClose: () => void;
}

/** Shows a server-generated certificate PDF with print and download actions. */
export const CertificatePdfModal: React.FC<Props> = ({ title, load, fileName, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    load()
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch((err: any) => !cancelled && setError(err?.message || 'Could not load the certificate.'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // load is intentionally read once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName || 'certificate.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 bg-[#1b1a47] text-white flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold truncate">{title}</h2>
          <div className="flex items-center gap-1.5 shrink-0">
            {fileName && (
              <button
                type="button"
                disabled={!blob}
                onClick={download}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            )}
            <button
              type="button"
              disabled={!url}
              onClick={() => frame.current?.contentWindow?.print()}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100">
          {error ? (
            <div className="h-full flex items-center justify-center text-sm text-rose-700 px-6 text-center">{error}</div>
          ) : url ? (
            <iframe ref={frame} src={url} title={title} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
