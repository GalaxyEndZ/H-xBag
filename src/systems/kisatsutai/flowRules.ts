/** Fluxos de Atributo do Kisatsutai — escolhas cumulativas por graduação.
 * As seleções são gravadas em sheet_data.flows.selections, sem alterar flows.details legado.
 */
export const FLOW_TIERS = ['raposa', 'tigre', 'dragao', 'corvo'] as const
export type FlowTier = typeof FLOW_TIERS[number]
export const FLOW_ATTRIBUTES = ['strength', 'agility', 'defense', 'breathing', 'intellect'] as const
export type FlowAttribute = typeof FLOW_ATTRIBUTES[number]
export type FlowSelections = Partial<Record<FlowTier, FlowAttribute>>
export const FLOW_ATTRIBUTE_LABELS: Record<FlowAttribute, string> = {
  strength: 'FOR', agility: 'AGI', defense: 'DEF', breathing: 'RES', intellect: 'INT',
}
export const FLOW_TIER_LABELS: Record<FlowTier, string> = {
  raposa: 'Raposa', tigre: 'Tigre', dragao: 'Dragão', corvo: 'Corvo',
}
export const FLOW_TIER_RANKS: Record<FlowTier, string> = {
  raposa: 'Mizunoto · Mizunoe · Kanoto',
  tigre: 'Kanoe · Tsuchinoto · Tsuchinoe',
  dragao: 'Hinoto · Hinoe · Kinoto',
  corvo: 'Kinoe · Hashira',
}
export const FLOW_CHOICES: Record<FlowTier, Record<FlowAttribute, { name: string; description: string; automatic: string }>> = {
  raposa: {
    strength: { name: 'Esforço Otimizado', description: 'Move e destrói objetos sem teste em cenas investigativas. Em cenas complexas, como combate ou perseguição, recebe +1d20 especificamente para mover ou destruir objetos ou pessoas. Também possui vantagem em manobras de luta: apenas uma vantagem (+1d20), sem acumular outra vantagem deste mesmo Fluxo.', automatic: '+1d20 em Manobra de Luta, aplicado uma única vez; outras situações exigem decisão do mestre.' },
    agility: { name: 'Sempre Pronto', description: 'Ganha prioridade nos testes em caso de empate de valores, inclusive quando está sendo atacado.', automatic: 'Preferência em empates da ordem de iniciativa; os demais empates dependem do mestre.' },
    defense: { name: 'Moldado no Aço', description: 'Resiste melhor a todas as condições físicas, recebendo +1d20 nos testes correspondentes.', automatic: 'Aplicar +1d20 nos testes contra condições físicas; escolha do tipo de teste pelo mestre.' },
    breathing: { name: 'Concentração Total', description: 'Reduz em 15% o gasto de PR de qualquer movimento que consuma PR.', automatic: 'A redução de 15% deve ser considerada ao pagar PR; arredondamento conforme regra da mesa.' },
    intellect: { name: 'Investigador Nato', description: 'Pode investigar novamente um ponto de interesse já investigado. O limite por ponto de interesse é de 2 testes, mesmo com o Fluxo.', automatic: 'Controle do limite de 2 testes pelo mestre.' },
  },
  tigre: {
    strength: { name: 'Força Sobre-Humana', description: 'Em um golpe crítico, aplica uma condição no alvo, conforme a descrição do ataque: Sangrando (dano contínuo); Vulnerável (desvantagem e −5 em DEF, AGI e FOR); ou Atordoado (sem reações de contra-ataque ou esquiva e com um dado a menos em todos os ataques).', automatic: 'O mestre escolhe/aplica a condição após confirmar o crítico.' },
    agility: { name: 'Precisão e Agilidade', description: 'Reduz a margem de crítico em 1. Imune a Ataques de Oportunidade, podendo reagir caso possua reações sobrando.', automatic: '−1 na margem de crítico.' },
    defense: { name: 'Até o Último Suspiro', description: 'Permanece até 4 rodadas em Morrendo. Escolhe até 3 condições de Gravidade I para se tornar imune.', automatic: 'Seleção das condições imunes e rodadas em Morrendo sob controle do mestre.' },
    breathing: { name: 'Respira... e Expira', description: 'Recupera 1/2 do PR total no sucesso de teste de Respiração ao fim do turno e 1/4 na falha. Recebe +10% de seus Pontos de Foco.', automatic: 'Recuperação aprimorada em teste de Respiração; bônus de foco indicado nas regras.' },
    intellect: { name: 'Pensa Rápido', description: 'Pode realizar Ações Complexas como Ação Livre. Em testes de perícias sem treinamento, faz teste de Intelecto puro, sem penalidades. Ganha mais uma Ação Complexa.', automatic: '+1 vaga de Ação Complexa; ação livre e testes de Intelecto seguem a regra da mesa.' },
  },
  dragao: {
    strength: { name: 'Ímpeto Certeiro', description: 'Ignora 5 pontos de Armadura em seus ataques e aumenta o dano em +2dX Base em todos os ataques.', automatic: 'Exibir bônus e considerar ao calcular dano; aplicação de Armadura conforme alvo.' },
    agility: { name: 'Veloz e Furioso', description: 'Reduz a margem de crítico em 1 e recebe mais uma Ação Extra.', automatic: '−1 na margem de crítico e +1 Ação Extra.' },
    defense: { name: 'Muralha', description: 'Ganha +1 Reação. Quando Morrendo, pode rolar DEF + Vigor para se manter em pé e se mover até 1/2 do deslocamento. Em falha fica no chão, consciente, movendo-se até 1/4. Sem Reação passa a valer Constituição.', automatic: '+1 Reação; deslocamento em Morrendo e Sem Reação conforme regra do mestre.' },
    breathing: { name: 'Domínio Múltiplo', description: 'Pode aprender Respiração Secundária (somente formas Carpa, Raposa e Tigre). Todas as formas podem usar RES + Combate. Imune a Exausto. Ganha +25% de Pontos de Foco e um slot adicional de Forma Corvo.', automatic: 'Registrar respiração, imunidade, foco e slot adicional; utilização pelo mestre.' },
    intellect: { name: 'Precognição', description: 'Imune a ataques furtivos e flanqueados. Escolhe 3 Perícias Extras para Treinamento Completo. Pode ser curado de Louco se sobreviver ao fim da Temporada. Recebe +5 de Armadura Mental permanente e uma Ação Complexa.', automatic: '+1 vaga de Ação Complexa; demais benefícios controlados pelo mestre.' },
  },
  corvo: {
    strength: { name: 'Guerreiro Insuperável', description: '+5 em todos os testes de FOR; +10 em todos os ataques que acertar. Em críticos, dobra os dX da arma. Pode utilizar formas avançadas com FOR.', automatic: '+5 em testes de FOR; demais efeitos aplicados conforme ataque.' },
    agility: { name: 'Velocidade da Luz', description: 'Reduz a margem de crítico em 1. Todos os ataques, inclusive formas especiais e destrutivas, podem usar AGI. Movimento visualmente instantâneo e pode conceder Ataque de Oportunidade quando usado criativamente.', automatic: '−1 na margem de crítico; demais situações decididas pelo mestre.' },
    defense: { name: 'Fortaleza Intocável', description: 'No Bloqueio, falha reduz metade do dano e sucesso reduz todo o dano. Crítico no Bloqueio concede Contra-Ataque. Reações infinitas, exceto quando flanqueado.', automatic: 'Reações infinitas com a exceção de flanqueamento; a aplicação do dano depende do resultado do Bloqueio.' },
    breathing: { name: 'Respiração Absoluta', description: 'Escolhe uma segunda respiração para masterizar, redistribuindo Pontos de Foco. Ganha +10 em testes de RES + Habilidade e +25% de Pontos de Foco.', automatic: '+10 em RES + Habilidade; gestão de respiração e foco pelo mestre.' },
    intellect: { name: 'Quase Onisciente', description: '+10 em testes de Perícias Gerais, Sociais e Naturais (se já tiver Treinamento Médio, ganha +5). Pode escolher 3 Perícias Extras de qualquer arquétipo para aperfeiçoar (+20). Formas avançadas podem usar INT.', automatic: 'Bônus e escolhas de perícias conforme regras e teto efetivo do sistema.' },
  },
}
const GROUP_LEVELS: Record<string, number> = { Civil: -1, Carpa: -1, Raposa: 0, Tigre: 1, 'Dragão': 2, Corvo: 3 }
export function getUnlockedFlowTiers(rankGroup: string): FlowTier[] {
  const limit = GROUP_LEVELS[rankGroup] ?? -1
  return FLOW_TIERS.filter((_, index) => index <= limit)
}
export function getEligibleFlowAttributes(tier: FlowTier, values: Record<FlowAttribute, number>): FlowAttribute[] {
  const limit = tier === 'raposa' ? 4 : tier === 'tigre' ? 3 : tier === 'dragao' ? 2 : 1
  const sorted = [...FLOW_ATTRIBUTES].sort((a, b) => values[b] - values[a])
  const threshold = values[sorted[limit - 1]]
  // Empates no limite preservam todas as escolhas igualmente aptas, sem desempate arbitrário.
  return sorted.filter(attribute => values[attribute] >= threshold)
}
export function flowIsActive(selections: FlowSelections, group: string, tier: FlowTier, attribute: FlowAttribute): boolean {
  return getUnlockedFlowTiers(group).includes(tier) && selections[tier] === attribute
}
export function normalizeFlowSelections(value: unknown): FlowSelections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const output: FlowSelections = {}
  for (const tier of FLOW_TIERS) {
    if (FLOW_ATTRIBUTES.includes(source[tier] as FlowAttribute)) output[tier] = source[tier] as FlowAttribute
  }
  return output
}
