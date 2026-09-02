import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-h)' }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: '#ef4444', marginBottom: '16px' }}>
            {this.state.error?.toString()}
          </p>
          <button 
            className="btn-primary" 
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
