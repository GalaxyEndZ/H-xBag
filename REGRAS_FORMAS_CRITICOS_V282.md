# HäxBag V282 — Formas de Respiração e crítico por atributo

## Integrado

- Raposa, Tigre e Dragão: fórmulas, três tipos de forma e custos fixos de PR. Custo aparece preenchido automaticamente, mas permanece editável para regras especiais da mesa.
- Forma Destrutiva Tigre/Dragão: opção de ataque direto (FOR) ou à distância/em área (AGI). A variante à distância usa a fórmula reduzida e não soma o dado de Dano Base.
- Formas Ofensivas: escolha entre FOR (bônus no dano) e AGI (bônus no teste do ataque).
- Formas Defensivas: descrições e valores de bônus à DT de Contra-Ataque (+3/+6/+12) apresentados para consulta. Ativação e gasto em reações especiais ainda exigem decisão/ação do mestre; não aplicá-los automaticamente ao botão normal de Contra-Ataque.
- Crítico usa **classificação + atributo da rolagem**: FOR, AGI, INT ou RES; tabelas de dados, condições e redução do PR de movimento.
- Condições críticas vêm com duração rolada (incluindo 1d2, 1d3, 1d4+2, 1d6+2), mas não são aplicadas automaticamente à ficha de ninguém. O mestre decide quais condições e quando aplicar.
- Crítico fica vinculado ao último teste ofensivo que **confirmou o acerto** na aba Ações. Alterar a configuração da Forma invalida a confirmação anterior. Não existe marcação manual independente de crítico na seção Dano.
- Os valores de custos de PR são efetivamente descontados após persistência bem-sucedida e antes da rolagem do dano; nenhum PV/PS é alterado no painel Dano.
- Carpa: catálogo informativo Controle/Suporte/Cura, sem rolagem de ataque mental como se fosse dano físico.
- Formas Corvo: valores legados de fórmula mantidos; custos e efeitos oficiais ainda não foram definidos nas regras enviadas, por isso o custo permanece manual.

## Limites atuais

- Mecânicas especiais dependentes de mesa (múltiplos ataques, reflexo de disparos, área, múltiplas reações, armadura temporária, retorno de dano) são descritas, mas não executam ações múltiplas automaticamente.
- A redução de PR de movimento dos críticos de RES é informada no resultado; não reduz o custo de uma Forma padrão, pois as regras especificam **movimento**.
- Condições de grau I/II não foram convertidas automaticamente para os níveis de Gravidade da biblioteca de Condições. O mestre deve decidir essa correspondência.
- Os críticos de classificação Corvo continuam sem uma tabela oficial definida.

## Divergências nas regras textuais

- Dragão Destrutiva: `3d6+3d4+10` tem dano máximo matemático **40**, e não 44.
- Dragão Ofensiva: `4d6+2d4+4` tem máximo **36**; com bônus +7 de FOR dá **43**, e não 41.

A implementação segue as **fórmulas escritas** e não altera os dados para atingir os máximos divergentes.

## Arquivos

- `src/combatCriticalRules.ts`: regras do crítico por atributo e classe.
- `src/breathingFormRulesV282.ts`: catálogo de formas, custos, bônus e restrições.
- `src/components/CombatDamageRollerV274.tsx`: rolagem com custo de PR automático e efeitos críticos vinculados.
- `src/combatAttackDamageV274.ts`: compatibilidade com a nova tabela de crítico.
- `src/CombatDamageV282.css`: estilo das novas opções.
- `src/App.tsx`: sincronização com ataques, DT, crítico e formulário de dano.

## Aplicação

Substituir os arquivos correspondentes no projeto. Não há mudança de schema nem SQL novo. Validar `npm run build` no Windows antes de publicar.
