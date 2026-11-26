# HäxBag V305.1 — adaptação do launcher global

- Launcher global corrigido: o painel abre via portal e não é cortado pela sidebar com `overflow:hidden`.
- Fechar menu ao selecionar um espaço, clicar fora ou pressionar Escape.
- Barra global de 60 px no desktop; o menu contextual continua disponível para RPG/Social.
- Comunicação e Arcade usam a barra mínima, pois já têm suas próprias ferramentas.
- Comunicação ocupa a altura útil da janela; rodapé repetido fica oculto nesta área.
- A rolagem das mensagens continua independente do cabeçalho e do composer.
- O navegador web não usa o launcher desktop.

## Validar no Windows

1. Abra o app no RPG e clique no ícone HäxBag. O menu com quatro áreas deve abrir totalmente, à direita.
2. Selecione Comunicação, volte para Social e RPG; confira a troca de área e o fechamento do menu.
3. Na Comunicação, confira altura do chat, digitação, envio, anexos, salas de voz e rolagem das mensagens.
4. Com o menu aberto, pressione Escape e clique fora para conferir fechamento.
5. Confira janelas de 1024 px, 1366 px e 1920 px de largura, inclusive modo de foco.
6. Execute `npm ci && npm run build` antes de publicar a tag `v0.305.1`.

Nenhuma migração SQL adicional é necessária.
