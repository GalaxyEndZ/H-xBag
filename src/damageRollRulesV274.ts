/** V274 — dano ofensivo. Estas funções nunca alteram PV, PS, PR ou fichas. */
export type DamageTerm = { count: number; sides: number; sign: 1 | -1 } | { flat: number }
export type DamageRoll = { expression: string; dice: { sides: number; values: number[]; sign: number }[]; modifier: number; total: number }

/** Aceita 1d8, 2d6+1d4+4 e similares. Impõe limites para evitar rolagens acidentais gigantes. */
export function parseDamageExpression(text: string): DamageTerm[] | null {
  const normalized = text.replace(/\s+/g, '').toLowerCase()
  if (!normalized || normalized.length > 80) return null
  if (!/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(normalized)) return null
  const tokens = [...normalized.matchAll(/([+-]?)(\d*d\d+|\d+)/g)]
  if (!tokens.length || tokens.map(match => match[0]).join('') !== normalized) return null
  let diceTotal = 0
  const terms: DamageTerm[] = []
  for (const match of tokens) {
    const sign = match[1] === '-' ? -1 as const : 1 as const
    const part = match[2]
    if (part.includes('d')) {
      if (sign < 0) return null
      const [countRaw, sidesRaw] = part.split('d')
      const count = countRaw ? Number(countRaw) : 1
      const sides = Number(sidesRaw)
      if (!Number.isSafeInteger(count) || count < 1 || count > 50 || !Number.isSafeInteger(sides) || sides < 2 || sides > 100) return null
      diceTotal += count
      if (diceTotal > 120) return null
      terms.push({count, sides, sign})
    } else {
      const value = Number(part)
      if (!Number.isSafeInteger(value) || value > 100000) return null
      terms.push({flat: sign * value})
    }
  }
  return terms
}

export function rollDamageExpression(expression: string, die: (sides: number) => number = sides => Math.floor(Math.random() * sides) + 1): DamageRoll | null {
  const terms = parseDamageExpression(expression)
  if (!terms) return null
  const dice: DamageRoll['dice'] = []
  let modifier = 0
  for (const term of terms) {
    if ('flat' in term) { modifier += term.flat; continue }
    const values = Array.from({length: term.count}, () => die(term.sides))
    dice.push({sides:term.sides,values,sign:term.sign})
  }
  return {expression, dice, modifier, total: Math.max(0, modifier + dice.reduce((sum, group) => sum + group.sign * group.values.reduce((a,b) => a+b, 0), 0))}
}

export type BreathingTier = 'raposa' | 'tigre' | 'dragao' | 'corvo'
export type BreathingKind = 'defensiva' | 'ofensiva' | 'destrutiva'
/** Tabela de dano base das formas (sem efeitos, gastos e modificadores condicionais). */
export const BREATHING_DAMAGE: Record<BreathingTier, Record<BreathingKind, string>> = {
  raposa: {defensiva: '1d8', ofensiva: '2d6', destrutiva: '2d6+4'},
  tigre: {defensiva: '2d8', ofensiva: '2d6+2d4+2', destrutiva: '3d6+1d4+6'},
  dragao: {defensiva: '2d12+1d4', ofensiva: '4d6+2d4+4', destrutiva: '3d6+3d4+10'},
  corvo: {defensiva: '4d12+2d4+8', ofensiva: '7d6+6d4+10', destrutiva: '7d6+7d4+26'},
}

export const BREATHING_TIER_LABEL: Record<BreathingTier, string> = {raposa:'Raposa',tigre:'Tigre',dragao:'Dragão',corvo:'Corvo'}
