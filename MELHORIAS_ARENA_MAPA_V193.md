# HäxBag V193 — Arena Infinita com mundo explorável

## Mudanças
- Arena sem bordas: o herói e inimigos possuem coordenadas mundiais sem limite fixo.
- Câmera acompanha o personagem suavemente; a área de 720×420 é somente a janela de visualização.
- Terreno gerado por células determinísticas, com pequenas pedras, vegetação, trilhas e marcas rúnicas. Voltar a uma região mostra o mesmo chão. Cenário é decorativo (sem colisões).
- Inimigos surgem fora da visão, a uma distância do jogador; perseguem no mapa grande e são descartados apenas quando ficam muito longe, para controlar memória.
- Projéteis e colisões operam em coordenadas do mundo; a mira do mouse usa a posição da câmera.
- Radar no canto superior direito mostra inimigos próximos.
- Mostradores de posição e distância percorrida.
- Disparos manuais (clique, Espaço/J, ATIRAR no celular), vidas, ondas, pausas, ranking e desafios diários mantidos.

## Instalação
Substitua os arquivos da V192 pelos da V193 e mantenha seu .env. Não há SQL novo.

## Arquivos alterados
- src/components/ArcadeCanvasGames.tsx
- src/components/MinigamesHub.css
