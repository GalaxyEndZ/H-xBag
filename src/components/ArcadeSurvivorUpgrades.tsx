import { useEffect } from 'react'
import './ArcadeSurvivorUpgrades.css'

export type SurvivorGame = 'asteroids' | 'arena'
export type SurvivorUpgradeId =
  | 'astro_cadence' | 'astro_volley' | 'astro_thruster' | 'astro_hull'
  | 'astro_velocity' | 'astro_piercing' | 'astro_shield' | 'astro_training'
  | 'arena_cadence' | 'arena_volley' | 'arena_power' | 'arena_piercing'
  | 'arena_sprint' | 'arena_vigor' | 'arena_range' | 'arena_recovery'

export type SurvivorUpgrade = {
  id: SurvivorUpgradeId
  game: SurvivorGame
  symbol: string
  title: string
  description: string
  maxLevel: number
}

export const SURVIVOR_UPGRADES: SurvivorUpgrade[] = [
  { id:'astro_cadence', game:'asteroids', symbol:'⚡', title:'Gatilho veloz', description:'Dispare com menos intervalo entre os tiros.', maxLevel: 7 },
  { id:'astro_volley', game:'asteroids', symbol:'✧', title:'Salva estelar', description:'Atire um projétil extra em cada disparo.', maxLevel: 4 },
  { id:'astro_thruster', game:'asteroids', symbol:'🚀', title:'Propulsor iônico', description:'Acelere a nave mais rapidamente.', maxLevel: Infinity },
  { id:'astro_hull', game:'asteroids', symbol:'♥', title:'Casco reforçado', description:'Aumente a vida máxima e recupere um coração.', maxLevel: Infinity },
  { id:'astro_velocity', game:'asteroids', symbol:'➤', title:'Projéteis de plasma', description:'Tiros mais rápidos e de maior alcance.', maxLevel: 7 },
  { id:'astro_piercing', game:'asteroids', symbol:'✹', title:'Laser perfurante', description:'Cada projétil atravessa mais um asteroide.', maxLevel: 5 },
  { id:'astro_shield', game:'asteroids', symbol:'◈', title:'Escudo temporal', description:'Receba mais tempo de proteção após sofrer dano.', maxLevel: 5 },
  { id:'astro_training', game:'asteroids', symbol:'✦', title:'Computador tático', description:'Receba mais experiência por asteroide destruído.', maxLevel: Infinity },
  { id:'arena_cadence', game:'arena', symbol:'⚡', title:'Disparo relâmpago', description:'Diminua o intervalo entre seus ataques manuais.', maxLevel: 7 },
  { id:'arena_volley', game:'arena', symbol:'✧', title:'Rajada múltipla', description:'Dispare um projétil adicional a cada ataque.', maxLevel: 4 },
  { id:'arena_power', game:'arena', symbol:'✹', title:'Munição rúnica', description:'Cada projétil causa mais dano aos inimigos.', maxLevel: Infinity },
  { id:'arena_piercing', game:'arena', symbol:'➤', title:'Perfuração', description:'Projéteis atravessam mais inimigos.', maxLevel: 5 },
  { id:'arena_sprint', game:'arena', symbol:'➜', title:'Passos velozes', description:'Aumente sua velocidade de deslocamento.', maxLevel: Infinity },
  { id:'arena_vigor', game:'arena', symbol:'♥', title:'Vigor ancestral', description:'Ganhe mais um coração máximo e recupere vida.', maxLevel: Infinity },
  { id:'arena_range', game:'arena', symbol:'⌖', title:'Alcance ampliado', description:'Projéteis viajam mais rápido e duram mais.', maxLevel: 7 },
  { id:'arena_recovery', game:'arena', symbol:'✚', title:'Regeneração', description:'Recupere um coração periodicamente.', maxLevel: 5 },
]

/** O número necessário aumenta gradualmente, sem impor limite de nível à partida. */
export function experienceForNextLevel(level: number): number {
  return Math.floor(4 + level * 2.5)
}

/** Escolhe até 3 cartas diferentes, respeitando os níveis máximos. */
export function drawSurvivorUpgrades(game: SurvivorGame, owned: Partial<Record<SurvivorUpgradeId, number>>): SurvivorUpgrade[] {
  const available = SURVIVOR_UPGRADES.filter(item => item.game === game && (owned[item.id] || 0) < item.maxLevel)
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[available[i], available[j]] = [available[j], available[i]]
  }
  return available.slice(0, 3)
}

export function SurvivorUpgradeChoice({ game, level, choices, ranks, onChoose }: {
  game: SurvivorGame
  level: number
  choices: SurvivorUpgrade[]
  ranks: Partial<Record<SurvivorUpgradeId, number>>
  onChoose: (id: SurvivorUpgradeId) => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const idx = Number(event.key) - 1
      if (idx >= 0 && idx < choices.length) {
        event.preventDefault()
        onChoose(choices[idx].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices, onChoose])
  return <div className="hb-survivor-level-up" role="dialog" aria-modal="true" aria-label={`Escolher upgrade do nível ${level}`}>
    <div className="hb-survivor-level-box">
      <span className="hb-survivor-level-kicker">✦ {game === 'arena' ? 'ARENA INFINITA' : 'ASTEROIDS'} · EVOLUÇÃO</span>
      <h3>Nível {level} alcançado!</h3>
      <p>A partida está pausada. Escolha uma melhoria para continuar sua jornada.</p>
      <div className="hb-survivor-upgrade-cards">
        {choices.map((item, idx) => <button key={item.id} type="button" className="hb-survivor-upgrade-card" onClick={() => onChoose(item.id)}>
          <span className="hb-survivor-upgrade-icon" aria-hidden="true">{item.symbol}</span>
          <span className="hb-survivor-upgrade-title">{item.title}</span>
          <span className="hb-survivor-upgrade-desc">{item.description}</span>
          <span className="hb-survivor-upgrade-foot">Nível {(ranks[item.id] || 0) + 1}{Number.isFinite(item.maxLevel) ? ` de ${item.maxLevel}` : ' · sem limite'}<b>{idx + 1}</b></span>
        </button>)}
      </div>
      <small>Escolha com o mouse, toque ou teclas 1, 2 e 3.</small>
    </div>
  </div>
}

export function SurvivorExperience({ level, xp, next, count }: { level: number; xp: number; next: number; count: number }) {
  return <div className="hb-survivor-xp" aria-label={`Nível ${level}, experiência ${xp} de ${next}`}>
    <div className="hb-survivor-xp-heading"><strong>✦ Nível {level}</strong><span>{count} melhoria{count === 1 ? '' : 's'} · {xp}/{next} XP</span></div>
    <div className="hb-survivor-xp-track"><span style={{ width: `${Math.min(100, xp / Math.max(1, next) * 100)}%` }} /></div>
  </div>
}
