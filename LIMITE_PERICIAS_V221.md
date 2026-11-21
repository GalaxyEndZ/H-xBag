# HäxBag V221 — Limite +25 nas perícias do Kisatsutai

## Atualização
- Perícias gerais/extras e perícias de arquétipo agora aceitam treinamento de até +25.
- Desenvolvimento por Intelecto: cada ponto ainda vale +5; os seletores impedem exceder o limite.
- O valor exato do treinamento passa a ser salvo em `skills.extraTrainingBonuses` (junto a `skills.extraTrainings` legado). Fichas antigas continuam compatíveis e **não são alteradas automaticamente**.
- O bônus **efetivo total** de cada perícia (treinamento, modificadores de condições, kits e preparo aplicáveis) tem teto +25. Penalidades continuam valendo.
- Exibição de treinamento, testes de perícia, ações complexas e painel de condições usam o valor correto.
- As seis perícias principais não são afetadas.

## Instalar
Extraia o ZIP de correção na raiz do projeto V220, substituindo os arquivos em `src/`.
Não execute SQL. Nenhuma migração é necessária: os novos valores numéricos são salvos no JSON das fichas quando editados.

## Validação
`tsc -b --force` passou sem erros. Testes do helper de limites, inclusive de compatibilidade com valores antigos, passaram.
O Vite não concluiu o build neste ambiente: falta o binário nativo `@rolldown/binding-linux-x64-gnu` nas dependências fornecidas para Windows. Execute `npm run build` no Windows antes de publicar.
