import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/** Keep a Social rendering failure from taking down the entire HäxBag app. */
export default class SocialRuntimeGuard extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[HäxBag Social] Falha ao renderizar:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <section role="alert" className="hb-social-runtime-recovery" style={{ padding: '26px', border: '1px solid var(--season-line, #ffffff30)', borderRadius: 16, color: 'var(--season-text, #eee)', background: 'var(--season-surface, #18171e)' }}>
        <h3 style={{ marginTop: 0 }}>Não foi possível abrir o Social</h3>
        <p>O conteúdo não foi apagado. Recarregue a página para tentar novamente.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--season-primary, #d9bd8b)', color: 'var(--season-on-primary, #171319)', border: 0, cursor: 'pointer' }}>
          Recarregar página
        </button>
      </section>
    )
  }
}
