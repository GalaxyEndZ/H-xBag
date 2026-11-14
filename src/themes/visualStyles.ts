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
    signature: 'O SANTUÁRIO DA LUA VELADA',
    description: 'Uma lua de prata ilumina os vitrais de um santuário ancestral, entre constelações, torres de vigília e névoa noturna.',
  },
  floresta_esquecida: {
    label: 'Silvam Argentea',
    symbol: '❀',
    signature: 'A PRATA FLORESCE NO BOSQUE',
    description: 'Bosques prateados, galhos lunares, névoa fria e folhagens de brilho argentado.',
  },
  inverno_eterno: {
    label: 'Inverno Eterno',
    symbol: '❄',
    signature: 'FRIO SOBERANO',
    description: 'Cristais glaciais, geadas nobres e arquitetura talhada pelo gelo antigo.',
  },
  arcano: {
    label: 'Arcano',
    symbol: '✧',
    signature: 'O ASTROLÁBIO DESPERTA',
    description: 'Um cristal etéreo flutua em um astrolábio de runas vivas, entre os arcos de um observatório esquecido.',
  },
  catedral_onix: {
    label: 'Catedral de Ônix',
    symbol: '✥',
    signature: 'O VITRAL DAS SOMBRAS',
    description: 'Uma rosácea de vitral desperta na catedral de ônix, entre arcos ancestrais, pedra negra e luz violeta.',
  },
  mare_abissal: {
    label: 'Maré Abissal',
    symbol: '≋',
    signature: 'ECOS DAS PROFUNDEZAS',
    description: 'Uma espiral de madrepérola emerge entre ruínas submersas, correntes ancestrais e ecos de luz abissal.',
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
    signature: 'A COROA DA AURORA',
    description: 'Um sol imperial gravado em ouro repousa sobre um relicário art déco, entre pilares e geometrias sagradas.',
  },
} as const

export type VisualStyleKey = keyof typeof visualStyles
