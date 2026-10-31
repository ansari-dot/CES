import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg"
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-200 print:static print:block print:bg-white print:p-0 print:backdrop-blur-none">
      <div className={`bg-card w-full ${maxWidth} rounded-lg shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:max-h-none print:border-0 print:rounded-none print:shadow-none print:overflow-visible`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 print:hidden">
          <h3 className="font-headings font-bold text-base text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-sm hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible">
          {children}
        </div>
      </div>
    </div>
  );
}
