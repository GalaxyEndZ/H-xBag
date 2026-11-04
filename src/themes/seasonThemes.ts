
/**
 * Temas de temporada do HäxBag.
 *
 * Para adicionar um tema comum:
 * 1. Copie um dos objetos abaixo.
 * 2. Dê a ele uma chave única (ex.: bosque_sombrio).
 * 3. Altere label e as cores.
 *
 * Os estilos gerais em seasonThemes.css usam estas variáveis automaticamente.
 * Só adicione CSS específico quando o tema precisar de efeitos exclusivos.
 */

export type SeasonTheme = {
  label: string
  primary: string
  secondary: string
  glow: string
  bg: string
  surface: string
  surfaceAlt: string
  line: string
  onPrimary: string
}

export const seasonThemes = {
  default: {
    label: 'Padrão HäxBag',
    primary: '#c8b5ff',
    secondary: '#7958cf',
    glow: 'rgba(190,170,255,.20)',
    bg: '#0e0b17',
    surface: '#181323',
    surfaceAlt: '#251b36',
    line: '#493765',
    onPrimary: '#ffffff',
  },
  crimson: {
    label: 'Lua de Sangue',
    primary: '#ff334f',
    secondary: '#b5122e',
    glow: 'rgba(255,35,65,.22)',
    bg: '#080809',
    surface: '#111114',
    surfaceAlt: '#1b1115',
    line: '#64202e',
    onPrimary: '#ffffff',
  },
  forest: {
    label: 'Floresta Esquecida',
    primary: '#9be8b7',
    secondary: '#397b58',
    glow: 'rgba(139,224,178,.19)',
    bg: '#09130f',
    surface: '#122019',
    surfaceAlt: '#1c3024',
    line: '#3b6249',
    onPrimary: '#ffffff',
  },
  frost: {
    label: 'Inverno Eterno',
    primary: '#b9e8ff',
    secondary: '#4b88b5',
    glow: 'rgba(169,222,248,.20)',
    bg: '#09131d',
    surface: '#121f2c',
    surfaceAlt: '#1b3041',
    line: '#3c617c',
    onPrimary: '#ffffff',
  },
  arcane: {
    label: 'Arcano',
    primary: '#e7c5ff',
    secondary: '#8754c5',
    glow: 'rgba(223,184,255,.20)',
    bg: '#120b1b',
    surface: '#1c1428',
    surfaceAlt: '#2b1c40',
    line: '#5a3d78',
    onPrimary: '#ffffff',
  },
  ghost_vale: {
    label: 'Vale Fantasma',
    primary: '#ffc078',
    secondary: '#c85d27',
    glow: 'rgba(255,158,75,.19)',
    bg: '#080a0d',
    surface: '#11161b',
    surfaceAlt: '#1b252d',
    line: '#46535d',
    onPrimary: '#ffffff',
  },
  crimson_vale: {
    label: 'Vale Carmesim',
    primary: '#ff5268',
    secondary: '#a91f38',
    glow: 'rgba(255,55,85,.20)',
    bg: '#09090c',
    surface: '#151216',
    surfaceAlt: '#24151c',
    line: '#653044',
    onPrimary: '#ffffff',
  },
  celestial_sands: {
    label: 'Areias Celestes',
    primary: '#5865F2',
    secondary: '#7289DA',
    glow: 'rgba(88, 101, 242, 0.28)',
    bg: '#1E1F22',
    surface: '#2B2D31',
    surfaceAlt: '#313338',
    line: '#404249',
    onPrimary: '#ffffff',
  },
  rosa_de_ferro: {
    label: 'Rosa de Ferro',
    primary: '#ff4fd8',
    secondary: '#c026a8',
    glow: 'rgba(255, 55, 210, .25)',
    bg: '#0d080f',
    surface: '#1b1020',
    surfaceAlt: '#2b1730',
    line: '#71345f',
    onPrimary: '#1a0816',
  },
  flower_city: {
    label: 'Flower City',
    primary: '#ff4fd8',
    secondary: '#00d9ff',
    glow: 'rgba(255, 55, 220, .25)',
    bg: '#080b16',
    surface: '#111629',
    surfaceAlt: '#1a2440',
    line: '#344b75',
    onPrimary: '#160817',
  },
  validade_programada: {
    label: 'Validade Programada',
    primary: '#b56aff',
    secondary: '#397bff',
    glow: 'rgba(157, 83, 255, .25)',
    bg: '#0b0818',
    surface: '#17112a',
    surfaceAlt: '#251b40',
    line: '#503b7d',
    onPrimary: '#ffffff',
  },
  matrix: {
    label: 'Matrix',
    primary: '#39ff88',
    secondary: '#00b86b',
    glow: 'rgba(40, 255, 130, .22)',
    bg: '#070d0b',
    surface: '#101b16',
    surfaceAlt: '#192a21',
    line: '#315c45',
    onPrimary: '#06140c',
  },
  brasas: {
    label: 'Brasas',
    primary: '#ff873d',
    secondary: '#e33b52',
    glow: 'rgba(255, 105, 50, .23)',
    bg: '#100909',
    surface: '#1d1213',
    surfaceAlt: '#2c1b1c',
    line: '#694044',
    onPrimary: '#1a0905',
  },
} satisfies Record<string, SeasonTheme>

export type SeasonThemeKey = keyof typeof seasonThemes
