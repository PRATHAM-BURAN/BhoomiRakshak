import React from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CRITICAL UI ERROR BOUNDARY]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.removeItem('bhoomi_token');
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-600/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400 shadow-lg shadow-rose-950/50">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-rose-400 block">
                Disaster Sentinel System Exception
              </span>
              <h1 className="text-xl font-black text-white mt-1">
                BhoomiRakshak Safe Mode Active
              </h1>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                An unexpected client-side rendering exception was intercepted. The sentinel caught the error to protect mission-critical telemetry states.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-black/50 border border-white/10 rounded-lg p-3 overflow-x-auto text-[11px] font-mono text-rose-300 max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full sm:w-auto py-2.5 px-4 bg-white/10 hover:bg-white/20 text-slate-300 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors border border-white/10"
              >
                <Home className="w-4 h-4" />
                <span>Reset Cache & Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
