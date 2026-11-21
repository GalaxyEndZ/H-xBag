/** Níveis internos mantidos para compatibilidade com o Supabase e condições existentes.
 * A natureza define a terminologia, não altera automaticamente os efeitos.
 */
export const CONDITION_LEVELS = ['normal', 'grave', 'critica'] as const

const LABELS:Record<string,Record<string,string>> = {
  ruim: { normal:'Normal', grave:'Grave', critica:'Crítica' },
  boa: { normal:'Leve', grave:'Potente', critica:'Excepcional' },
  neutra: { normal:'Leve', grave:'Moderada', critica:'Intensa' },
}

export function conditionNatureClass(polarity?:string|null):string {
  return polarity==='boa'?'polarity-boa':polarity==='neutra'?'polarity-neutra':'polarity-ruim'
}

export function conditionLevelLabel(level:string,polarity?:string|null):string {
  const nature=polarity==='boa'?'boa':polarity==='neutra'?'neutra':'ruim'
  return LABELS[nature][level] || LABELS.ruim[level] || 'Normal'
}

export function conditionLevelFieldLabel(polarity?:string|null):string {
  if(polarity==='boa')return 'Potência'
  if(polarity==='neutra')return 'Intensidade'
  if(polarity==='ruim'||!polarity)return 'Gravidade'
  return 'Nível'
}

/** Usado em filtros mistos: uma escolha inclui o mesmo nível interno nas três naturezas. */
export function conditionLevelFilterLabel(level:string,polarity?:string|null):string {
  if(polarity==='todas') {
    const levels:Record<string,string>={normal:'Nível 1 · Baixo',grave:'Nível 2 · Intermediário',critica:'Nível 3 · Alto'}
    return levels[level]||level
  }
  return conditionLevelLabel(level,polarity)
}
