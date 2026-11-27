import { useEffect, useState, type ReactNode } from 'react'

type Props = {
  title: string
  icon: string
  active?: boolean
  initiallyOpen?: boolean
  children: ReactNode
}

/** Grupos progressivos da navegação Social no desktop, preservando acesso por teclado. */
export default function SocialSidebarGroupV3056({ title, icon, active = false, initiallyOpen = false, children }: Props) {
  const [expanded, setExpanded] = useState(initiallyOpen || active)

  // Uma rota acessada por outro atalho sempre fica visível no menu contextual.
  useEffect(() => {
    if (active) setExpanded(true)
  }, [active])

  return (
    <details
      className={`hb-v3056-sidebar-group${active ? ' is-current' : ''}`}
      open={expanded}
      onToggle={event => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span className="hb-v3056-group-emblem" aria-hidden="true">{icon}</span>
        <span>{title}</span>
        <span className="hb-v3056-group-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="hb-v3056-group-items">{children}</div>
    </details>
  )
}
