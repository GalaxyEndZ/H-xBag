import { useEffect, useRef, useState } from 'react'

type Props = {
  density: 'comfortable' | 'compact'
  onDensityChange: (value: 'comfortable' | 'compact') => void
  focus: boolean
  onFocusChange: (enabled: boolean) => void
  compact: boolean
  onSidebarToggle: () => void
  showNavigationToggle?: boolean
  onReset: () => void
}

/** Painel leve e local ao Electron. Não lê contas, credenciais nem estado de RPG. */
export default function DesktopWorkspaceControls({density,onDensityChange,focus,onFocusChange,compact,onSidebarToggle,onReset,showNavigationToggle=true}:Props) {
  const [open,setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('pointerdown',closeOnOutside)
    document.addEventListener('keydown',closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown',closeOnOutside)
      document.removeEventListener('keydown',closeOnEscape)
    }
  },[open])

  return <div className="hb-v301-workspace-control" ref={root}>
    <button type="button" className={`hb-v301-layout-trigger${open ? ' is-open' : ''}`} title="Ajustes de aparência do desktop" aria-label="Ajustar organização do HäxBag" aria-expanded={open} aria-controls="hb-v301-workspace-panel" onClick={()=>setOpen(value=>!value)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M9 10h12M9 15h12" />
      </svg>
    </button>
    {open && <section id="hb-v301-workspace-panel" className="hb-v301-layout-panel" aria-label="Preferências do espaço de trabalho">
      <div className="hb-v301-layout-panel-head"><span className="hb-v301-layout-emblem">◫</span><div><strong>Seu espaço de trabalho</strong><small>Organize o HäxBag do seu jeito</small></div><button type="button" aria-label="Fechar ajustes de layout" onClick={()=>setOpen(false)}>×</button></div>
      <div className="hb-v301-layout-panel-body">
        {showNavigationToggle && <><label className="hb-v301-layout-label">Navegação</label>
        <button type="button" className="hb-v301-layout-line" onClick={onSidebarToggle}><span><strong>{compact ? 'Mostrar navegação' : 'Recolher navegação'}</strong><small>Alternar entre trilha de ícones e painel completo</small></span><kbd>Ctrl + \</kbd></button></>}
        <label className="hb-v301-layout-label">Densidade</label>
        <div className="hb-v301-density-choice" role="group" aria-label="Densidade da interface">
          <button type="button" aria-pressed={density==='comfortable'} className={density==='comfortable'?'is-active':''} onClick={()=>onDensityChange('comfortable')}><span>▣</span> Confortável</button>
          <button type="button" aria-pressed={density==='compact'} className={density==='compact'?'is-active':''} onClick={()=>onDensityChange('compact')}><span>▤</span> Compacta</button>
        </div>
        <label className="hb-v301-layout-label">Concentração</label>
        <button type="button" className="hb-v301-layout-line" aria-pressed={focus} onClick={()=>onFocusChange(!focus)}><span><strong>Modo de foco</strong><small>Mais área útil, menos cabeçalhos</small></span><span className={`hb-v301-toggle${focus?' is-on':''}`} aria-hidden="true"><i /></span></button>
        <div className="hb-v301-layout-divider" />
        <button type="button" className="hb-v301-reset-layout" onClick={()=>{onReset();setOpen(false)}}>↺ Restaurar organização padrão</button>
        <p className="hb-v301-shortcuts">Atalhos: Alt+1 Social · Alt+2 RPG · Alt+3 Minigames · Alt+4 Comunicação</p>
      </div>
    </section>}
  </div>
}
