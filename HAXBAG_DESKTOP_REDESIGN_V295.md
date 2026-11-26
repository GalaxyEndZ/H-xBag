# HäxBag V295 — Redesign Desktop + Comunicação

## O que mudou

A V295 remodela a apresentação visual do **aplicativo Electron**. O site aberto no navegador mantém o visual que já tinha. A ativação é feita apenas quando a API restrita de `desktop/preload.cjs` informa `haxbagDesktop.enabled === true`.

- **Shell desktop:** largura da barra principal ajustada (mais estreita em Comunicação), marca e perfil redesenhados, alternador Social/RPG/Arcade/Comunicação mais compacto, busca, menus e barra superior com hierarquia melhor e menos bordas.
- **Comunicação:** cabeçalho e caminho atual mais discretos; mais espaço para as conversas; barra de servidores, lista de canais e chat com espaçamento e contrastes revisados; compositor de mensagem integrado; melhor acabamento dos painéis de voz e compartilhamento de tela.
- **Responsividade:** ajustes para janelas menores e `prefers-reduced-motion`.
- **Integridade:** não foram alterados handlers, permissões, políticas RLS, tabelas do Supabase, login, atualizador ou lógica das chamadas. Botões, mensagens, busca, anexos, reações, convites, voz e compartilhamento continuam usando as implementações existentes.

## Arquivos alterados

1. `package.json` — 0.295.0
2. `package-lock.json` — versão consistente
3. `src/App.tsx` — importa CSS desktop e ativa classe `hb-desktop-v295` somente no Electron
4. `src/DesktopShellV295.css` — novo visual do shell
5. `src/components/CommunicationHubV284.tsx` — importa CSS V295
6. `src/components/CommunicationHubV295.css` — novo visual da Comunicação

Este arquivo de instruções é novo. **Nenhum SQL adicional.**

## Atualizar a pasta do projeto

Extraia o ZIP incremental **dentro da raiz do HäxBag**, mantendo a mesma estrutura de diretórios e mesclando as pastas. Você também pode usar o projeto completo caso precise partir da V295 inteira, sem substituir seu `.env.local` ou `.git`.

## Publicar V295 pelo fluxo automático que já funciona

No terminal do VS Code, dentro do repositório de código `GalaxyEndZ/H-xBag`:

```powershell
node -p "require('./package.json').version"
git status
# Confira os arquivos e não inclua .env.local ou tokens.
git add package.json package-lock.json src/App.tsx src/DesktopShellV295.css src/components/CommunicationHubV284.tsx src/components/CommunicationHubV295.css HAXBAG_DESKTOP_REDESIGN_V295.md
git commit -m "HaxBag Desktop V295 redesign"
git push origin HEAD
# Crie a tag APÓS o push, somente se ainda não existir:
git tag v0.295.0
git push origin v0.295.0
```

O workflow `.github/workflows/desktop-release.yml` da V294 deve compilar e publicar `v0.295.0` no repositório `GalaxyEndZ/H-xBagReleases` (desde que secrets e workflow sigam configurados). Confira Actions e Releases. O usuário com **V294 Setup instalado** deverá receber atualização pelo auto-updater; a versão Portable não é atualizada automaticamente.

## Testes e limitações

- Conferidos: integridade de arquivos, alterações restritas, consistência de versão nos manifestos, `node --check` dos scripts Electron e verificação do script de versão para tag `v0.295.0`.
- A compilação total `npm run build` **não foi concluída neste ambiente** (limite de execução alcançado durante TypeScript). A compilação Windows e a aparência real com login/servidores devem ser testadas no GitHub Actions e no aplicativo instalado.
- O redesign é CSS-only, com inclusão do marcador desktop no JSX, para minimizar risco de regressão funcional.
