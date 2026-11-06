import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X, LucideIcon, Inbox, RefreshCw } from 'lucide-react';
import { useParent } from '../context/ParentContext';
import { BrandLoader } from './common/BrandLoader';

/* Modal — same structure and styling as the Student portal dialog */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm print:static print:block print:bg-white print:p-0 print:backdrop-blur-none">
      <div className={`bg-card w-full ${maxWidth} rounded-lg shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-0 print:max-w-none`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 print:hidden">
          <h3 className="font-headings font-bold text-base text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-sm hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto print:overflow-visible">{children}</div>
      </div>
    </div>
  );
}

export function Toast() {
  const { toastMessage, clearToast } = useParent();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(clearToast, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;
  const Icon = toastMessage.type === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-navy text-white px-5 py-3.5 rounded-md shadow-lg border border-border/20 print:hidden">
      <Icon className={`w-5 h-5 shrink-0 ${toastMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
      <span className="text-sm font-medium">{toastMessage.text}</span>
      <button onClick={clearToast} className="ml-3 text-white/60 hover:text-white cursor-pointer" aria-label="Dismiss">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  colorScheme = 'primary',
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  colorScheme?: 'primary' | 'success' | 'warning' | 'secondary' | 'error';
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    secondary: 'bg-secondary text-secondary-foreground',
    error: 'bg-error-bg text-error',
  };

  return (
    <div className="bg-card border border-border rounded-md p-4 flex gap-3 items-start shadow-sm">
      <div className={`w-10 h-10 rounded-sm flex items-center justify-center shrink-0 ${colorMap[colorScheme]}`}>
        <Icon className="w-5 h-5 stroke-[2.2]" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground font-medium">{title}</div>
        <div className="font-headings font-bold text-foreground text-xl leading-tight mt-0.5">{value}</div>
        {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

export function StatusChip({ status, className = '' }: { status: string; className?: string }) {
  const s = status?.toLowerCase() || '';
  const style =
    ['present', 'paid', 'graded', 'submitted', 'approved', 'verified', 'published'].includes(s)
      ? 'bg-success-bg text-success'
      : ['pending', 'pending verification', 'partially paid', 'in review', 'returned'].includes(s)
      ? 'bg-warning-bg text-warning'
      : ['absent', 'overdue', 'unpaid', 'rejected', 'not submitted'].includes(s)
      ? 'bg-error-bg text-error'
      : s === 'late'
      ? 'bg-amber-100 text-amber-700'
      : s === 'excused'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-muted text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${style} ${className}`}>
      {status}
    </span>
  );
}

export function LoadingBlock({ message = 'Loading records...' }: { message?: string }) {
  return (
    <div className="w-full py-10 flex flex-col items-center justify-center">
      <BrandLoader message={message} subtext="Cambridge Education System" size="sm" />
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-error-bg/50 border border-error/20 rounded-md p-8 text-center shadow-sm">
      <AlertCircle className="w-6 h-6 text-error mx-auto mb-2" />
      <div className="text-sm font-semibold text-error">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold bg-card border border-border rounded-sm px-3 py-1.5 hover:bg-muted cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ title, description }: { title: string; description?: string }) {
  return (
    <div className="bg-card border border-dashed border-border rounded-md p-10 text-center shadow-sm">
      <Inbox className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description && <div className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{description}</div>}
    </div>
  );
}

/** Wraps a child-specific page with the shared "no child linked" empty state. */
export function RequireChild({ children }: { children: React.ReactNode }) {
  const { selectedChild, dashboardLoading, dashboardError, refreshDashboard, dashboard } = useParent();
  if (dashboardLoading && !dashboard) return <LoadingBlock message="Loading your children's records…" />;
  if (dashboardError) return <ErrorBlock message={dashboardError} onRetry={refreshDashboard} />;
  if (!selectedChild) {
    return (
      <EmptyBlock
        title="No child is linked to your account yet"
        description="Once the school verifies your account and links your child's admission record, their attendance, fees and results will appear here. Please contact the school office if this takes longer than expected."
      />
    );
  }
  return <>{children}</>;
}
