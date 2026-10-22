import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { clearToast } from '../../store/slices/studentSlice';

export default function Toast() {
  const dispatch = useDispatch();
  const toastMessage = useSelector((state: RootState) => state.student.toastMessage);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        dispatch(clearToast());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, dispatch]);

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-navy text-white px-5 py-3.5 rounded-md shadow-lg border border-border/20 animate-in slide-in-from-bottom duration-200">
      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      <span className="text-sm font-medium">{toastMessage}</span>
      <button
        onClick={() => dispatch(clearToast())}
        className="ml-3 text-white/60 hover:text-white cursor-pointer"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
