# HäxBag V219 — Kits equipáveis e descanso

Atualiza os equipamentos de descanso e os bônus de perícia por posição, sem alterar os dados já salvos no Supabase.

| Tipo | Exemplo | Descanso relacionado | Bônus oficiais | Peso |
| --- | --- | --- | --- | --- |
| Equipável simples | Saco de dormir | Precário | Duas perícias gerais/extras: +10 / +10 | 1 kg |
| Equipável padrão | Futon | Mediano | Duas perícias de arquétipo: +15 / +10 | 2 kg (mantido da regra anterior) |
| Equipável raro | Barraca de acampamento | Completo | Três de arquétipo OU duas de arquétipo e uma geral: +15 / +15 / +10 | 4,5 kg (mantido da regra anterior) |

## O que muda

- Editor de kit no Inventário, nas Lojas e no Baú do Mestre: exibe bônus individuais, sem permitir definir valores arbitrários para kits novos.
- Quando o nome ainda não foi informado, sugere automaticamente o item correspondente ao subtipo escolhido.
- Os kits novos passam a guardar `metadata.kitSkillBonuses` (array na ordem das perícias) e `metadata.kitRestType`. Não exige novas colunas nem SQL.
- As fichas e a mesa de combate leem os novos bônus individualmente, apenas com o kit equipado.
- A seção Descanso e Recuperação identifica equipamentos de descanso equipados que correspondem ao descanso selecionado, sem exigir/consumir automaticamente o equipamento nem alterar as fórmulas de recuperação.
- Equipamentos antigos que tenham apenas `metadata.kitSkillBonus` continuam funcionando com o bônus uniforme anterior até serem editados e salvos novamente.
- A antiga opção de proteção moderada do kit padrão e a antiga opção de perícia principal do kit raro continuam disponíveis apenas para editar itens antigos. Não são opções oferecidas na criação de kits novos.
- O efeito exclusivo do kit raro é opcional, porque a regra atualizada não o exige.

## Instalação

Aplique a correção na raiz da sua instalação V218 (sobrescrevendo somente os arquivos relacionados). Não substitua suas pastas `.git`, `node_modules` nem `.env`.

Execute `npm run build` em seu computador antes de publicar. Validação TypeScript executada com sucesso neste ambiente; build Vite não executado devido à dependência nativa ausente no conjunto original de `node_modules` (proveniente de Windows).
