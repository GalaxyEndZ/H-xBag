# HäxBag V272 — Combate, críticos e iniciativa

## Instalação
Extraia o ZIP de atualização na pasta principal `haxbag` mantendo a estrutura dos diretórios, substituindo os arquivos. Reinicie o Vite com `npm run dev` e, para checagem no Windows, rode `npm run build`.

## Mudanças
- Aba 3. Combate reorganizada em seções de Arsenal/Dano, Críticos/Defesa, Mobilidade e Iniciativa.
- Crítico: a margem base em `combat.critical` permanece intacta; margem efetiva reflete condições e reduções cumulativas dos Fluxos Tigre, Dragão e Corvo de AGI.
- 1 natural falha; 20 natural garante o acerto. Margem crítica inferior a 20 só acrescenta dano quando um ataque acerta a DT informada.
- As rolagens de Ataque permitem informar DT do alvo e classificação da forma (sem Respiração, Raposa, Tigre ou Dragão). O acréscimo de dados usa o dado da arma equipada.
- Fluxo Corvo FOR dobra os dados extras de crítico; Fluxo Tigre FOR indica condições possíveis a cargo do mestre. Bloqueio com Fortaleza Intocável reduz dano e sinaliza contra-ataque no crítico; Esquiva permanece sem crítico.
- Iniciativa: teste `(1 + AGI)d20 + Destreza de armadura` com dados adicionais de kits e campo de bônus situacional para habilidades como Iniciativa Aprimorada.
- A cada ponto ímpar de AGI ganha Ação Extra; a cada ponto par, Movimento (com 1 movimento inicial). Cada turno admite até 3 ações. Os turnos excedentes aparecem no Escudo do Mestre com metade da iniciativa principal, sem criar cópias salvas na ficha.
- Sempre Pronto (Raposa/AGI) é considerado antes do desempate por Agilidade.
- Resumo de Combate passa a exibir a quantidade total de ações e os turnos previstos por rodada.

## Limitações
- Efeitos sujeitos à narrativa/mestre, especialmente condições, vantagem na próxima rolagem e ataque de oportunidade, não são aplicados automaticamente.
- Efeitos temporários de condições podem alterar o número de ações durante a cena. Revise o quadro de turnos no Escudo do Mestre quando isso ocorrer.
- Bônus de Iniciativa Aprimorada é inserido manualmente no campo situacional, pois não está garantida uma fonte estruturada para a aquisição dessa habilidade.
- Apenas `combat.initiative` (valor principal) é gravado. Turnos extras são derivados em tempo de exibição.
- Validação feita com `tsc --noEmit`; build completo de Vite não disponível neste ambiente devido a dependência nativa ausente.

Não há migração SQL.
