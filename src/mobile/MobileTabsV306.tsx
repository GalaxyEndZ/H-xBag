/** Barra global de navegação no Android/iOS. A navegação web anterior continua intacta. */
type MobileArea = 'social' | 'rpg' | 'communication' | 'minigames'
type Props = {
  active: MobileArea
  menuOpen: boolean
  onSocial: () => void
  onRpg: () => void
  onCommunication: () => void
  onMinigames: () => void
  onMenu: () => void
}

const tabs = [
  { id: 'social', label: 'Social', glyph: '✦' },
  { id: 'rpg', label: 'RPG', glyph: '⚔' },
  { id: 'communication', label: 'Conversas', glyph: '✉' },
  { id: 'minigames', label: 'Arcade', glyph: '◉' },
] as const

export default function MobileTabsV306({ active, menuOpen, onSocial, onRpg, onCommunication, onMinigames, onMenu }: Props) {
  const actions: Record<MobileArea, () => void> = {
    social: onSocial,
    rpg: onRpg,
    communication: onCommunication,
    minigames: onMinigames,
  }

  return (
    <nav className="hb-native-tabs-v306" aria-label="Navegação do HäxBag Mobile">
      {tabs.map(tab => (
        <button key={tab.id} type="button" onClick={actions[tab.id]}
          aria-label={`Abrir ${tab.label}`} aria-current={active === tab.id ? 'page' : undefined}
          className={active === tab.id ? 'is-active' : ''}>
          <span className="hb-native-tab-icon-v306" aria-hidden="true">{tab.glyph}</span>
          <span>{tab.label}</span>
        </button>
      ))}
      <button type="button" onClick={onMenu} aria-label="Abrir menu completo" aria-controls="hb-sidebar-menu"
        aria-expanded={menuOpen} className={menuOpen ? 'is-active' : ''}>
        <span className="hb-native-tab-icon-v306" aria-hidden="true">☰</span>
        <span>Menu</span>
      </button>
    </nav>
  )
}
