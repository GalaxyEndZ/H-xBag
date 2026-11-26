# HäxBag V293 — Atualização automática do aplicativo Windows

## Como funciona

1. O programa **instalado por NSIS** consulta o feed de atualizações ao iniciar e a cada 6 horas.
2. Quando uma versão mais recente está disponível, baixa o instalador automaticamente.
3. Ao terminar, mostra **Reiniciar e atualizar** ou **Depois**; se o usuário escolher Depois, o pacote é instalado ao fechar o app.
4. Sem atualização, internet ou feed configurado, a interface continua funcionando normalmente.

**Não funciona na edição portátil `.exe`.** Esta continua tendo distribuição manual. Para autoatualizar, instale o `HaxBag-Setup-*.exe` NSIS. Computadores que têm apenas a V292 precisam instalar a V293 uma única vez.

## Preparação inicial: releases públicos

Precisamos de **um repositório de downloads no GitHub**. Configure o repositório do código (público) ou prefira um **repositório público separado para releases** quando quiser manter o código privado.

- Se código e download estão no mesmo repositório, nenhuma variável de publicação especial é necessária; o workflow usa `${{ github.repository }}`.
- Se o repositório de downloads for diferente, configure variável do repositório GitHub em **Settings → Secrets and variables → Actions → Variables**:
  `HAXBAG_RELEASE_REPOSITORY` = `usuario/repositorio-publico-de-releases`.
  Também configure um secret `HAXBAG_RELEASE_TOKEN` com permissão **Contents: read/write** apenas para o repositório de downloads; o `GITHUB_TOKEN` comum não publica em outro repo.
- **Não inclua tokens do GitHub no aplicativo.** Atualizações de repositório privado exigem autenticação do cliente, inadequada para um instalador público sem backend de licenças.

O nome do app continua **HäxBag**, mas o feed usa o ID ASCII do repositório.

### Configurar Supabase no build automático

Em **Settings → Secrets and variables → Actions → Secrets**, salve:

- `VITE_SUPABASE_URL` (endereço HTTPS do projeto Supabase)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (chave pública `sb_publishable_...`; **nunca** service-role)

Em **Actions → Variables**, configure:

- `VITE_HAXBAG_PUBLIC_URL` (HTTPS público para convites)
- `VITE_HAXBAG_VOICE_ICE_URL` (opcional, servidor HTTPS que entrega credenciais ICE temporárias)

**As variáveis `VITE_*` são compiladas no frontend e ficam visíveis ao cliente.** Só use valores públicos.

### Lançar nova versão sem gerar `.exe` manualmente

1. Modifique o código e incremente o campo `version` do `package.json`, por exemplo de `0.293.0` para `0.294.0`.
2. Envie o código para o GitHub e crie uma tag com a mesma versão:

```powershell
git add .
git commit -m "HäxBag desktop v0.294.0"
git push origin main
git tag v0.294.0
git push origin v0.294.0
```

3. GitHub Actions (`.github/workflows/desktop-release.yml`) compila o React, gera o NSIS, produz `latest.yml` e publica a release automaticamente.
4. Aplicativos instalados com o feed configurado detectam e baixam a atualização na próxima verificação.

O `version` precisa **aumentar a cada release**. Releases em rascunho não são detectadas. A action os torna públicos apenas depois de conferir os artefatos.

**Teste inicial:** configure o repo, gere/publicque a v0.293.0, instale-a, depois publique v0.294.0 e observe a atualização. Uma instalação anterior à V293 não consegue se autoatualizar porque ainda não tem o updater.

## Compilação local

```powershell
$env:HAXBAG_RELEASE_REPOSITORY = 'usuario/repositorio-publico-de-releases'
npm install
npm run desktop:installer
```

A configuração do feed **fica embutida no instalador**. Se você gerar o instalador sem essa variável, ele não será capaz de localizar releases no futuro; o script avisa no terminal.

O script `GERAR_HAXBAG_WINDOWS.bat` continua gerando instalador e portátil. Para publicar sem GitHub Actions, use `npm run desktop:release` com `GH_TOKEN` definido somente no ambiente de build (nunca no código do frontend).

## Segurança / limitações

- Só usa HTTPS para buscar downloads e **não executa arquivos arbitrários**; o atualizador usa os metadados e verificações do electron-updater.
- Proteja o repositório de distribuição, as tags e o token de publicação. Se outra pessoa controlar as releases, poderá publicar versões maliciosas.
- Recomenda-se assinar digitalmente os instaladores Windows. Builds não assinados podem gerar alertas SmartScreen, além de reduzirem a proteção da cadeia de atualização.
- Com electron-builder 26, assinar digitalmente os instaladores é recomendável. Atualizações de versões futuras de electron-builder podem exigir assinatura Ed25519 dos manifests; não remova verificações de segurança para contornar falhas.
- A atualização só é instalada após download completo. O app oferece reinício agora ou depois para não interromper chamada de voz ou transmissão de tela sem aviso.
- Aplicativo web em navegador continua independente: publicar uma atualização do site não instala automaticamente código novo no desktop até lançar uma nova versão.
- **Nenhum SQL do Supabase é necessário.**
- O build Windows e a instalação ponta a ponta ainda exigem validação no GitHub Actions e em dois lançamentos consecutivos. Nenhum repositório do usuário foi publicado ou conectado nesta conversa.

## Arquivos da atualização

- `desktop/auto-update.cjs` — monitorar, baixar, notificar e reiniciar para instalar.
- `desktop/main.cjs` — inicializar o updater após criar a janela.
- `desktop/electron-builder.config.cjs` — destino de publicação explícito, sem inventar um repositório.
- `.github/workflows/desktop-release.yml` — compilação e publicação de tags no GitHub Actions.
- `desktop/verify-release-version.cjs` — impede tags com versão divergente.
- `package.json` — versão, dependência electron-updater e scripts.
- `GERAR_HAXBAG_WINDOWS.bat` — aviso para feed não configurado.
