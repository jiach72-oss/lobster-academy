'use client';

import { Component, ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4" style={{ color: '#d4a853' }}>出了点问题</h1>
            <p style={{ color: '#9ca3af' }}>请刷新页面重试</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
