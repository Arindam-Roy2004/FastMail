import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-[15px] font-medium text-ink">Something broke on this page</p>
        <p className="max-w-md text-[13px] text-muted">{this.state.error.message}</p>
        <button type="button" className="mt-2 text-sm font-medium text-brand hover:underline" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
