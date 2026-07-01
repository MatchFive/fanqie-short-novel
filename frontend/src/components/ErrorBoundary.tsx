import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-3xl opacity-30">⚠️</div>
          <p className="text-sm font-semibold">页面出现了意外错误</p>
          <p className="text-xs text-muted-foreground max-w-md text-center">
            {this.state.error?.message || '未知错误'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-[13px] border border-primary bg-primary text-primary-foreground rounded-sm cursor-pointer hover:opacity-85"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
