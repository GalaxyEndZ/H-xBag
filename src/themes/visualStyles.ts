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
    symbol: '幻',
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
  hax: {
    label: 'Häx',
    symbol: 'キ',
    signature: 'VIGÍLIA LUNAR',
    description: 'Corvos de tinta, runas antigas, pergaminho escuro e gravuras nórdicas.',
  },
  vale_fantasma: {
    label: 'Vale dos Corvos',
    symbol: '✧',
    signature: 'TUDO ESTÁ NORMAL',
    description: 'Tinta, lua pálida e névoa sobre o vale.',
  },
  vigilia_lunar: {
    label: 'Vigília Lunar',
    symbol: '☽',
    signature: 'A LUA OBSERVA',
    description: 'Crescente velada, véus de luz e silêncio ritual sobre superfícies escuras.',
  },
  floresta_esquecida: {
    label: 'Floresta Esquecida',
    symbol: '❀',
    signature: 'RAÍZES E SUSSURROS',
    description: 'Folhagens místicas, trilhas cobertas de musgo e ornamentos de natureza antiga.',
  },
  inverno_eterno: {
    label: 'Inverno Eterno',
    symbol: '❄',
    signature: 'FRIO SOBERANO',
    description: 'Cristais glaciais, névoa de inverno e arquitetura talhada pelo gelo.',
  },
  arcano: {
    label: 'Arcano',
    symbol: '✶',
    signature: 'RUNAS EM MOVIMENTO',
    description: 'Geometrias místicas, círculos de invocação e gravuras de grimório refinado.',
  },
  catedral_onix: {
    label: 'Catedral de Ônix',
    symbol: '♜',
    signature: 'VOTOS NA ESCURIDÃO',
    description: 'Vitrais góticos, arcos ogivais e arquitetura imponente esculpida em sombra.',
  },
  mare_abissal: {
    label: 'Maré Abissal',
    symbol: '≋',
    signature: 'ECOS DAS PROFUNDEZAS',
    description: 'Marés ancestrais, anéis submarinos e movimentos fluidos das profundezas.',
  },
  jardim_espectral: {
    label: 'Jardim Espectral',
    symbol: '❦',
    signature: 'PÉTALAS DO ALÉM',
    description: 'Pétalas suspensas, arabescos botânicos e o silêncio dos jardins encantados.',
  },
  relicario_solar: {
    label: 'Relicário Solar',
    symbol: '✷',
    signature: 'LEGADO DA AURORA',
    description: 'Raios geométricos, molduras art déco e insígnias de um império solar.',
  },
} as const

export type VisualStyleKey = keyof typeof visualStyles
