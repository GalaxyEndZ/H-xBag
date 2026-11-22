# HäxBag — Perfis acessíveis pelo painel administrativo

Esta atualização torna os nomes públicos (`@usuário`) clicáveis na administração, abrindo o visualizador de perfil que já existe no HäxBag.

## Onde funciona

- Visão geral: responsável e alvo das decisões recentes.
- Histórico de moderação: responsável e alvo, inclusive após pesquisa e filtros.
- Denúncias: pessoa denunciada (ou autora do conteúdo) e denunciante.
- Usuários e equipe: clique no `@usuário` nos resultados e no detalhamento.
- Prévia de denúncia: acesso ao perfil do autor, separado do botão de gerenciamento.

Registros sem conta identificável permanecem como texto, sem links falsos. Para ações contra publicações ou comunidades, o link do alvo usa o autor/responsável que foi identificado, não o identificador do conteúdo.

## Instalação

1. Faça backup dos arquivos atuais.
2. Copie `src/components/SiteAdministrationV234.tsx` e `src/components/SiteAdministrationV234.css` para o projeto, substituindo os existentes.
3. Execute `npm run build` e publique a atualização.

A atualização pressupõe que a identificação de autores e responsáveis já esteja instalada. Não há alteração de banco de dados nesta etapa.

A central continua restrita aos administradores globais; os links abrem o mesmo perfil público já usado no Social, respeitando o que o próprio perfil deixa visível.
