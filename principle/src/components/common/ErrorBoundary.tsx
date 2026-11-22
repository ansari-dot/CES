import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Changing this value (e.g. the active module) clears a previous error. */
  resetKey?: string;
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches a rendering error in the current screen so the portal shows a message
 * instead of a blank white page. The sidebar and header stay usable.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Screen error]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-8 text-center max-w-lg mx-auto mt-10 space-y-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">This screen could not be displayed</h3>
        <p className="text-xs text-slate-500">Something went wrong while showing this page. Your data has not been changed.</p>
        <p className="text-[11px] font-mono text-slate-400 break-words">{this.state.error.message}</p>
        <div className="flex justify-center gap-2 pt-1">
          <button onClick={() => this.setState({ error: null })} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">
            Try again
          </button>
          <button onClick={() => window.location.reload()} className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium">
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
