# HäxBag V257 — Perfis clicáveis na gestão das comunidades

## Alterações

- A seção **Gerenciar participantes** passa a mostrar o **@usuário** em vez do prefixo do UUID.
- O @ abre o perfil público existente do participante ao clicar.
- O mesmo comportamento foi aplicado a **Solicitações de entrada**.
- O nome de exibição e o cargo (Membro/Moderador) permanecem identificáveis.
- Os botões de aprovar, recusar, nomear moderador e remover continuam independentes do clique no nome.
- As identidades de participantes da comunidade selecionada são carregadas usando `hax_social_public_profile`, o mesmo RPC público já usado no feed. Não são feitas consultas a perfis de outras comunidades.
- Quando um perfil não tem @ acessível, o seletor apresenta o nome exibido ou um fallback legível, sem mostrar o UUID.

## Instalação

Extraia a correção na raiz do projeto e substitua:

- `src/components/SocialV231Suite.tsx`
- `src/components/SocialV231Suite.css`

Rode `npm run build` e publique a aplicação.

**SQL:** não há migração nova. Requer a função `hax_social_public_profile`, já utilizada pelo feed e pelos perfis existentes.

## Validação

Os componentes passaram na checagem de tipos TypeScript (tsconfig.app.json) e a configuração do Vite (tsconfig.node.json) usando o compilador TypeScript 5.8 local. Verificações estáticas conferiram a inclusão dos participantes, o clique para abrir perfil e a remoção do UUID abreviado. O teste com banco real e o build final do Vite não foram realizados.
