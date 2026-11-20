# HäxBag V205 — Fragmentação do Asteroids corrigida

Corrige a V204, preservando a Arena Infinita, os outros minigames, os rankings e os três desafios diários.

## O que mudou

- A quebra agora gera fragmentos visivelmente separados **no primeiro quadro**.
- Asteroide grande (tier 3) -> 2 médios (tier 2); cada médio -> 2 pequenos (tier 1); pequenos são destruídos.
- Os dois fragmentos ganham impulsos em direções opostas e brilho breve.
- Um curto período de proteção após a quebra evita colisões injustas com a nave quando os fragmentos surgem.
- Tiros agora são testados ao longo do movimento entre quadros, inclusive ao cruzar as bordas do cenário.
- O painel exibe o contador de fragmentações da partida.
- Pontuação por acerto permanece em 20 pontos, sem XP ou upgrades no Asteroids.

## Arquivos alterados

- `src/components/ArcadeCanvasGames.tsx`
- `src/components/ArcadeAsteroidFragmentation.ts` (novo)

## Instalação

Para manter sua pasta `.git` e quaisquer outras alterações, use **HaxBag_Correcao_Asteroids_Fragmentacao_V205.zip** e extraia na raiz do projeto (a pasta que contém `src`), permitindo substituir os arquivos.

O pacote completo é uma alternativa caso você prefira a versão inteira. Preserve seu `.env`.

Não é necessário executar SQL novo.

## Verificação

Testes unitários de lógica executados: grande -> dois médios -> quatro pequenos; ausência de nova divisão dos pequenos; separação visível; detecção de tiros rápidos e de passagem pelas bordas; casos sem colisão.

56 arquivos TypeScript/TSX passaram na verificação sintática. O build completo e a experiência visual no navegador ainda precisam ser testados no ambiente com as dependências instaladas.
