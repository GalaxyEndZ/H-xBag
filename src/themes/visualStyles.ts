/**
 * Estilos estruturais independentes das paletas de temporada.
 * Cada estilo adiciona uma classe visual-style-<chave> à raiz do HäxBag.
 * As cores continuam vindo das variáveis --season-* do tema selecionado.
 */
export const visualStyles = {
  classic: {
    label: 'Eclipse',
    symbol: '☾',
    signature: 'A ERA DOS ASTROS',
    description: 'Fantasia arcana, eclipses dourados, constelações e arquitetura celestial.',
  },
  japanese: {
    label: 'Kisatsutai',
    symbol: '花',
    signature: 'TRADIÇÃO E LÂMINAS',
    description: 'Gravuras japonesas, flores de cerejeira, tinta sumi-e e ondas seigaiha.',
  },
  cyberpunk: {
    label: 'Cyberflower',
    symbol: '✿',
    signature: 'O FUTURO FLORESCE',
    description: 'Flores holográficas, circuitos luminosos e geometria de interfaces HUD.',
  },
  ciclos: {
    label: 'Ciclos',
    symbol: '⚜',
    signature: 'CRÔNICAS DOS REINOS',
    description: 'Heráldica medieval, filigranas, pergaminhos e ciclos das estações.',
  },
} as const

export type VisualStyleKey = keyof typeof visualStyles
