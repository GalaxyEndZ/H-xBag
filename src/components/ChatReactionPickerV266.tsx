import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './ChatReactionPickerV266.css'

type Props = {
  emojis: readonly string[]
  busy?: boolean
  onReact: (emoji: string) => void | Promise<unknown>
}

type Position = { top: number; left: number }

/**
 * The popup is rendered in document.body so the scrolling message pane can't clip it.
 * It is positioned against its own trigger, and constrained to the visible viewport.
 */
export default function ChatReactionPickerV266({ emojis, busy = false, onReact }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const focusedForOpenRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [theme, setTheme] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!open) return

    const reposition = () => {
      const trigger = triggerRef.current
      const popup = popupRef.current
      if (!trigger || !popup) return
      const rect = trigger.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight
      const width = popup.offsetWidth
      const height = popup.offsetHeight
      const margin = 10
      const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - margin))
      const above = rect.top - height - 9
      const below = rect.bottom + 9
      const top = above >= margin || below + height > viewportHeight - margin
        ? Math.max(margin, above)
        : below
      setPosition({ top: Math.min(top, Math.max(margin, viewportHeight - height - margin)), left })
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus({ preventScroll: true })
    }

    reposition()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (open && position && !focusedForOpenRef.current) {
      focusedForOpenRef.current = true
      popupRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    }
  }, [open, position])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setPosition(null)
    focusedForOpenRef.current = false
    // Portals don't inherit the seasonal CSS variables. Bring the chosen colors along.
    const source = triggerRef.current?.closest('.hb-social-v264') || triggerRef.current
    if (source) {
      const styles = window.getComputedStyle(source)
      setTheme({
        '--hb-v266-reaction-bg': styles.getPropertyValue('--s264-base').trim() || styles.backgroundColor,
        '--hb-v266-reaction-text': styles.getPropertyValue('--s264-text').trim() || styles.color,
        '--hb-v266-reaction-line': styles.getPropertyValue('--s264-stroke-hot').trim() || 'rgba(180,180,180,.25)',
        '--hb-v266-reaction-accent': styles.getPropertyValue('--s264-accent').trim() || '#d9bd8b',
      } as CSSProperties)
    }
    setOpen(true)
  }

  return <>
    <button
      type="button"
      ref={triggerRef}
      className="hb-v266-chat-reaction-trigger"
      aria-label="Escolher reação à mensagem"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={toggle}
    >☺ Reagir</button>
    {open && createPortal(
      <div
        ref={popupRef}
        role="dialog"
        aria-label="Escolher uma reação à mensagem"
        className="hb-v266-chat-reaction-popover"
        style={{ ...theme, top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}
      >
        {emojis.map(emoji => <button
          key={emoji}
          type="button"
          aria-label={`Reagir com ${emoji}`}
          title={`Reagir com ${emoji}`}
          disabled={busy}
          onClick={() => {
            setOpen(false)
            triggerRef.current?.focus({ preventScroll: true })
            void onReact(emoji)
          }}
        >{emoji}</button>)}
      </div>,
      document.body,
    )}
  </>
}
