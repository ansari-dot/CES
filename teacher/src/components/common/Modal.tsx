import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  iconBgColor?: string;
  maxWidth?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconBgColor = 'bg-[#cdd4fb] text-[#36348e]',
  maxWidth = 'max-w-xl',
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`bg-white rounded-2xl w-full ${maxWidth} p-4 sm:p-6 shadow-2xl transform animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto border border-slate-100`}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {icon && (
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgColor}`}
              >
                <span className="material-symbols-outlined text-[22px]">{icon}</span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold text-[#292929] leading-snug">{title}</h3>
              {subtitle && <p className="text-xs text-[#545454] mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
