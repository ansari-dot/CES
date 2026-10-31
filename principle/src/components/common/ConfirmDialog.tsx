import React, { useState } from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  message: string;
  requireReason?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  requireReason = true,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isDestructive = false,
  loading = false
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError('A documented administrative justification is required for this action.');
      return;
    }
    setError('');
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} maxWidth="md">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              isDestructive
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">{message}</div>
        </div>

        {requireReason && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-700">
              Audit Justification / Administrative Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              rows={3}
              placeholder="State the operational reason for this action (recorded in immutable audit log)..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white resize-none"
            />
            {error && <span className="text-xs text-rose-600 font-medium">{error}</span>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg text-white transition-colors flex items-center gap-1.5 shadow-xs ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 disabled:bg-rose-300'
                : 'bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300'
            }`}
          >
            {loading && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
