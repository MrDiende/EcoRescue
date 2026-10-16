import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { error: null, componentStack: '' };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info.componentStack ?? '' });
    console.error('EcoRescue page failed to render:', error, info.componentStack);
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <section
          aria-labelledby="render-error-title"
          className="w-full max-w-2xl rounded-3xl border border-red-200 bg-white p-6 shadow-xl sm:p-8"
          role="alert"
        >
          <h1 id="render-error-title" className="text-xl font-bold text-gray-900">
            EcoRescue couldn’t open this page
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            A page error occurred. Reload once; if it happens again, share this error with the app
            administrator.
          </p>
          <pre className="mt-4 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-red-50 p-3 text-sm text-red-900">
            {error.message || 'Unknown page error'}
          </pre>
          {componentStack && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-700">
                Technical details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                {componentStack}
              </pre>
            </details>
          )}
          <button
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload EcoRescue
          </button>
        </section>
      </main>
    );
  }
}
