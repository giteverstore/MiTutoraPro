import { Component } from 'react';

export class AdminErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) {
    if (import.meta.env.DEV) console.error('[Y Coders Admin] UI error', error);
  }

  render() {
    if (this.state.failed) {
      return <main className="admin-state-page"><section className="admin-state-card" role="alert"><span className="admin-eyebrow">Y Coders Admin</span><h1>Admin could not be displayed</h1><p>Reload the page and try again. No content changes were made.</p><button type="button" onClick={() => window.location.reload()}>Reload</button></section></main>;
    }
    return this.props.children;
  }
}
