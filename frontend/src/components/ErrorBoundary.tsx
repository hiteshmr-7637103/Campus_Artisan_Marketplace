import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Last-resort catch so a render error shows a message, never a blank white page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Something broke on this page</h1>
          <p className="mt-2 text-sm text-ink/70">
            Try reloading. If it keeps happening, let the founders know.
          </p>
          <button className="btn-primary mt-4" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
