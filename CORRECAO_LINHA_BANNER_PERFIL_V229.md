HÄXBAG — V229 | CORREÇÃO DO TRAÇO NA CAPA DO PERFIL PÚBLICO

O que causava o problema:
- Na V228 o pseudo-elemento ::before foi removido de capas personalizadas,
  porém a regra .hb-public-content .hb-public-cover ainda tinha border-bottom.
- Essa borda criava uma linha avermelhada de 1 px no encontro da capa com os
  detalhes do perfil, conforme o segundo print.

O que foi corrigido:
- Para capas personalizadas, border-bottom: 0, mantendo a imagem e seu degradê.
- Para capas temáticas, mantém a borda original.
- A linha ornamental interna permanece desativada em capas personalizadas.
- Nenhuma alteração em dados, Supabase, componentes TSX ou em elementos da ficha.

Instalação do ZIP de correção:
1. Extraia na raiz do projeto HäxBag (a pasta onde fica package.json).
2. Substitua src/components/PublicProfileV151.css quando solicitado.
3. Atualize a página com Ctrl+F5. Se necessário, reinicie npm run dev.

Observação:
- A faixa marrom abaixo da imagem é a área de identidade do perfil.
  Esta correção remove o traço vermelho na separação, sem apagar o cabeçalho.
- O CSS foi conferido estaticamente; o aspecto deve ser verificado no navegador.
