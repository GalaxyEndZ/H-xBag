import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { HaxSocialTab } from '../siteNavigation'
import './SocialNavigatorV265.css'

type Entry = { id: HaxSocialTab; label: string; description: string; count?: number }
type Props = {
  active: boolean
  currentTab: HaxSocialTab
  entries: Entry[]
  onNavigate: (tab: HaxSocialTab) => void
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const favorites: HaxSocialTab[] = ['feed', 'discover', 'messages', 'notifications', 'communities', 'tablefinder', 'friends', 'saved', 'events', 'following']

/** Navegação local: não consulta o banco nem cria caminhos alternativos de acesso. */
export default function SocialNavigatorV265({ active, currentTab, entries, onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const visibleEntries = search.trim()
    ? entries.filter(entry => normalize(`${entry.label} ${entry.description}`).includes(normalize(search.trim()))).slice(0, 12)
    : [...entries].sort((a, b) => {
      const aRank = favorites.indexOf(a.id)
      const bRank = favorites.indexOf(b.id)
      return (aRank < 0 ? 100 : aRank) - (bRank < 0 ? 100 : bRank)
    }).slice(0, 10)
  const activeIndex = Math.min(selection, Math.max(0, visibleEntries.length - 1))

  const open = () => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current
    setSearch('')
    setSelection(0)
    setIsOpen(true)
  }
  const close = () => {
    setIsOpen(false)
    window.requestAnimationFrame(() => returnFocusRef.current?.isConnected && returnFocusRef.current.focus())
  }
  const navigate = (target: HaxSocialTab) => {
    setIsOpen(false)
    onNavigate(target)
    // Ao mudar de página, o título da nova página recebe o foco, inclusive no mobile.
    window.requestAnimationFrame(() => document.getElementById('hb-social-page-heading')?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (!active) return
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        if (isOpen) close()
        else open()
      } else if (isOpen && event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, isOpen])

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
  }, [isOpen])
  useEffect(() => {
    if (!active && isOpen) setIsOpen(false)
  }, [active, isOpen])

  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelection(index => Math.min(index + 1, visibleEntries.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelection(index => Math.max(index - 1, 0)) }
    if (event.key === 'Enter' && event.target === inputRef.current && visibleEntries.length) {
      event.preventDefault()
      navigate(visibleEntries[activeIndex].id)
    }
    if (event.key === 'Tab') {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')
      if (!focusables?.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }

  return <>
    <button ref={triggerRef} type="button" className="hb-v265-trigger" onClick={open} aria-haspopup="dialog" aria-expanded={isOpen} title="Ir para outra página do Social (Ctrl + K)">
      <span aria-hidden="true">⌘</span> Ir para… <kbd>Ctrl K</kbd>
    </button>
    {isOpen && <div className="hb-v265-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="hb-v265-title" aria-describedby="hb-v265-description" className="hb-v265-dialog" onKeyDown={keyboard}>
        <div className="hb-v265-dialog-top"><div><span className="hb-v265-eyebrow">HÄXBAG / SOCIAL</span><h3 id="hb-v265-title">Para onde vamos?</h3><p id="hb-v265-description">Encontre qualquer página da comunidade sem perder sua navegação.</p></div><button type="button" className="hb-v265-close" onClick={close} aria-label="Fechar navegação">✕</button></div>
        <label className="hb-v265-search"><span aria-hidden="true">⌕</span><input ref={inputRef} type="search" value={search} onChange={event => { setSearch(event.target.value); setSelection(0) }} placeholder="Buscar página, função ou assunto…" aria-label="Buscar destinos do Social" autoComplete="off" /></label>
        <div className="hb-v265-results-heading"><strong>{search.trim() ? 'RESULTADOS' : 'ACESSOS RÁPIDOS'}</strong><small>{visibleEntries.length} {visibleEntries.length === 1 ? 'destino' : 'destinos'}</small></div>
        <span className="hb-v265-selection-announce" role="status" aria-live="polite">{visibleEntries.length ? `Selecionado: ${visibleEntries[activeIndex].label}` : 'Nenhum resultado'}</span>
        {visibleEntries.length ? <div className="hb-v265-results" role="list" aria-label="Páginas disponíveis">{visibleEntries.map((entry, index) => <div role="listitem" key={entry.id}>
          <button type="button" onClick={() => navigate(entry.id)} onMouseEnter={() => setSelection(index)} className={`hb-v265-result ${activeIndex === index ? 'is-highlighted' : ''}`} aria-current={currentTab === entry.id ? 'page' : undefined}>
            <span className="hb-v265-result-icon" aria-hidden="true">{entry.label.trim().charAt(0)}</span>
            <span className="hb-v265-result-copy"><strong>{entry.label.replace(/^\S+\s*/, '')}</strong><small>{entry.description}</small></span>
            {entry.count !== undefined && entry.count > 0 && <span className="hb-v265-result-count" aria-label={`${entry.count} itens`}>{entry.count}</span>}
            <span className="hb-v265-result-arrow" aria-hidden="true">{currentTab === entry.id ? '●' : '↗'}</span>
          </button>
        </div>)}</div> : <div className="hb-v265-empty"><strong>Nenhuma página encontrada</strong><p>Tente buscar por uma palavra diferente.</p><button type="button" onClick={() => {setSearch('');setSelection(0);inputRef.current?.focus()}}>Limpar pesquisa</button></div>}
        <div className="hb-v265-dialog-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></div>
      </div>
    </div>}
  </>
}
