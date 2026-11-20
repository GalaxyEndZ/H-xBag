# HäxBag V207 — Snake, 2048 e Campo Minado

Atualização visual, baseada na V206. Nenhuma migração SQL necessária.

## Snake
- Painel compacto com pontuação, rodada, tamanho e velocidade.
- Tabuleiro escuro em tons de floresta, segmentos da serpente com gradiente e cabeça orientada à direção do movimento.
- Frutas realçadas com brilho suave e indicação da pontuação por fruta.
- Controles direcionais em cruz, com suporte contínuo a setas, WASD e deslize.

## 2048
- Blocos com paleta de cores própria para cada número, incluindo os valores superiores a 2048.
- Animação curta ao aparecer/alterar uma peça e legibilidade aprimorada em celulares.
- Placar separado para pontos, maior peça e movimentos.
- Orientações e controles em cruz.

## Campo Minado
- Novo tabuleiro com casas tridimensionais e cores distintas para as pistas numéricas.
- Indicador de progresso de casas seguras e contagem de minas restantes.
- Modos **Revelar** e **Bandeira** visíveis, sem alterar a funcionalidade de clique direito.
- Estado de vitória, mensagens de orientação e passagem de rodada destacados.

## Compatibilidade
- Mesmos cálculos de pontuação e mesma lógica de jogos infinitos da V206.
- Rankings globais, desafios diários e carteira de moedas intactos.
- Sem mudanças no banco, Arena, Asteroids, RPG, Social ou autenticação.

## Arquivos alterados
- `src/components/ArcadeCanvasGames.tsx`
- `src/components/ArcadePuzzleGames.tsx`
- `src/components/MinigamesHub.tsx`
- `src/components/ArcadeBoardVisualsV207.css` (novo)

## Verificação
- Transpilação/parsing de todos os 55 arquivos TypeScript/TSX: sem erros de sintaxe.
- Parsing de todos os 57 arquivos CSS: sem erros.
- O build completo precisa ser executado com as dependências instaladas: `npm ci && npm run build`.
