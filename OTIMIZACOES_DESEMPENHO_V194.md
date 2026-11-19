# HäxBag V194 — Otimização de desempenho

Base: projeto enviado pelo usuário em 19/11/2026 (`haxbag(20261119-210459).zip`).

## O que foi modificado

- `src/components/ArcadeCanvasGames.tsx`: mapa procedural da Arena pré-renderizado por tile em um cache LRU limitado a 180 células (aproximadamente 4,7 MB de pixels). Tiles existentes reutilizados mesmo com a câmera em movimento. Cálculos de distância quadrática nas colisões e busca de alvo, reduzindo chamadas caras a `Math.hypot`. Fundo em grade dos jogos de ação armazenado em canvas para evitar dezenas de traços a cada frame. Loops de RAF são desligados durante pausa, preservando o frame atual. Snake: criação de alimento com `Set` e busca visual do corpo com `Map`, evitando varreduras aninhadas durante a montagem de 400 células.
- `src/components/PongGame.tsx`: quadra, grade e rótulos estáticos gerados uma vez para cada escala do dispositivo (até três entradas de cache). A cada frame são desenhadas apenas a imagem do fundo, as raquetes e a bola. Formatador de números compartilhado.
- `src/components/MinigamesHub.tsx`: importações dinâmicas para Pong, jogos de Canvas e jogos de tabuleiro. Cada família é carregada apenas quando utilizada, usando `Suspense` no espaço do jogo. Formatadores de data e números compartilhados.
- `src/components/ArcadePuzzleGames.tsx`: cronômetro atualiza no máximo uma vez por segundo (antes eram 4 disparos por segundo), preservando o tempo acumulado e descontando as pausas.
- `src/components/FriendsPanel.tsx`: normalização dos termos de busca feita uma vez por filtragem (em vez de uma vez por item) nas buscas de pessoas, feed e mensagens.
- `src/components/SocialPostComments.tsx`: estrutura de respostas/threads memoizada; só é reagrupada quando a lista de comentários muda, e não a cada edição do texto.

## Preservado

- Nove minigames e suas regras, mapa ilimitado da Arena, tiros manuais e partidas infinitas até perda/encerramento.
- Ranking global, horários de Brasília, catálogo de desafios e prêmio de 1 a 10 moedinhas apenas após completar o conjunto de 3.
- Perfis, feed, chats, fotos, campanhas, fichas e regras do RPG.
- Não existem alterações no esquema ou nas funções do Supabase nesta versão. **Nenhum SQL novo.**

## Verificações

- Sintaxe TypeScript/TSX: 50 arquivos analisados, 0 erros de sintaxe.
- Teste isolado da Arena: renderização repetida da mesma região não cria novos tiles; em 300 posições, cache <= 180; terreno determinístico inclusive em coordenadas negativas.
- Teste isolado do Pong: 100 quadros reutilizam um único fundo; outra escala cria outro buffer.
- Importações locais dos cinco módulos inspecionados resolvidas.
- Estrutura e integridade do ZIP testadas após a criação.
- Não foi possível executar `npm ci`/`npm run build` completos: o pacote `vite` não estava no cache npm e não havia rede disponível. Verifique no ambiente com as dependências instaladas.

## Instalação / teste manual recomendado

1. Faça backup do projeto e mantenha seu `.env` atual (o ZIP não contém credenciais).
2. Atualize os arquivos do projeto usando esta versão.
3. Na pasta do projeto: `npm ci` e `npm run build`.
4. Teste pausar/retomar a Arena e o Pong, deslocar-se longas distâncias na Arena e voltar a regiões visitadas, alternar jogos e verificar o carregamento dos rankings e dos desafios.

**Observação:** otimizações foram concentradas nos pontos com trabalho repetido por frame e nas áreas Social/Arcade. Não foi realizada reestruturação completa do arquivo `App.tsx` nem aferição de FPS em um navegador real.
