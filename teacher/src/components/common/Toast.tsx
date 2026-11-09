import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { removeToast } from '../../store/slices/uiSlice';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.ui.toasts);

  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => {
      dispatch(removeToast(latest.id));
    }, 3500);

    return () => clearTimeout(timer);
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-[#191847] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200 border border-indigo-400/20"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-blue-300 shrink-0" />
          )}
          <div className="flex flex-col text-left">
            {toast.title && (
              <span className="font-bold text-xs text-white">{toast.title}</span>
            )}
            <span className="font-medium text-xs text-slate-200">{toast.message}</span>
          </div>
          <button
            onClick={() => dispatch(removeToast(toast.id))}
            className="text-slate-400 hover:text-white transition-colors ml-2 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
