# HäxBag V204 — Asteroids e Voo Infinito

Base: HäxBag V203. Esta versão altera a jogabilidade e a apresentação de dois minigames, sem modificar o banco de dados, os rankings ou o catálogo de desafios.

## Asteroids — arcade clássico aprimorado

- Asteroides com três tamanhos e silhuetas irregulares. Rochas grandes se fragmentam em duas médias; médias se fragmentam em duas pequenas.
- Cada acerto que destrói um fragmento vale 20 pontos, preservando a pontuação básica de Asteroids e as metas do catálogo existente.
- Colisão toroidal: nave, tiros e asteroides atravessam as bordas e interagem corretamente ao redor do mapa.
- Novos asteroides aparecem com distância de segurança da nave; dificuldade cresce gradualmente por tempo e pontos, sem fase final.
- Movimento da nave com inércia mais previsível, aceleração, rotação, freio manual, impulso visual e invulnerabilidade temporária após sofrer dano.
- Fundo de estrelas, rachaduras nos asteroides, partículas de impacto e vibração visual curta.
- Controles: A/D ou ←/→ para girar; W/↑ para acelerar; S/↓ para frear; Espaço para atirar. Botões para tela de toque.
- **Sem experiência, níveis ou seleção de upgrades.** Essas mecânicas permanecem exclusivas da Arena Infinita.

## Voo Infinito — jogabilidade e cenário

- Fundo redesenhado com gradiente, estrelas, nuvens e montanhas em paralaxe; pássaro com animação das asas e rastro do impulso.
- Aberturas dos obstáculos variam gradualmente de forma a evitar saltos bruscos impossíveis.
- A velocidade aumenta progressivamente, com limite de segurança para preservar a jogabilidade em partidas longas.
- Colisão mais precisa entre o pássaro circular e os tubos, em vez de depender apenas de caixas retangulares.
- HUD com obstáculos superados e distância estimada percorrida, sem aumentar a pontuação indevidamente.
- Cada obstáculo superado continua valendo **5 pontos**. Partida termina em colisão ou por decisão do jogador.
- Espaço, W, ↑, clique ou toque ativam o voo; pressionar continuamente a tecla não causa disparos de batidas automáticas.
- Canvas com resolução adaptativa, incluindo tela cheia.

## Compatibilidade

- A pontuação continua sendo reportada pelos mesmos callbacks ao ranking global.
- Desafios diários e seus valores não foram alterados.
- Sem novos campos de banco ou migração SQL.
- O ZIP de correção contém somente os arquivos alterados e preserva `.git` e `.env`.

## Validação

- 54 arquivos TS/TSX analisados com transpileModule, sem erros sintáticos.
- 56 arquivos CSS analisados quanto ao balanceamento de blocos.
- A compilação `npm run build` e os testes visuais de física precisam ser executados em ambiente com dependências instaladas.
