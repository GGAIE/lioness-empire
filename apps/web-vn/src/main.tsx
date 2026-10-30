import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="loading">
        <h1>閱讀器暫時中斷</h1>
        <p>{this.state.error}</p>
        <p>已儲存的進度仍保留在瀏覽器。</p>
        <button onClick={() => location.reload()}>重新載入</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
