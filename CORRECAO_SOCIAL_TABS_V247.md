# HäxBag V247 — Correção do erro TS2322

## Causa
O aplicativo mantinha uma lista antiga de abas (`HaxSocialTab` em `src/siteNavigation.ts`) enquanto o componente Social tinha mais seis abas (`SocialTab`). O `setSocialNavigationTab` não aceitava as abas novas, gerando TS2322 em `App.tsx` ao ser passado para `onSelectTab`.

## Correção
- `src/siteNavigation.ts`: inclui `showcase`, `tablefinder`, `trends`, `insights`, `security` e `characternews` em `HAX_SOCIAL_TABS`.
- `src/components/FriendsPanel.tsx`: `SocialTab` passa a reutilizar o tipo `HaxSocialTab` centralizado, eliminando listas duplicadas.

## Instalação
Extraia o ZIP de correção sobre a raiz do projeto (a pasta que contém `package.json`), mantendo os diretórios `src/`, e substitua os dois arquivos. Depois execute `npm run build`.

Nenhum SQL é necessário. Não modifica acesso administrativo nem dados.

## Validação
Validação estrita do arquivo de navegação, análise de sintaxe TSX/TS e consistência entre as 21 abas e o catálogo visual: passaram. O build integral depende das dependências do projeto e precisa ser executado no ambiente de destino.
