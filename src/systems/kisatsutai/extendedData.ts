// Dados oficiais transcritos do material de Kisatsutai fornecido pelo usuário.
// Habilidades sem descrição permanecem pendentes; não há regras inventadas.
export const KISATSUTAI_TRAINING = { completo: 20, avancado: 15, medio: 10, leve: 5 } as const
export const KISATSUTAI_SKILL_GROUPS = {
  "Defensores": [
    {
      "name": "Atletismo",
      "description": "Mede a habilidade de se manter realizando uma atividade física por mais tempo."
    },
    {
      "name": "Escudo",
      "description": "Mede a habilidade de alguém de utilizar um escudo ou se usar de escudo em situações necessárias."
    },
    {
      "name": "Imobilizar",
      "description": "Mede a capacidade de imobilização de alguém utilizando ou não algum material facilitador. Ex: Imobilizar com as mãos nuas, imobilizar com o auxílio de um laço de corda."
    },
    {
      "name": "Atrair",
      "description": "Mede a capacidade de atrair atenção para si, seja de inimigos ou de outros seres."
    },
    {
      "name": "Deter",
      "description": "Mede a capacidade de lidar com grandes massas"
    },
    {
      "name": "Fortitude",
      "description": "Mede a capacidade de alguém de manter a consciência quando necessário, também serve para aumentar a quantidade de rodadas em um teste de morrendo."
    },
    {
      "name": "Derrubar",
      "description": "Mede a capacidade de derrubar alguém ou algo, utilizando técnicas ou a própria força."
    }
  ],
  "Linha de Frente": [
    {
      "name": "Acrobacia",
      "description": "Mede a capacidade de alguém de realizar acrobacias ou equilibrar-se em cordas/superfícies estreitas ou instáveis. Obs: Pode anular desvantagens em terreno difícil."
    },
    {
      "name": "Reflexos",
      "description": "Mede a capacidade de alguém aumentar a concepção e tempo de reação de alguma ação. Pode ser utilizado também para desviar de algum golpe ou objeto lançado contra o personagem."
    },
    {
      "name": "Liderança",
      "description": "Mede a capacidade em liderar, convencer, motivar e guiar um ou mais grupos de pessoas."
    },
    {
      "name": "Corrida",
      "description": "Mede a capacidade de perseguir um inimigo durante uma perseguição, também serve pra medir a velocidade de deslocamento de um lugar para o outro."
    },
    {
      "name": "Arremesso",
      "description": "Mede a capacidade de arremessar objetos ou armas em um determinado alvo."
    },
    {
      "name": "Saltar",
      "description": "Mede a capacidade e a distância ao saltar."
    },
    {
      "name": "Técnica",
      "description": "Mede o conhecimento de ferramentas e armas diferentes do habitual."
    }
  ],
  "Flanco": [
    {
      "name": "Crime",
      "description": "Mede a capacidade de cometer um crime sem ser notado. Ex: Roubar/ arrombar algum local."
    },
    {
      "name": "Furto",
      "description": "Mede a capacidade de esconder sua Presença. Usado em combate (ataques surpresa) e fora (fugas/situações de furtividade). Obs: Pode ser aprimorado com Vestimentas/Equipamentos para Furto."
    },
    {
      "name": "Infiltração",
      "description": "Mede a capacidade de identificar brechas em um local, identificar um padrão de vigilância, etc."
    },
    {
      "name": "Armadilhas",
      "description": "Mede o conhecimento e habilidade de alguém com a criação ou reconhecimento de armadilhas."
    },
    {
      "name": "Armas Brancas",
      "description": "Mede a capacidade de utilizar armas brancas Ex: Espadas, facas, punhais, adagas, floretes e Katanas. Usado em combate."
    },
    {
      "name": "Trapaça",
      "description": "Mede a capacidade do flanco de perfurar ou danificar a armadura do oponente. (Detalhar melhor ou corrigir)"
    },
    {
      "name": "Camuflagem",
      "description": "Mede a capacidade de camuflar objetos ou auxiliar em testes de furtividade Usado em situações de distração, fuga ou descrição. (Furtividade). Obs: Pode ser aprimorado com Vestimentas/Equipamentos para Camuflagem."
    }
  ],
  "Especialistas": [
    {
      "name": "Reprimir",
      "description": "Mede a capacidade de resistência em testes mentais, como por exemplo testes que envolvam sanidade, também serve para aumentar a quantidade de rodadas em um teste de enlouquecendo."
    },
    {
      "name": "Investigação",
      "description": "Mede a capacidade de encontrar objetos, papéis, cartas que envolvem algum mistério e de organizá-las da melhor forma."
    },
    {
      "name": "Percepção",
      "description": "Mede a capacidade de analisar o que compõe um local e de como as pessoas/coisas interagem com ele."
    },
    {
      "name": "Pontaria",
      "description": "Mede a habilidade de acertar ataques a distância."
    },
    {
      "name": "Linguagem de Código",
      "description": "Mede a capacidade de interrogar e tirar informações de maneira direta de alguém. O personagem definirá o curso que o interrogatório irá criar."
    },
    {
      "name": "Montagem",
      "description": "Mede a capacidade de preparação de equipamentos,e desativação de armadilhas, de forma manual."
    },
    {
      "name": "Preparo",
      "description": "Mede a capacidade de preparar um ambiente em um geral, servindo para estratégias prévias, montagem de emboscadas e preparação."
    }
  ],
  "Suporte": [
    {
      "name": "Primeiros Socorros",
      "description": "Mede o conhecimento básico de primeiros socorros de alguém. Usado em situações de curto prazo e de emergência."
    },
    {
      "name": "Medicina",
      "description": "Mede o conhecimento de medicina de alguém. Ex: Curativos básicos (corte, queimadura ou lesão), técnica de desengasgo, desmaio e intoxicação. Usado em situações de longo prazo."
    },
    {
      "name": "Psicologia",
      "description": "Mede o conhecimento básico de psicologia de alguém. Utilizado em situações de curto prazo e de emergência, relacionadas a dano em sanidade."
    },
    {
      "name": "Terapia",
      "description": "Mede o conhecimento em terapia."
    },
    {
      "name": "Farmácia",
      "description": "Mede o conhecimento de medicamentos sobre alguém. Ex: Remédios e plantas/fungos medicinais. Também pode ser utilizado na criação de algum composto venenoso, calmante, ou, energizante."
    },
    {
      "name": "Demonologia",
      "description": "Mede o conhecimento do jogador em relação aos demônios."
    },
    {
      "name": "Sorte",
      "description": "Mede a sorte de um jogador"
    }
  ],
  "Sociais": [
    {
      "name": "Aparência",
      "description": "Mede a aparência física de alguém. Ex: Usado em situações de flerte."
    },
    {
      "name": "Carisma",
      "description": "Mede a capacidade de causar uma boa impressão em terceiros."
    },
    {
      "name": "Diplomacia",
      "description": "Mede a capacidade de chegar a acordos e tratados com outras pessoas, também mede as habilidades de argumentação em discussões."
    },
    {
      "name": "Discrição",
      "description": "Mede a capacidade de se camuflar socialmente ou evitar ser notado entre pessoas."
    },
    {
      "name": "Enganação",
      "description": "Mede a capacidade de enganar as pessoas, seja por atuação, manipulação de imagem ou manipulação das massas."
    },
    {
      "name": "Intimidação (Humanos)",
      "description": "Mede a capacidade de intimidar seres humanos ou outras criaturas."
    },
    {
      "name": "Intimidação (Onis)",
      "description": "Mede a capacidade de intimidar seres humanos ou outras criaturas."
    },
    {
      "name": "Intuição",
      "description": "Mede a capacidade de entender situações, pessoas e conversas conforme elas são apresentadas."
    },
    {
      "name": "Lábia",
      "description": "Mede a capacidade de contar mentiras, desinformação e histórias fictícias de uma maneira convincente."
    },
    {
      "name": "Popularidade",
      "description": "Mede a fama de uma pessoa (seja boa ou ruim) em uma comunidade."
    },
    {
      "name": "Presença",
      "description": "Mede a capacidade de impor sua presença no local ou chamar a atenção das pessoas no mesmo."
    }
  ],
  "Conhecimentos Gerais": [
    {
      "name": "Anatomia",
      "description": "Mede o conhecimento corporal da pessoa em relação a seres vivos (ou mortos). Ex: Corpos de animais, seres humanos, etc…"
    },
    {
      "name": "Arquitetura",
      "description": "Mede o conhecimento organizacional de um espaço antropizado de alguma pessoa. Ex: Possui o conhecimento dos aspectos artísticos, técnicos, estilos e métodos de alguma edificação."
    },
    {
      "name": "Artes",
      "description": "Mede o conhecimento artístico da pessoa e a sua habilidade com alguma forma artística. Ex: Pintura, desenho, peças teatrais, escultura e dança."
    },
    {
      "name": "Atualidades",
      "description": "Mede os conhecimentos do período presente (atualidade). Ex: Tecnologias atuais, cultura atual, o que está em alta no momento, etc."
    },
    {
      "name": "Ciência Forense",
      "description": "Mede o conjunto de conhecimentos científicos ou técnicos utilizados para desvendar não só crimes, mas também assuntos legais e penais."
    },
    {
      "name": "Comércio",
      "description": "Mede a capacidade de alguém em negociação de compra e venda. Ex: Compras em uma ferraria, mercado, etc…"
    },
    {
      "name": "Contabilidade",
      "description": "Mede o conhecimento sobre cálculos e estudos matemáticos. Ex: Cálculos matemáticos, reconhecimento de padrões/fórmulas, etc…"
    },
    {
      "name": "Culinária",
      "description": "Mede os conhecimentos culinários da pessoa. Ex: Comidas japonesas e variações, conhecimento de chás e ervas usadas como alimento."
    },
    {
      "name": "Cultura",
      "description": "Mede os conhecimentos culturais e sociológicos de alguém sobre uma comunidade ou região. Ex: Terras áridas, Império das Chamas, etc…"
    },
    {
      "name": "Engenharia",
      "description": "Mede o conhecimento em montagem ou identificação de mecanismos e estruturas mecânicas. Ex: conhecimento sobre máquinas, dispositivos, etc."
    },
    {
      "name": "História",
      "description": "Mede o conhecimento histórico de alguém. Ex: Períodos históricos relevantes, figuras marcantes para a história japonesa"
    },
    {
      "name": "Literatura",
      "description": "Mede o conhecimento da pessoa com a literatura. Ex: Contos, poemas, fábulas, livros (gêneros narrativos, líricos e dramáticos)."
    },
    {
      "name": "Música",
      "description": "Mede os conhecimentos musicais de alguém, envolvendo tanto habilidades com instrumentos, tanto habilidades de canto ou de ritmo e melodia. Ex: Conhecimentos musicais, reconhecimentos de padrões de sons musicais, etc…"
    },
    {
      "name": "Química",
      "description": "Mede o conhecimento químico de alguém. Ex: Substâncias, reações, fórmulas químicas e experimentos relacionados à química. Pode ser utilizado em situações em que uma análise de ambiente seja encontrada alguma substância/material."
    },
    {
      "name": "Religião",
      "description": "Mede o conhecimento religioso da pessoa. Ex: Conhecimento sobre a religião Budista, xintoísta, templos e seus rituais."
    }
  ],
  "Naturais": [
    {
      "name": "Adestramento (Animais Domésticos)",
      "description": "Mede a capacidade de adestramento de animais domésticos. Ex: Gatos, cachorros, cavalos, gado, patos, porcos, hamsters e algumas espécies de pássaros."
    },
    {
      "name": "Adestramento (Animais Silvestres)",
      "description": "Mede a capacidade de adestramento de animais silvestres/selvagens. Ex: Coelhos, cobras, sapos, macacos, javalis, esquilos e algumas espécies de pássaros."
    },
    {
      "name": "Escalar",
      "description": "Mede a habilidade de alguém de escalar locais altos, íngremes ou montanhosos. Ex: Subir em montanhas, casas, etc…"
    },
    {
      "name": "Localizar",
      "description": "Mede o conhecimento de uma pessoa sobre um local específico. Ex: Cidades, vilarejos, trilhas, etc."
    },
    {
      "name": "Mergulho",
      "description": "Mede a habilidade de alguém na área de mergulho e natação. Ex: O quão bem nadar em águas doces e salgadas."
    },
    {
      "name": "Navegar",
      "description": "Mede a capacidade de navegar em água salgada ou doce. Ex: Tipos de marés ou correntes, barcos indicados para cada tipo de situação."
    },
    {
      "name": "Sobrevivência",
      "description": "Mede os conhecimentos e habilidades de sobrevivência de alguém. Ex: Caçar animais, reconhecer/evitar os perigos da natureza e suas vantagens."
    },
    {
      "name": "Sobriedade",
      "description": "Usado em testes envolvendo bebidas alcoólicas ou substâncias alucinógenas. Ex: Resistir ao beber drinks, consumir cogumelos alucinógenos, etc…"
    }
  ]
} as const
export const KISATSUTAI_PATHS = {
  "Assassino": {
    "japanese": "Satsujin",
    "combination": "Linha de Frente e Flanco",
    "benefits": {
      "Linha de Frente Assassino": [
        "Treinamento Avançado em 2 Perícias de Linha de Frente",
        "Treinamento Médio em 2 Perícias de Linha de Frente",
        "Treinamento Médio em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 2 Perícias de Defensor",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ],
      "Flanco Assassino": [
        "Treinamento Avançado em 2 Perícias de Flanco",
        "Treinamento Médio em 2 Perícias de Flanco",
        "Treinamento Médio em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 2 Perícias de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Suporte/Defensor",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": null,
        "description": null
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  },
  "Estrategista": {
    "japanese": "Shinobi",
    "combination": "Flanco e Especialista",
    "benefits": {
      "Flanco Estrategista": [
        "Treinamento Avançado em 2 Perícias de Flanco",
        "Treinamento Médio em 2 Perícias de Flanco",
        "Treinamento Médio em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 2 Perícias de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 1 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 5 Perícias Gerais",
        "Treinamento Médio em 5 Perícias Gerais",
        "Treinamento Leve em 5 Perícias Gerais"
      ],
      "Especialista Estrategista": [
        "Treinamento Avançado em 2 Perícias de Flanco",
        "Treinamento Médio em 2 Perícias de Flanco",
        "Treinamento Médio em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 2 Perícias de Suporte",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 2 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 6 Perícias Gerais",
        "Treinamento Médio em 6 Perícias Gerais",
        "Treinamento Leve em 6 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": "Mão Lisa",
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": "O jogador ganha a capacidade de identificar o equipamento e inventário de um alvo, podendo realizar um teste para roubar ou furtar um equipamento (não podendo ser armadura). Pode ser a arma se o alvo não perceber."
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": null,
        "description": "O jogador ganha a habilidade de “encantar” uma arma com uma forma de respiração, de até 3 usos."
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  },
  "Detetive": {
    "japanese": "Keiji",
    "combination": "Especialista e Suporte",
    "benefits": {
      "Especialista Detetive": [
        "Treinamento Avançado em 2 Perícias de Especialista",
        "Treinamento Médio em 2 Perícias de Especialista",
        "Treinamento Médio em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 2 Perícias de Flanco",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 2 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 6 Perícias Gerais",
        "Treinamento Médio em 6 Perícias Gerais",
        "Treinamento Leve em 6 Perícias Gerais"
      ],
      "Suporte Detetive": [
        "Treinamento Avançado em 2 Perícias de Suporte",
        "Treinamento Médio em 2 Perícias de Suporte",
        "Treinamento Médio em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 2 Perícias de Defensor",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 5 Perícias Gerais",
        "Treinamento Médio em 5 Perícias Gerais",
        "Treinamento Leve em 5 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": null,
        "description": null
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  },
  "Guardião": {
    "japanese": "Shugotenshi",
    "combination": "Suporte e Defensor",
    "benefits": {
      "Defensor Guardião": [
        "Treinamento Avançado em 2 Perícias de Defensor",
        "Treinamento Médio em 2 Perícias de Defensor",
        "Treinamento Médio em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 2 Perícias de Linha de frente",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ],
      "Suporte Guardião": [
        "Treinamento Avançado em 2 Perícias de Suporte",
        "Treinamento Médio em 2 Perícias de Suporte",
        "Treinamento Médio em 1 Perícia de Defensor",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 2 Perícias de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": null,
        "description": null
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  },
  "Guerreiro": {
    "japanese": "Senshi",
    "combination": "Defensor e Linha de Frente",
    "benefits": {
      "Linha de Frente Guerreiro": [
        "Treinamento Avançado em 2 Perícias de Linha de Frente",
        "Treinamento Médio em 2 Perícias de Linha de Frente",
        "Treinamento Médio em 1 Perícia de Defensor",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 2 Perícias de Flanco",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ],
      "Defensor Guerreiro": [
        "Treinamento Avançado em 2 Perícias de Defensor",
        "Treinamento Médio em 2 Perícias de Defensor",
        "Treinamento Médio em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 2 Perícias de Flanco",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": "Cai Dentro",
        "description": "O jogador pode gastar 20PR para chamar um alvo para um combate mano-a-mano, onde não será necessário jogar o teste do ataque, apenas o dano. O alvo deverá fazer um teste Mental para resistir (DT 20). Se o alvo falhar e recusar o desafio, o jogador poderá provocá-lo, o deixando com a condição Atordoado por 1 rodada. O jogador poderá realizar um teste de INT + Atrair para aumentar a DT (Se o valor for de 15 a 19 = +1 no teste. Se for entre 20 e 25 = +2. Se for entre 25 e 30 = +3 no teste; Se for entre 30 e 35 = +4 no teste. Se o for entre 35 e 40 = +5 no teste). Suas ações serão alternadas, e ficarão o turno todo somente atacando (ou até algum dos dois cair). Ambos poderão realizar um teste de FOR + Luta para aumentar o dano de seus ataques (Se o valor for de 15 a 19 = +1 no dano; Se for entre 20 e 25 = +2 no dano; Se for entre 25 e 30 = +3 no dano; Se for entre 30 e 35 = +4 no dano; Se o for entre 35 e 40 = +5 no dano). Quem sair do desafio por conta própria fica com a condição \"Vulnerável\" por 1 rodada."
      },
      "Kinoe": {
        "name": "Frenesi",
        "description": "Quando chega a 0 de vida, o jogador entra em um estado de adrenalina pura, se mantendo em pé por 2 turnos e se tornando invencível a todos os golpes que recebe. Todo o dano que ele receber durante os 2 turnos, serão acumulados para devolver no seu último ataque. Assim que o estado de Frenesi acabar, ele entrará automaticamente no estado de Morrendo."
      }
    }
  },
  "Duelista": {
    "japanese": "Guntai",
    "combination": "Linha de Frente e Especialista",
    "benefits": {
      "Especialista Duelista": [
        "Treinamento Avançado em 2 Perícias de Especialista",
        "Treinamento Médio em 2 Perícias de Especialista",
        "Treinamento Médio em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 2 Perícias de Flanco",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 2 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 6 Perícias Gerais",
        "Treinamento Médio em 6 Perícias Gerais",
        "Treinamento Leve em 6 Perícias Gerais"
      ],
      "Linha de Frente Duelista": [
        "Treinamento Avançado em 2 Perícias de Linha de Frente",
        "Treinamento Médio em 2 Perícias de Linha de Frente",
        "Treinamento Médio em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 2 Perícias de Defensor",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 5 Perícias Gerais",
        "Treinamento Médio em 5 Perícias Gerais",
        "Treinamento Leve em 5 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": null,
        "description": null
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  },
  "Sentinela": {
    "japanese": "Kakuheki",
    "combination": "Especialista e Defensor",
    "benefits": {
      "Defensor Sentinela": [
        "Treinamento Avançado em 2 Perícias de Defensor",
        "Treinamento Médio em 2 Perícias de Defensor",
        "Treinamento Médio em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 2 Perícias de Linha de Frente",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de qualquer Arquétipo",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ],
      "Especialista Sentinela": [
        "Treinamento Avançado em 2 Perícias de Especialista",
        "Treinamento Médio em 2 Perícias de Especialista",
        "Treinamento Médio em 1 Perícia de Defensor",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Leve em 2 Perícias de Suporte",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Leve em 2 Perícias de qualquer Arquétipo",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": null
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": null,
        "description": null
      },
      "Hinoe": {
        "name": null,
        "description": null
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  },
  "Socorrista": {
    "japanese": "Kyūjo-sha",
    "combination": "Suporte e Flanco",
    "benefits": {
      "Flanco Socorrista": [
        "Treinamento Avançado em 2 Perícias de Flanco",
        "Treinamento Médio em 2 Perícias de Flanco",
        "Treinamento Médio em 1 Perícia de Suporte",
        "Treinamento Leve em 1 Perícia de Suporte",
        "Treinamento Leve em 2 Perícias de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Linha de Frente",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ],
      "Suporte Socorrista": [
        "Treinamento Avançado em 2 Perícias de Suporte",
        "Treinamento Médio em 2 Perícias de Suporte",
        "Treinamento Médio em 1 Perícia de Flanco",
        "Treinamento Leve em 1 Perícia de Flanco",
        "Treinamento Leve em 2 Perícias de Especialista",
        "Treinamento Leve em 1 Perícia de Especialista",
        "Treinamento Leve em 1 Perícia de Defensor",
        "Treinamento Avançado em 4 Perícias Gerais",
        "Treinamento Médio em 4 Perícias Gerais",
        "Treinamento Leve em 4 Perícias Gerais"
      ]
    },
    "abilities": {
      "Mizunoe": {
        "name": null,
        "description": "(Kanoe)\nO jogador"
      },
      "Kanoe": {
        "name": null,
        "description": null
      },
      "Tsuchinoe": {
        "name": "Nas Entrelinhas",
        "description": "O jogador ganha +10 em todos os testes de Primeiros Socorros ou Psicologia se estiver em modo Furtivo."
      },
      "Hinoe": {
        "name": null,
        "description": null
      },
      "Kinoe": {
        "name": null,
        "description": null
      }
    }
  }
} as const
export const KISATSUTAI_ONI_CLASSES = {
  "Rastreador": "Encontra presas, costuma agir sozinho ou com outros rastreadores e procura famílias isoladas.",
  "Destruidor": "Oni agressivo, movido pela fome, frequentemente em combate com Kisatsutai; coopera com errantes, não com outros destruidores.",
  "Errante": "Oni sádico e manipulador, costuma agir em cidades e se camuflar por meio de criminosos humanos ou manipular destruidores.",
  "Lúcido": "Oni exótico de vida longa e raciocínio avançado, negocia favores e manipula outros Onis ou humanos."
} as const
