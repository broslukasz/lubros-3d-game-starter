import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary captured error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-800/60 bg-red-950/30 p-8 text-center my-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-red-200">
            {this.props.fallbackMessage || 'Wystąpił problem z wyświetleniem zawartości'}
          </h3>
          <p className="text-xs text-red-300/80 mt-1 max-w-md mx-auto">
            {this.state.error?.message || 'Błąd renderowania grafiki 3D. Twój model może posiadać niestandardowe rozszerzenia.'}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Zresetuj i załaduj ponownie
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
