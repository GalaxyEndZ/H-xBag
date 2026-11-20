/**
 * Física de fragmentação do Asteroids. Mantida separada do canvas para permitir
 * testar a quebra dos asteroides sem carregar React ou depender de animações.
 */
export type AsteroidTier = 1 | 2 | 3
export type AsteroidToBreak = {
  x: number
  y: number
  vx: number
  vy: number
  tier: AsteroidTier
}
export type AsteroidFragment = AsteroidToBreak

/**
 * Um asteroide grande vira dois médios; um médio vira dois pequenos.
 * Os filhos já aparecem separados no primeiro frame, em vez de se sobreporem
 * visualmente como ocorria antes.
 */
export function breakAsteroid(parent: AsteroidToBreak): AsteroidFragment[] {
  if (parent.tier === 1) return []
  const tier = (parent.tier - 1) as AsteroidTier
  const speed = Math.hypot(parent.vx, parent.vy)
  const axis = (speed > 0.1 ? Math.atan2(parent.vy, parent.vx) : -Math.PI / 2) + Math.PI / 2
  const distance = tier === 2 ? 32 : 23
  const impulse = Math.max(112, speed * 0.78 + 66)
  return ([-1, 1] as const).map(side => {
    const ux = Math.cos(axis) * side
    const uy = Math.sin(axis) * side
    return {
      x: parent.x + ux * distance,
      y: parent.y + uy * distance,
      vx: parent.vx * 0.48 + ux * impulse,
      vy: parent.vy * 0.48 + uy * impulse,
      tier,
    }
  })
}

/**
 * Teste contínuo entre a posição anterior e a atual do projétil, incluindo
 * a passagem de um lado a outro da tela. Evita tiros atravessando fragmentos.
 */
export function shotHitsAsteroid(
  shot: { x: number; y: number; vx: number; vy: number },
  rock: { x: number; y: number; radius: number },
  dt: number,
  width: number,
  height: number,
): boolean {
  if (dt <= 0) return false
  const dx = shot.vx * dt
  const dy = shot.vy * dt
  const startX = shot.x - dx
  const startY = shot.y - dy
  const nearby = (point: number, origin: number, size: number) =>
    origin + ((((point - origin) % size) + 1.5 * size) % size) - size / 2
  const cx = nearby(rock.x, startX, width)
  const cy = nearby(rock.y, startY, height)
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq ? Math.max(0, Math.min(1, ((cx - startX) * dx + (cy - startY) * dy) / lengthSq)) : 0
  const distanceX = cx - (startX + dx * t)
  const distanceY = cy - (startY + dy * t)
  return distanceX * distanceX + distanceY * distanceY <= (rock.radius + 3) ** 2
}
