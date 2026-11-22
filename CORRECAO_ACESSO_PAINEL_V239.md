# HäxBag — Correção do carregamento do painel administrativo

## O que foi corrigido

- A falha de carregamento da identificação dos usuários não revoga mais artificialmente o acesso ao painel de uma conta que já foi confirmada como administradora global.
- Denúncias, histórico e identificação de pessoas carregam independentemente; um problema em apenas uma fonte não bloqueia todas as outras.
- Erros vindos em objetos são exibidos em texto legível, sem `[object Object]`.
- Uma consulta alternativa recupera nomes públicos de responsáveis, denunciantes e alvos que sejam contas identificáveis. A identidade de autores de conteúdos depende da função administrativa de identificação.
- A interface deixa claro quando os resultados não puderam ser consultados, evitando apresentar falsos totais zero.
- O painel e suas consultas continuam protegidos por autorização de administrador global. Não são concedidas permissões novas.

## Como instalar somente a correção

Extraia o arquivo de atualização na **raiz do projeto HäxBag**. Substitua:

- `src/components/SiteAdministrationV234.tsx`
- `src/components/SiteAdministrationV234.css`

Execute `npm run build` no computador onde as dependências do projeto estiverem instaladas. Não há nova migração obrigatória para evitar que o painel feche ao falhar a busca de identidades.

## Se os @usuários ainda estiverem indisponíveis

Confira se a migração `HAXBAG_ADMIN_IDENTIDADES_V237.sql`, já fornecida anteriormente e incluída neste pacote, foi executada no editor SQL do banco. Ela restaura a função de identificação e preserva a autorização exclusiva a administradores globais.

**Observação:** a causa exata da falha remota não pode ser confirmada apenas pelo texto `[object Object]`; a atualização faz o painel lidar corretamente com erros e manter os recursos que puderem ser carregados.
