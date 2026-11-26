# HäxBag V301.1 — correção da área de RPG em branco

## Problema

Na V301, o correio flutuante de recompensas (`ChestMessages`) podia ser montado como um elemento de grid normal, mesmo com o botão visível em `position: fixed`. A barra lateral ocupava a segunda coluna e o conteúdo principal era colocado na linha seguinte (fora da janela).

## Correção

- `src/DesktopExperienceV301.css`: o wrapper `.hbn-root` deixa de participar do grid (`display: contents`), preservando os filhos e sua interação.
- Menu principal explicitamente em `grid-column: 1; grid-row: 1` e conteúdo em `grid-column: 2; grid-row: 1`.
- Escopo apenas no Electron em telas acima de 800 px; estilos e permissões web preservados.
- `package.json` e `package-lock.json` atualizados para `0.301.1`.

## Testes recomendados no Windows

1. Abrir V301.1 e entrar em RPG / Visão geral com uma campanha selecionada.
2. Confirmar que a barra superior e o painel da campanha ocupam a área à direita do menu.
3. Abrir e fechar **Recompensas** (caso a função apareça); trocar entre Fichas, Torre de Dados e Missões.
4. Alternar Social, Minigames e Comunicação, com menu recolhido/expandido.
5. Testar largura da janela de 1024 px até 1920 px, modo de foco e redimensionamento.
6. Validar publicação após commit: `git tag v0.301.1; git push origin v0.301.1`.

A correção do layout não altera dados ou SQL e mantém o atualizador silencioso.
