# HäxBag V305.12 — navegação Social e RPG

## Melhorias
- Cabeçalho do Social separado da lista rolável e sem margens negativas, com divisor na largura inteira.
- Banner da temporada do RPG no topo, ocupando uma altura equivalente ao cabeçalho do Social.
- Mesmo padrão de botões, seleção ativa, foco por teclado, separadores e espaçamento nas duas áreas.
- Rail global de 60px e perfil fixo no rodapé preservados; apenas a navegação contextual rola.
- Mudanças limitadas ao Electron desktop acima de 800px; site e janelas compactas inalterados.
- Não requer SQL.

## Verificação local
1. Abrir Social, alternar entre Feed, Amigos, Salvos e Minha Identidade.
2. Conferir que o divisor inferior do título Social atravessa o painel contextual.
3. Abrir RPG e conferir que o banner de temporada inicia no topo, sem faixa vazia.
4. Rolar o menu e confirmar que o cabeçalho e o perfil ficam fixos.
5. Redimensionar o painel e testar atalhos e teclado.
6. Rodar `npm ci` e `npm run build` antes de publicar a tag.
