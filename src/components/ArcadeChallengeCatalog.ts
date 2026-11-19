/** Catálogo pré-definido do Arcade. O SQL V190 espelha estes desafios e escolhe três por dia. */
export const ARCADE_GAMES = [
  { id: 'pong', title: 'Pong', icon: '🏓', description: 'Clássico de reflexos' },
  { id: 'snake', title: 'Snake', icon: '🐍', description: 'Coma frutas e cresça' },
  { id: 'breakout', title: 'Breakout', icon: '🧱', description: 'Quebre blocos e faça combos' },
  { id: '2048', title: '2048', icon: '🔢', description: 'Combine peças numéricas' },
  { id: 'asteroids', title: 'Asteroids', icon: '🚀', description: 'Sobreviva no espaço' },
  { id: 'minesweeper', title: 'Campo Minado', icon: '💣', description: 'Encontre todas as casas seguras' },
  { id: 'flappy', title: 'Voo Infinito', icon: '🪽', description: 'Desvie de obstáculos' },
  { id: 'arena', title: 'Arena Infinita', icon: '⚔️', description: 'Sobreviva às hordas' },
  { id: 'memory', title: 'Memória Arcana', icon: '🔮', description: 'Combine os pares de runas' },
] as const
export type ArcadeGameId = typeof ARCADE_GAMES[number]['id']
export type ArcadeChallenge = { id: string; gameId: ArcadeGameId; description: string; target: number; difficulty: number }
export const ARCADE_CHALLENGES: readonly ArcadeChallenge[] = [
  { id: 'pong_1', gameId: 'pong', description: 'Devolva a bola e faça 4 pontos', target: 4, difficulty: 1 },
  { id: 'pong_2', gameId: 'pong', description: 'Alcance 12 pontos no Pong', target: 12, difficulty: 3 },
  { id: 'pong_3', gameId: 'pong', description: 'Alcance 25 pontos no Pong', target: 25, difficulty: 5 },
  { id: 'snake_1', gameId: 'snake', description: 'Coma uma fruta no Snake', target: 10, difficulty: 1 },
  { id: 'snake_2', gameId: 'snake', description: 'Coma três frutas no Snake', target: 30, difficulty: 3 },
  { id: 'snake_3', gameId: 'snake', description: 'Coma seis frutas no Snake', target: 60, difficulty: 5 },
  { id: 'breakout_1', gameId: 'breakout', description: 'Quebre 3 blocos no Breakout', target: 30, difficulty: 1 },
  { id: 'breakout_2', gameId: 'breakout', description: 'Quebre 10 blocos no Breakout', target: 100, difficulty: 3 },
  { id: 'breakout_3', gameId: 'breakout', description: 'Quebre 22 blocos no Breakout', target: 220, difficulty: 5 },
  { id: '2048_1', gameId: '2048', description: 'Some 64 pontos no 2048', target: 64, difficulty: 1 },
  { id: '2048_2', gameId: '2048', description: 'Some 256 pontos no 2048', target: 256, difficulty: 3 },
  { id: '2048_3', gameId: '2048', description: 'Some 768 pontos no 2048', target: 768, difficulty: 5 },
  { id: 'asteroids_1', gameId: 'asteroids', description: 'Destrua um asteroide', target: 20, difficulty: 1 },
  { id: 'asteroids_2', gameId: 'asteroids', description: 'Faça 80 pontos no Asteroids', target: 80, difficulty: 3 },
  { id: 'asteroids_3', gameId: 'asteroids', description: 'Faça 180 pontos no Asteroids', target: 180, difficulty: 5 },
  { id: 'minesweeper_1', gameId: 'minesweeper', description: 'Vença uma partida de Campo Minado', target: 200, difficulty: 1 },
  { id: 'minesweeper_2', gameId: 'minesweeper', description: 'Vença o Campo Minado com 400 pontos', target: 400, difficulty: 3 },
  { id: 'minesweeper_3', gameId: 'minesweeper', description: 'Vença o Campo Minado com 550 pontos', target: 550, difficulty: 5 },
  { id: 'flappy_1', gameId: 'flappy', description: 'Passe por 2 obstáculos', target: 10, difficulty: 1 },
  { id: 'flappy_2', gameId: 'flappy', description: 'Passe por 6 obstáculos', target: 30, difficulty: 3 },
  { id: 'flappy_3', gameId: 'flappy', description: 'Passe por 12 obstáculos', target: 60, difficulty: 5 },
  { id: 'arena_1', gameId: 'arena', description: 'Elimine 2 inimigos na Arena', target: 20, difficulty: 1 },
  { id: 'arena_2', gameId: 'arena', description: 'Elimine 8 inimigos na Arena', target: 80, difficulty: 3 },
  { id: 'arena_3', gameId: 'arena', description: 'Alcance 150 pontos na Arena', target: 150, difficulty: 5 },
  { id: 'memory_1', gameId: 'memory', description: 'Complete a Memória Arcana', target: 120, difficulty: 1 },
  { id: 'memory_2', gameId: 'memory', description: 'Complete a Memória Arcana com 300 pontos', target: 300, difficulty: 3 },
  { id: 'memory_3', gameId: 'memory', description: 'Complete a Memória Arcana com 500 pontos', target: 500, difficulty: 5 },
] as const
/** Escala do conjunto: 1 moeda para três metas fáceis; até 10 para três muito difíceis. */
export function rewardFromDifficulties(difficulties: readonly number[]): number {
  const total = difficulties.reduce((sum, difficulty) => sum + difficulty, 0)
  return Math.max(1, Math.min(10, Math.round(1 + (total - 3) * 9 / 12)))
}
