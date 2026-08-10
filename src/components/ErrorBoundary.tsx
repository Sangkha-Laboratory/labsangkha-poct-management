import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, Trash2 } from 'lucide-react';

export interface ErrorBoundaryProps {
  children?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      showDetails: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught error in React ErrorBoundary:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleClearCacheAndReload = (): void => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  toggleDetails = (): void => {
    this.setState((prevState) => ({ showDetails: !prevState.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans">
          <div className="max-w-xl w-full bg-slate-800 rounded-2xl shadow-2xl border border-rose-500/30 p-6 space-y-5">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">เกิดข้อผิดพลาดในการรันแอปพลิเคชัน (React Error)</h2>
                <p className="text-xs text-rose-300">ระบบหยุดทำงานชั่วคราวเพื่อป้องกันข้อมูลเสียหาย</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs text-rose-300 overflow-x-auto">
              <p className="font-semibold text-rose-400 mb-1">Error Message:</p>
              <p>{this.state.error?.message || 'Unknown Error'}</p>
            </div>

            {this.state.showDetails && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-400 overflow-x-auto max-h-60 space-y-2">
                <p className="text-slate-200 font-semibold">Stack Trace:</p>
                <pre className="whitespace-pre-wrap leading-relaxed">{this.state.error?.stack || 'No stack trace available'}</pre>
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500">
                  <p>URL: {window.location.href}</p>
                  <p>UserAgent: {navigator.userAgent}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Terminal size={14} />
                <span>{this.state.showDetails ? 'ซ่อน Debug Trace' : 'ดู Debug Trace'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={this.handleClearCacheAndReload}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-950/50 text-rose-300 border border-rose-800/40 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  title="ล้างข้อมูลแคชชั่วคราวแล้วโหลดใหม่"
                >
                  <Trash2 size={14} />
                  <span>ล้าง Cache</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg shadow-md transition-colors cursor-pointer"
                >
                  <RefreshCw size={14} />
                  <span>รีโหลด</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
