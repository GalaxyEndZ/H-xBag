# HäxBag V236 — Painel Administrativo aprimorado

Base: HäxBag V235.

## Melhorias
- Nova visão geral: denúncias mais antigas, últimas decisões e limites de atuação.
- Resumo clicável com indicadores de pendências, analisadas, dispensadas e eventos auditados.
- Fila de denúncias com pesquisa, situação, tipo de conteúdo e ordenação.
- Inspeção detalhada, prévia e confirmação explícita de remoções permanentes.
- Gestão de usuários e moderadores com filtro dos resultados de pesquisa.
- Histórico pesquisável por ação, ID ou justificativa, com exportação CSV dos registros carregados.
- Layout responsivo consistente com as cores de temporada e o Social V232.
- Tratamento de erros, estados vazios e proteção contra respostas antigas de prévias.

## Segurança e limites
O Painel Administrativo permanece exclusivo de administradores globais (identificados no banco por hax_v231_admins); não basta ser mestre ou moderador. A checagem de role ocorre tanto na interface quanto nas RPCs / RLS existentes da V234. Nenhuma permissão nova foi criada.

As contagens representam até 200 denúncias e até 150 ações carregadas, não os totais globais. O filtro de usuários atua sobre os resultados de uma busca (máx. 50), não lista automaticamente todos os membros.

As suspensões restringem o Social V231, **não** revogam sessões de autenticação nem cobrem completamente o feed/chat clássicos. O painel informa isso em destaque.

## Instalação
1. Faça backup do projeto.
2. Copie os arquivos modificados na pasta `src/components` mantendo os nomes.
3. Execute `npm run build`.

Não há SQL novo nesta versão. Requer que as migrações `HAXBAG_SOCIAL_V231.sql` e `HAXBAG_ADMIN_V234.sql` já estejam aplicadas.
