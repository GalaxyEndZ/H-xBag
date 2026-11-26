# HäxBag V259 — Notificações que abrem publicações

## O que mudou
- Notificações de curtidas e comentários agora exibem **Ver publicação**, abrindo o post correspondente no feed unificado.
- A publicação aparece em destaque e o feed rola até ela, mesmo que seja anterior às 80 publicações recentes.
- O carregamento adicional é feito pela consulta normal, respeitando a política de leitura do banco.
- Publicações removidas ou indisponíveis exibem um aviso e permitem voltar às notificações.
- Ao abrir, a notificação é marcada como lida.
- Seguir perfis continua usando o acesso ao perfil de quem seguiu.

## Instalação
1. Faça backup da pasta do projeto.
2. Descompacte a atualização na **raiz do projeto**, mantendo a estrutura `src/components/`.
3. Instale as dependências, se ainda não estiverem disponíveis (`npm install`), e execute `npm run build`.
4. Publique e teste clicando em notificações antigas e recentes.

Não há alteração SQL.

## Validação
- `tsc -b --pretty false` passou sem erros neste ambiente.
- `vite build` não foi concluído aqui porque as dependências recebidas incluem binários nativos de outra plataforma.
- O clique e a consulta em banco real devem ser confirmados no ambiente de implantação.
