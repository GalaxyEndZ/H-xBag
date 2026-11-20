# HäxBag V203 — Arena Infinita evoluída

## Arena Infinita (upgrades exclusivos)
- Mapa explorável e infinito com câmera móvel e terreno procedural mantidos.
- Ataques continuam **manuais**; mouse/toque para mirar, clique, Espaço, J ou ATIRAR para disparar.
- Inimigos de elite surgem a cada cinco ondas e possuem barra de vida.
- Inimigos deixam cristais de XP para recolher; corações ocasionais recuperam vida.
- Esquiva com **Shift** ou botão ESQUIVA, com recarga visível.
- Melhorias adicionais: ímã de essência, esquiva arcana e golpe certeiro.
- Partidas infinitas com ranking e desafios preservados.

## Curva de nível equilibrada
- Antes: `floor(4 + nivel * 2.5)` XP para subir.
- Agora: `floor(20 + (nivel - 1)*7 + 3*(nivel - 1)^1.45)` XP para subir, a partir do nível 1.
- Custos por nível: nível 1→2: 20 XP; 2→3: 30 XP; 5→6: 70 XP; 10→11: 155 XP.
- Inimigos comuns / corredores: 1 XP; resistentes: 2 XP; elites: 8 XP.
- O excedente de XP é preservado ao subir de nível; não há limite de nível.
- XP só é ganho ao **coletar os cristais**; derrotar inimigos não concede XP automaticamente.

## Asteroids
- Jogo clássico preservado sem experiência, níveis ou cartas de upgrades.
- Controles, pontuação, tela ampliada e ranking mantidos.

## Implantação
- Não precisa executar SQL.
- Aplique o pacote de correção à raiz do projeto, sem substituir `.git` ou `.env`.
- Recomendado validar com `npm ci` e `npm run build` no ambiente local.
