import React from 'react';

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RouteErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-10 w-10 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">This section failed to load</h2>
          <p className="text-text-secondary mb-4 text-sm">
            Something went wrong rendering this page. You can try reloading it.
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
