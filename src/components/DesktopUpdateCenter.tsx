import { useEffect, useRef, useState } from 'react'
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
function getUpdater(): DesktopUpdater | undefined {
  return (window as Window & { haxbagDesktop?: DesktopBridge }).haxbagDesktop?.updater
}

const labels: Record<UpdatePhase, string> = {
  disabled: 'Atualizações indisponíveis',
  idle: 'Atualizações automáticas',
  checking: 'Verificando atualizações',
  available: 'Atualização encontrada',
  downloading: 'Baixando em segundo plano',
  ready: 'Atualização pronta',
  'up-to-date': 'Você está atualizado',
  error: 'Não foi possível verificar',
}

/**
 * V300.1 — Sem toast flutuante, sem abertura automática e sem bloquear o chat.
 * O ícone discreto vive na barra superior. Só abre detalhes por iniciativa do usuário.
 * A instalação automática no encerramento é administrada pelo processo principal.
 */
export default function DesktopUpdateCenter() {
  const updater = typeof window === 'undefined' ? undefined : getUpdater()
  const root = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!updater) return
    let active = true
    const unsubscribe = updater.onStatus(next => { if (active) setStatus(next) })
    void updater.getStatus().then(next => { if (active) setStatus(next) }).catch(() => {
      if (active) setStatus({ enabled: false, phase: 'error', message: 'Não foi possível consultar o atualizador.', version: '?' })
    })
    return () => { active = false; unsubscribe() }
  }, [updater])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!updater) return null

  const phase = status?.phase ?? 'idle'
  const isBusy = busy || phase === 'checking' || phase === 'downloading'
  const hasUpdate = phase === 'ready'
  const hasError = phase === 'error'
  const displayTitle = labels[phase]

  async function check() {
    if (!updater || !status?.enabled || isBusy) return
    setBusy(true)
    try { setStatus(await updater.check()) }
    catch { setStatus(previous => previous ? { ...previous, phase: 'error', message: 'Falha ao iniciar a verificação.' } : previous) }
    finally { setBusy(false) }
  }
  async function install() {
    if (!updater || !hasUpdate) return
    setBusy(true)
    try { await updater.install() }
    finally { setBusy(false) }
  }

  return <div ref={root} className={`hb-update-mini${open ? ' is-open' : ''}`}>
    <button type="button" className="hb-update-mini-trigger" title="Atualizações do HäxBag"
      aria-label={`Atualizações do HäxBag${hasUpdate ? ': pronta para instalar ao fechar' : hasError ? ': erro na verificação' : ''}`}
      aria-expanded={open} aria-controls="hb-update-mini-panel" onClick={() => setOpen(value => !value)}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 11a8 8 0 1 1-2.36-5.66"/><path d="M20 4v6h-6"/>
      </svg>
      {(hasUpdate || hasError) && <span className={`hb-update-mini-dot${hasError ? ' is-error' : ''}`} aria-hidden="true" />}
    </button>
    {open && <section id="hb-update-mini-panel" className="hb-update-mini-panel" aria-label="Gerenciar atualizações">
      <header className="hb-update-mini-heading">
        <div><strong>Atualizações</strong><small>HäxBag Desktop v{status?.version || '…'}</small></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fechar atualizações">×</button>
      </header>
      <div className="hb-update-mini-body">
        <strong className="hb-update-mini-state">{displayTitle}</strong>
        <p>{status?.message || 'Carregando informações do atualizador…'}</p>
        {phase === 'downloading' && <div className="hb-update-mini-progress" role="progressbar" aria-label="Download da atualização" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(status?.percent ?? 0)}><span style={{ width: `${status?.percent ?? 0}%` }}/></div>}
        {hasUpdate && <small className="hb-update-mini-hint">A versão {status?.availableVersion || 'nova'} será instalada quando você fechar o aplicativo normalmente. Seu trabalho não será interrompido.</small>}
        {status?.lastCheckedAt && <small className="hb-update-mini-hint">Última verificação: {new Date(status.lastCheckedAt).toLocaleString('pt-BR')}</small>}
        <div className="hb-update-mini-actions">
          {hasUpdate
            ? <button type="button" className="hb-update-mini-primary" disabled={busy} onClick={() => void install()}>Reiniciar e instalar</button>
            : <button type="button" disabled={!status?.enabled || isBusy} onClick={() => void check()}>{isBusy ? 'Verificando…' : 'Verificar agora'}</button>}
        </div>
      </div>
    </section>}
  </div>
}
