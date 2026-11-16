/** Máximo permitido para cada denominação individual da campanha. */
export const MAX_CURRENCY_BALANCE = 100_000_000

/** Mantém a precisão de até oito casas já utilizada nas carteiras. */
export function roundCurrency(value: number): number {
  return Math.round(value * 1e8) / 1e8
}

export function isValidCurrencyAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= MAX_CURRENCY_BALANCE
}

/** Evita transbordamentos e saldos negativos antes da escrita. */
export function fitsCurrencyBalance(current: number, adjustment: number): boolean {
  if (!Number.isFinite(current) || !Number.isFinite(adjustment)) return false
  const next = roundCurrency(current + adjustment)
  return Number.isFinite(next) && next >= 0 && next <= MAX_CURRENCY_BALANCE
}

export function calculateCurrencyExchange(
  amount: number, fromRate: number, toRate: number,
): number | null {
  if (!isValidCurrencyAmount(amount) || !Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) return null
  const received = roundCurrency(amount * fromRate / toRate)
  return Number.isFinite(received) && received > 0 ? received : null
}
