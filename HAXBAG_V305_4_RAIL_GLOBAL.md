# HäxBag V305.4 — Rail global compartilhada

A faixa de 60 px do desktop agora recebe os ícones de servidores da Comunicação, criar/entrar em servidor, uma indicação de chamada ativa e o atalho de mensagens privadas. Não há segunda faixa de servidores dentro da Comunicação.

A lógica dos servidores continua dentro de `CommunicationHubV284.tsx`; React Portal desloca somente a renderização dos botões para o slot que o aplicativo monta. Trocas de servidor, permissões, convite e DMs continuam usando os handlers existentes.

O launcher do HäxBag permanece no topo em todas as áreas. Navegação de canais/contexto fica na segunda coluna e as mensagens ficam na terceira área visual (sem uma terceira rail).

Nenhum SQL é necessário. Na web e em viewport abaixo de 801 px, a navegação anterior é mantida.

Antes de publicar: execute `npm ci && npm run build` e teste no Electron os estados normal, canais recolhidos, janela pequena, chamada ativa, servidores múltiplos, DMs e troca entre RPG e Comunicação.
