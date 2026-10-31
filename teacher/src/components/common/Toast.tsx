import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { removeToast } from '../../store/slices/uiSlice';

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
          className="pointer-events-auto bg-[#292929] text-[#f9f9fc] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all transform animate-in fade-in slide-in-from-bottom-2 duration-200 border border-slate-700/50"
        >
          {toast.type === 'success' && (
            <span className="material-symbols-outlined text-[#4edea3] text-[20px]">
              check_circle
            </span>
          )}
          {toast.type === 'error' && (
            <span className="material-symbols-outlined text-[#ff8080] text-[20px]">
              error
            </span>
          )}
          {toast.type === 'info' && (
            <span className="material-symbols-outlined text-[#a5a4db] text-[20px]">
              info
            </span>
          )}
          <div className="flex flex-col text-left">
            {toast.title && (
              <span className="font-bold text-xs text-white">{toast.title}</span>
            )}
            <span className="font-medium text-xs text-slate-200">{toast.message}</span>
          </div>
          <button
            onClick={() => dispatch(removeToast(toast.id))}
            className="text-slate-400 hover:text-white transition-colors ml-2"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};
