import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App error captured:", error, info.componentStack);
  }

  handleGoHome = () => {
    window.location.assign("/");
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-fallback" role="alert">
          <h2>出了点问题</h2>
          <p>应用刚才出错了，本地数据仍然安全。可以尝试返回主界面或重新加载。</p>
          <pre className="error-fallback-detail">{this.state.error.message}</pre>
          <div className="error-fallback-actions">
            <button className="primary-btn" onClick={this.handleGoHome}>返回主界面</button>
            <button className="ghost-btn" onClick={this.handleReload}>重新加载</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
