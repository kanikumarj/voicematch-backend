import { Component } from 'react';

/**
 * ErrorBoundary — catches React render errors in the call subtree.
 * Prevents a WebRTC hook crash from taking down the entire app.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <CallScreen ... />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface to error monitoring (Phase 5 → Sentry)
    process?.stderr?.write?.(`[ErrorBoundary] ${error.message}\n${info.componentStack}\n`);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      this.props.fallback ?? (
        <div style={styles.container}>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button style={styles.btn} onClick={() => this.handleReset()}>
            Try Again
          </button>
        </div>
      )
    );
  }
}

const styles = {
  container: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100vh',
    background:     '#0d0d1a',
    color:          '#e8e8f0',
    fontFamily:     'Inter, sans-serif',
    gap:            '1rem',
  },
  title:   { fontSize: '1.4rem', margin: 0 },
  message: { color: '#9090b0', fontSize: '0.95rem', margin: 0 },
  btn: {
    padding:      '0.6rem 1.4rem',
    borderRadius: '10px',
    border:       'none',
    background:   '#7c6af7',
    color:        '#fff',
    fontSize:     '0.9rem',
    cursor:       'pointer',
  },
};
