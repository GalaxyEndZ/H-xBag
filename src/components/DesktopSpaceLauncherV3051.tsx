import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import './DesktopSpaceLauncherV3051.css'

type Space = 'social' | 'rpg' | 'minigames' | 'communication'
type Props = {
  active: Space
  accent: string
  onSocial: () => void
  onRpg: () => void
  onMinigames: () => void
  onCommunication: () => void
}

const SPACES: ReadonlyArray<{ id: Space; name: string; icon: string; description: string }> = [
  { id: 'social', name: 'Social', icon: '✦', description: 'Sua comunidade' },
  { id: 'rpg', name: 'RPG', icon: '⚔', description: 'Campanhas e fichas' },
  { id: 'minigames', name: 'Minigames', icon: '◉', description: 'Arcade e desafios' },
  { id: 'communication', name: 'Comunicação', icon: '✉', description: 'Servidores e chamadas' },
]

/**
 * V305.1: o menu é montado fora da sidebar via portal.
 * A sidebar V301 usa overflow:hidden, que cortava o menu de navegação V305.
 * Não altera o estado nem as permissões das áreas existentes.
 */
export default function DesktopSpaceLauncherV3051({
  active, accent, onSocial, onRpg, onMinigames, onCommunication,
}: Props) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 76, top: 45 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const actions: Record<Space, () => void> = {
    social: onSocial,
    rpg: onRpg,
    minigames: onMinigames,
    communication: onCommunication,
  }

  const placePanel = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 12
    const width = Math.min(264, window.innerWidth - margin * 2)
    const onRight = rect.right + 10 + width <= window.innerWidth - margin
    const left = onRight ? rect.right + 10 : Math.max(margin, rect.left - width - 10)
    const top = Math.max(margin, Math.min(rect.top, window.innerHeight - 324 - margin))
    setPosition({ left, top })
  }, [])

  useEffect(() => {
    if (!open) return
    placePanel()
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', placePanel)
    window.addEventListener('scroll', placePanel, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', placePanel)
      window.removeEventListener('scroll', placePanel, true)
    }
  }, [open, placePanel])

  function choose(id: Space) {
    setOpen(false)
    actions[id]()
  }

  return <div className="hb-v3051-launcher-slot">
    <button ref={triggerRef} type="button" className={`hb-v3051-launcher-button${open ? ' is-open' : ''}`}
      title="Alternar entre as áreas do HäxBag" aria-label="Abrir menu de áreas do HäxBag"
      aria-haspopup="menu" aria-expanded={open} aria-controls="hb-v3051-space-menu"
      onClick={() => { placePanel(); setOpen(value => !value) }}>
      <img src="/haxbag-symbol.png" alt="" aria-hidden="true" />
    </button>
    {open && createPortal(
      <div id="hb-v3051-space-menu" className="hb-v3051-launcher-menu" ref={panelRef}
        role="menu" aria-label="Escolher área do HäxBag"
        style={{ left: position.left, top: position.top, '--hb-v3051-accent': accent } as CSSProperties}>
        <div className="hb-v3051-launcher-heading"><strong>HäxBag</strong><small>Escolha seu espaço</small></div>
        {SPACES.map(item => <button key={item.id} type="button" role="menuitemradio"
          aria-checked={active === item.id} className={active === item.id ? 'is-active' : ''}
          onClick={() => choose(item.id)}>
          <span aria-hidden="true" className="hb-v3051-launcher-icon">{item.icon}</span>
          <span className="hb-v3051-launcher-copy"><strong>{item.name}</strong><small>{item.description}</small></span>
          {active === item.id && <span className="hb-v3051-launcher-current" aria-hidden="true">✓</span>}
        </button>)}
        <div className="hb-v3051-launcher-footer">Alt+1 a Alt+4 alternam entre espaços</div>
      </div>, document.body)}
  </div>
}
