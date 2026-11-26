# HäxBag V304.6 — correção de compilação no Arcade

- Em `src/components/TournamentsV304.tsx`, substituído `game?.label` por `game?.title`.
- A definição `ARCADE_GAMES` já fornece `title`, não `label`.
- Atualizados `package.json` e `package-lock.json` para `0.304.6`.
- Incluído teste de regressão sem dependências npm: `tests/arcade-catalog-metadata.test.cjs`.
- Todas as alterações visuais da V304.5 foram preservadas.

## Validação

`node --test tests/arcade-catalog-metadata.test.cjs tests/desktop-update.test.cjs`

Antes de publicar a tag `v0.304.6` no GitHub, confirme que `npm ci && npm run build` termina sem erros.
