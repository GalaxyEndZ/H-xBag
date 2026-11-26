import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** Last-resort boundary at the React root: errors outside Social must never be a silent blank page. */
export default class AppRuntimeBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HäxBag] Falha ao renderizar a aplicação:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main data-hb-runtime-error role="alert" style={{
        minHeight: '100dvh', display: 'grid', placeItems: 'center',
        padding: '24px', color: '#f0eaf2', background: '#100e15',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ width: 'min(100%, 530px)', border: '1px solid #423b4c',
          background: '#201c29', borderRadius: 18, padding: '28px', boxShadow: '0 15px 40px #0005' }}>
          <div style={{ fontSize: 30, marginBottom: 12 }} aria-hidden="true">✦</div>
          <h1 style={{ margin: '0 0 10px', fontSize: 23 }}>Não foi possível abrir o HäxBag</h1>
          <p style={{ color: '#cec5d1', lineHeight: 1.6 }}>
            Ocorreu um erro ao carregar a interface. Seus dados não foram apagados.
            Recarregue a página para tentar novamente.
          </p>
          <button type="button" onClick={() => window.location.reload()} style={{
            padding: '12px 18px', border: 0, borderRadius: 11,
            background: '#d9bd8b', color: '#201b20', fontWeight: 750, cursor: 'pointer',
          }}>Recarregar página</button>
          <details style={{ marginTop: 18, color: '#bfb6c7', fontSize: 13 }}>
            <summary style={{ cursor: 'pointer' }}>Detalhes para diagnóstico</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace' }}>
              {this.state.error.message.slice(0, 550) || 'Erro de renderização'}
            </pre>
          </details>
        </div>
      </main>
    )
  }
}
