# HäxBag V266 — Correção do menu de reações das mensagens privadas

## O que foi corrigido
- Seletor de emojis deslocado, sobreposto ou cortado dentro da área de mensagens.
- Menu agora flutua fora da área rolável, mas permanece ancorado ao botão "Reagir".
- Posicionamento ajustado aos limites da janela e atualizado ao rolar/redimensionar.
- Fechamento ao clicar fora, pressionar Esc ou selecionar uma reação.
- Estilização das ações da mensagem e quebra de linha em espaços estreitos.
- Tema de cores atual preservado no seletor, inclusive fora do contêiner do Social.
- Botões com rótulos acessíveis e navegação por teclado.

## Atualizar uma instalação V265
Extraia o ZIP da correção na pasta raiz `haxbag/` mantendo as subpastas.
Arquivos atualizados/criados:
- `src/components/FriendsPanel.tsx`
- `src/components/ChatReactionPickerV266.tsx`
- `src/components/ChatReactionPickerV266.css`

Depois execute `npm run dev` ou `npm run build` no Windows.
Não é necessário SQL nem alteração de Supabase.

## Validação
`tsc -p tsconfig.app.json --noEmit --pretty false` executado sem erros.
O empacotamento de produção do Vite deve ser confirmado no ambiente Windows do projeto.
