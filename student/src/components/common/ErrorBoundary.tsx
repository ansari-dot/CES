import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  /** Changing this value (e.g. the current path) clears a previous error. */
  resetKey?: string;
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches a rendering error so the portal shows a message instead of a blank white page.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">This page could not be displayed</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Something went wrong while showing this page. Any answers already saved are safe. Please reload and try again.
          </p>
          <p className="text-[11px] font-mono text-slate-400 break-words">{this.state.error.message}</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.assign('/student/dashboard')}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
