import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto print:static print:block print:p-0 print:bg-white print:backdrop-blur-none print:overflow-visible">
      <div
        className="fixed inset-0 print:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${maxWidthClasses} bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden my-8 print:static print:max-w-none print:border-0 print:rounded-none print:shadow-none print:my-0 print:overflow-visible`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/60 print:hidden">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-4"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[82vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible">{children}</div>
      </div>
    </div>
  );
};
