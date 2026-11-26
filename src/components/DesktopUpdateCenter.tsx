import { useEffect, useState } from 'react'
import './DesktopUpdateCenter.css'

type UpdatePhase = 'disabled' | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'
type UpdateStatus = {
  enabled: boolean
  phase: UpdatePhase
  message: string
  version: string
  availableVersion?: string | null
  percent?: number | null
  lastCheckedAt?: string | null
  errorCode?: string | null
  releaseUrl?: string
}
type DesktopUpdater = {
  getStatus: () => Promise<UpdateStatus>
  check: () => Promise<UpdateStatus>
  install: () => Promise<boolean>
  onStatus: (callback: (status: UpdateStatus) => void) => () => void
}
type DesktopBridge = { enabled?: boolean; updater?: DesktopUpdater }
function getBridge(): DesktopBridge | undefined {
  return (window as Window & { haxbagDesktop?: DesktopBridge }).haxbagDesktop
}
const titles: Record<UpdatePhase, string> = {
  disabled: 'Atualizações indisponíveis', idle: 'Atualizações ativadas',
  checking: 'Verificando atualização', available: 'Atualização encontrada',
  downloading: 'Baixando atualização', ready: 'Pronta para instalar',
  'up-to-date': 'HäxBag atualizado', error: 'Falha na atualização',
}

export default function DesktopUpdateCenter() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const bridge = typeof window !== 'undefined' ? getBridge()?.updater : undefined

  useEffect(() => {
    if (!bridge) return
    let mounted = true
    const unsubscribe = bridge.onStatus(next => {
      if (!mounted) return
      setStatus(next)
      if (next.phase === 'ready') setExpanded(true)
    })
    void bridge.getStatus().then(next => { if (mounted) setStatus(next) }).catch(() => {
      if (mounted) setStatus({ enabled: false, phase: 'error', message: 'Não foi possível consultar o atualizador.', version: '?' })
    })
    return () => { mounted = false; unsubscribe() }
  }, [bridge])
  if (!bridge || !status) return null

  const isBusy = busy || status.phase === 'checking' || status.phase === 'downloading'
  const attention = status.phase === 'ready' || status.phase === 'error' || status.phase === 'disabled'
  async function check() {
    setBusy(true)
    try { setStatus(await bridge!.check()) }
    catch { setStatus(previous => previous ? { ...previous, phase: 'error', message: 'Não foi possível iniciar a verificação.' } : previous) }
    finally { setBusy(false) }
  }
  async function install() {
    setBusy(true)
    try { await bridge!.install() }
    finally { setBusy(false) }
  }

  return <section className={`hb-update-center ${expanded ? 'is-expanded' : ''} ${attention ? 'needs-attention' : ''}`} aria-label="Atualizações do HäxBag">
    <button type="button" className="hb-update-trigger" aria-expanded={expanded} aria-controls="hb-update-details" onClick={() => setExpanded(value => !value)}>
      <span className="hb-update-glyph" aria-hidden="true">{status.phase === 'ready' ? '↓' : status.phase === 'error' ? '!' : '↻'}</span>
      <span className="hb-update-trigger-copy"><strong>{titles[status.phase]}</strong><small>Desktop v{status.version}</small></span>
      <span className="hb-update-chevron" aria-hidden="true">{expanded ? '⌄' : '⌃'}</span>
    </button>
    {expanded && <div id="hb-update-details" className="hb-update-details" role="status" aria-live="polite">
      <p>{status.message}</p>
      {status.phase === 'downloading' && <div className="hb-update-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(status.percent ?? 0)} aria-label="Progresso do download"><span style={{ width: `${status.percent ?? 0}%` }} /></div>}
      {status.lastCheckedAt && <small className="hb-update-meta">Última verificação: {new Date(status.lastCheckedAt).toLocaleString('pt-BR')}</small>}
      <div className="hb-update-actions">
        {status.phase === 'ready'
          ? <button type="button" className="hb-update-primary" onClick={() => void install()} disabled={busy}>Reiniciar e instalar</button>
          : <button type="button" onClick={() => void check()} disabled={!status.enabled || isBusy}>{isBusy ? 'Verificando…' : 'Verificar agora'}</button>}
        {status.releaseUrl && <a href={status.releaseUrl} target="_blank" rel="noopener noreferrer">Ver versões no GitHub</a>}
      </div>
      {status.phase === 'ready' && <small className="hb-update-meta">Você também pode continuar usando o app e fechar normalmente mais tarde.</small>}
    </div>}
  </section>
}
