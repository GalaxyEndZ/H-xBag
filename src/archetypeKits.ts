export type ArchetypeKit = { archetype: string; name: string; mode: 'equipavel' | 'consumivel'; weight: number; description: string; uses: number | null }
export const ARCHETYPE_KITS: ArchetypeKit[] = [
  { archetype: "Yōgosha", name: "Kit de Aprimoramento de Armadura", mode: 'equipavel', weight: 3, description: "+5 em Contra-Ataque; armadura física igual à Resistência; -1 ação extra; -1 dado em testes de Agilidade.", uses: null },
  { archetype: "Saizensen", name: "Kit de Afiação", mode: 'consumivel', weight: 2, description: "+2dX ao dano base até o fim da cena. Em combate, custa uma ação completa.", uses: 3 },
  { archetype: "Saizensen", name: "Kit de Bainha Aprimorada", mode: 'equipavel', weight: 1.5, description: "Permite sacar a lâmina usando uma ação de movimento.", uses: null },
  { archetype: "Sokumen", name: "Kit de Traje Furtivo", mode: 'equipavel', weight: 2.5, description: "+5 em Furtividade e Camuflagem.", uses: null },
  { archetype: "Sokumen", name: "Kit de Armadilhas", mode: 'consumivel', weight: 2, description: "+10 em Armadilha; dano dobrado em armadilhas ofensivas; permite detectar falhas e desativar armadilhas.", uses: 3 },
  { archetype: "Sokumen", name: "Kit de Arrombamento", mode: 'consumivel', weight: 2, description: "+5 em Crime e Linguagem de Código.", uses: 3 },
  { archetype: "Gijutsu", name: "Kit de Anotações", mode: 'equipavel', weight: 0.5, description: "+5 em Investigação; pode obter pista simples de documento já encontrado, a critério do mestre.", uses: null },
  { archetype: "Gijutsu", name: "Kit de Investigador Forense", mode: 'consumivel', weight: 1, description: "+10 em Investigação, Ciência Forense e Cena do Crime; análise de 1 hora pode reconstruir a cena conforme o teste.", uses: 3 },
  { archetype: "Gijutsu", name: "Kit de Amuleto Mental", mode: 'equipavel', weight: 1, description: "Armadura mental igual à metade da perícia Mental; gastar uma reação para +5 no teste de sanidade.", uses: null },
  { archetype: "Senmon", name: "Kit de Primeiros Socorros", mode: 'consumivel', weight: 2, description: "Kit para estabilizar ferimentos graves; 3 usos.", uses: 3 },
  { archetype: "Senmon", name: "Kit de Terapeuta", mode: 'consumivel', weight: 2, description: "Recupera 1d8 PS por uso; pode ser dividido entre até quatro pessoas.", uses: 3 },
  { archetype: "Senmon", name: "Kit de Tratamentos Prolongados", mode: 'consumivel', weight: 2, description: "Recupera 2d8 PV por uso; cura dobrada com descanso completo, sem acumular.", uses: 3 },
]
