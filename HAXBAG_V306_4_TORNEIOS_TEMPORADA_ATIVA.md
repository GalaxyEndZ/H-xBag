# HäxBag V306.4 — Temporadas ativas no Arcade

## Problema corrigido
A V304 consultava os 60 torneios mais recentes em ordem decrescente de início. Como o SQL cadastra 10 jogos por mês durante 12 meses, o limite podia trazer **apenas competições futuras**, omitindo a temporada que está em andamento. Isso levava ao destaque de datas distantes, como maio de 2027.

## Novo comportamento
- A consulta ao Supabase filtra `starts_at <= agora` e `ends_at > agora`, em vez de buscar os torneios mais novos. O banco continua responsável por criar a temporada mensal com `hax_v304_ensure_season`.
- Os torneios ativos dos diferentes minigames podem ser selecionados por botões; Pong é a preferência inicial, se estiver ativo.
- Nenhuma competição futura é apresentada como a temporada atual. Se não existir uma temporada vigente, a interface informa a ausência.
- Revalidação a cada minuto enquanto a página está visível e no retorno ao aplicativo.
- O ranking corresponde ao torneio selecionado (sem pontuações momentaneamente misturadas ao trocar de jogo).
- Data de encerramento é apresentada como o último dia de participação, já que `ends_at` é exclusivo.

## Arquivos
- `src/components/TournamentsV304.tsx`
- `src/components/arcadeActiveTournaments.ts` (nova regra de seleção)
- `src/components/V304Features.css`
- `tests/arcade-active-tournament.test.mjs` (testes automatizados)
- `package.json`, `package-lock.json` e `mobile/package.json` (versão 0.306.4)

## Instalação e verificação
1. Substitua os arquivos pela atualização mantendo os caminhos.
2. `npm ci`
3. `npm run build`
4. Com Node 22 ou superior: `node --experimental-strip-types --test tests/arcade-active-tournament.test.mjs`
5. `npm run mobile:check`

**Não é necessário executar SQL novo** (a migração V304 já deve estar instalada). A correção afeta o site, o Electron e as próximas compilações Android. Não é necessária uma nova tag/release Windows para testar no site local.

## Validação neste ambiente
- 101 arquivos TS/TSX analisados sem erros sintáticos.
- 78 folhas CSS analisadas sem erros de sintaxe.
- Cinco novos testes de temporadas aprovados; nove testes existentes aprovados.
- `mobile/scripts/check.mjs` aprovado.
- O build completo `tsc -b && vite build` e a execução no Supabase real não foram feitos porque as dependências locais não estão instaladas.
