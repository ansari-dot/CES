import React, { useRef, useState } from 'react';
import { ScrollText, Eye, Download, Printer, RefreshCw } from 'lucide-react';
import Modal from '../common/Modal';

export interface StudentCertificate {
  id: number;
  certificateNumber: string;
  certificateTitle: string;
  categoryName: string;
  achievementTitle: string;
  achievementDescription: string | null;
  subjectName: string | null;
  academicYear: string | null;
  issueDate: string;
  issuedBy: string;
  status: 'ACTIVE' | 'REVOKED';
  pdfUrl: string;
}

const formatDate = (v: string) =>
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * Certificates issued to the signed-in student. PDFs are served by an authenticated
 * endpoint that only returns the student's own active certificates.
 */
export default function CertificatesSection({
  items,
  loading,
  error,
  onRetry
}: {
  items: StudentCertificate[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState<StudentCertificate | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  if (loading) {
    return <div className="bg-card border border-border rounded-md p-8 text-center text-sm text-muted-foreground">Loading certificates…</div>;
  }
  if (error) {
    return (
      <div className="bg-card border border-border rounded-md p-8 text-center text-sm space-y-3">
        <p className="text-error">{error}</p>
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-sm bg-muted hover:bg-secondary cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-md p-8 text-center text-sm text-muted-foreground">
        You have not received any certificates yet. Certificates your teachers award will appear here.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-md p-4 shadow-sm flex gap-3.5">
            <div className={`w-11 h-11 rounded-sm flex items-center justify-center shrink-0 ${c.status === 'REVOKED' ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700'}`}>
              <ScrollText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-bold text-foreground">{c.certificateTitle}</div>
                {c.status === 'REVOKED' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0">Revoked</span>
                )}
              </div>
              <div className="text-[11px] font-semibold text-primary">{c.categoryName}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {c.achievementTitle}
                {c.achievementDescription ? ` — ${c.achievementDescription}` : ''}
              </div>
              <div className="text-[11px] text-muted-foreground/80">
                {[formatDate(c.issueDate), `Issued by ${c.issuedBy}`, c.subjectName].filter(Boolean).join(' · ')}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">ID {c.certificateNumber}</div>
              {c.status === 'ACTIVE' ? (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setOpen(c)}
                    className="text-xs font-bold px-3 py-1.5 rounded-sm bg-muted hover:bg-secondary text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <a
                    href={`${c.pdfUrl}?download=1`}
                    className="text-xs font-bold px-3 py-1.5 rounded-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </a>
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground pt-1">This certificate was withdrawn by the school.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal isOpen onClose={() => setOpen(null)} title={open.certificateTitle} maxWidth="max-w-5xl">
          <div className="space-y-3">
            <iframe ref={frame} src={open.pdfUrl} title={open.certificateTitle} className="w-full h-[70vh] border border-border rounded-sm bg-muted" />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => frame.current?.contentWindow?.print()}
                className="text-xs font-bold px-3 py-1.5 rounded-sm bg-muted hover:bg-secondary flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <a href={`${open.pdfUrl}?download=1`} className="text-xs font-bold px-3 py-1.5 rounded-sm bg-primary text-white flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
