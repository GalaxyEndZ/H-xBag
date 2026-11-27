# HäxBag V305.5 — Comunidade estilo mensageiro desktop

- A barra global continua acessível em todas as áreas; agora tem atalhos de Social e RPG.
- Em Social, o painel contextual da aplicação substitui a navegação duplicada interna.
- As páginas de Amigos, Seguindo e Seguidores exibem linhas compactas, com avatar e indicador de presença.
- A página de Amigos oferece os filtros **Disponíveis** e **Todos**, usando a presença existente (não exibe quem está Invisível).
- Cabeçalho compacto inclui acesso a Conversas e Encontrar pessoas.
- A página de mensagens privadas preserva a própria lista de conversas.
- Mudanças visuais de estrutura restritas ao Electron acima de 800px. O site e o mobile continuam sem alterações estruturais.
- Não é necessário SQL adicional.

## Testes sugeridos

1. Entre no Social no aplicativo desktop, navegue por Amigos, Mensagens, Feed e Comunidades usando a rail global.
2. Verifique o filtro Disponíveis com duas contas e status de presença permitido.
3. Abra uma DM por um perfil da lista de amigos.
4. Teste em 900px e 1440px; confira o modo de navegação recolhida e o modo de foco.
5. Teste o navegador e um viewport inferior a 801px; a navegação original deve permanecer.
6. Execute `npm ci && npm run build` antes de criar a tag da versão.
