# HäxBag V188 — Minigames / Pong

## Instalação

1. Substitua os arquivos do projeto pelos desta versão, mantendo seu `.env` e suas configurações locais.
2. Execute **`HaxBag_Pong_Ranking_V188.sql`** no SQL Editor do Supabase, após as migrações das versões anteriores.
3. Execute `npm install` e `npm run build` (ou `npm run dev` para testes locais).
4. Abra **Minigames** ao lado de **Social** e **RPG** e clique em **Começar partida**.

## Como jogar

- Controle a raquete azul com **W / S**, **setas ↑ / ↓**, **mouse** ou **toque**.
- **Espaço** pausa e retoma a partida; a partida pausa ao ocultar a aba.
- Cada devolução da bola vale **1 ponto**; cada gol marcado contra o computador vale **5 pontos**.
- Você tem **3 vidas**; quando acabar, a partida termina e a melhor pontuação fica no ranking global.
- Cada jogador aparece apenas uma vez na classificação, com seu melhor resultado.
- O ranking mostra os 25 maiores recordes; sua própria posição é exibida mesmo quando está fora do top 25.

## Banco e segurança

O SQL adiciona `hax_pong_runs`, `hax_pong_scores` e quatro funções RPC:
`hax_pong_start`, `hax_pong_finish`, `hax_pong_leaderboard` e `hax_pong_my_score`.

- O ranking exige login e conta identificada pelo `auth.uid()`.
- Tabelas com RLS habilitada, sem escrita direta do cliente; inserções e atualizações são feitas por RPC com verificação de dono da partida.
- Cada partida é enviada **uma única vez**; existe limite plausível de pontuação em função do tempo registrado pelo servidor.
- O Pong ainda abre se a migração estiver ausente, mas a pontuação não poderá ser registrada.
- **Limite de integridade:** o jogo roda no navegador, então a pontuação ainda pode ser falsificada por um cliente malicioso que respeite limites plausíveis. Para um ranking competitivo à prova de manipulação é necessário simular/verificar partidas no servidor.

## Navegação

A área usa `hb_page=minigames` na URL. Voltar e Avançar do navegador funcionam como na V187. A opção está no menu lateral, na barra superior e no atalho de navegação para celular.

## Testes realizados nesta entrega

- Validação sintática TypeScript/TSX.
- Testes da serialização da URL e reconhecimento de `hb_page=minigames`.
- Verificação da presença das funções e proteções na migração SQL.
- Validação de integridade do arquivo ZIP.

A compilação com `npm run build` e a execução real da migração no Supabase **não** foram validadas neste ambiente: o cache npm não contém as dependências do projeto.
