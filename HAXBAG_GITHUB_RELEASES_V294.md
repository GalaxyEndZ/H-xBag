# HäxBag Desktop V294 — Atualizações automáticas configuradas

Repositório público de distribuição, confirmado em 26/11/2026:

**https://github.com/GalaxyEndZ/H-xBagReleases**

## O que já está configurado no código

- `desktop/electron-builder.config.cjs` inclui **GalaxyEndZ/H-xBagReleases** como destino padrão do feed de atualizações.
- `GERAR_HAXBAG_WINDOWS.bat` gera um instalador com o destino correto, sem precisar configurar variável manualmente.
- `.github/workflows/desktop-release.yml` é executado **no repositório do código-fonte**, ao receber uma tag Git `v*`, e publica instalador, `latest.yml` e demais artefatos no repositório público acima.
- A publicação **falha de forma segura** se faltar o token exclusivo da publicação ou os valores públicos do Supabase; nunca tenta publicar no repo de código-fonte como alternativa.
- `package.json` versão `0.294.0`; próxima release deve incrementar esse número. Os números da tag devem coincidir com os de `package.json`.
- O nome visual do aplicativo permanece **HäxBag**. Não inclua tokens no aplicativo nem em `.env.local` versionado.

## Ação necessária (uma única vez)

A configuração precisa ser feita no **repositório que já contém o código do HäxBag** — não no `H-xBagReleases`:

1. Acesse https://github.com/settings/personal-access-tokens/new e crie um **Fine-grained personal access token**.
2. Repository owner: `GalaxyEndZ`; **Only select repositories**: `H-xBagReleases`; Repository permissions → **Contents: Read and write**. Escolha uma expiração e faça rotação quando expirar. **Nunca me envie o token.**
3. No repositório **do código-fonte**, abra **Settings → Secrets and variables → Actions → Secrets** e cadastre:
   - `HAXBAG_RELEASE_TOKEN`: token acima (não publicar no código).
   - `VITE_SUPABASE_URL`: URL HTTPS do seu projeto Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: chave **pública** do Supabase, não service_role.
4. No mesmo menu → **Variables**, adicione `VITE_HAXBAG_PUBLIC_URL` com o endereço HTTPS do site para convites; `VITE_HAXBAG_VOICE_ICE_URL` somente se você já usa endpoint TURN/ICE.
5. Envie o arquivo `.github/workflows/desktop-release.yml` ao repo **do código**, junto dos arquivos V294. Não coloque o código do aplicativo no repositório público de releases.

> `H-xBagReleases` precisa continuar público para o instalador consultar releases sem autenticação. O `GITHUB_TOKEN` automático de uma Action é limitado ao repositório que a executa, por isso usamos um token restrito com acesso apenas ao repositório de releases.

## Publicar a primeira versão com instalação automática

No terminal PowerShell na pasta `haxbag`, com o código V294 já atualizado:

```powershell
git add .
git commit -m "HäxBag Desktop v0.294.0 - releases"
git push origin main
git tag v0.294.0
git push origin v0.294.0
```

> Se a branch principal tiver outro nome, ajuste `main`. Se já existir uma tag `v0.294.0`, use uma versão ainda maior no `package.json` e na tag; não sobrescreva releases já publicadas.

Depois acompanhe **Actions** no repositório do código-fonte. Em caso de sucesso, a release aparecerá em:

https://github.com/GalaxyEndZ/H-xBagReleases/releases

A release precisa conter **`HaxBag-Setup-0.294.0-x64.exe`**, **`latest.yml`** e os demais arquivos gerados pelo electron-builder. Teste instalando essa versão inicial. Para confirmar a atualização automática, faça depois uma nova release, por exemplo `v0.295.0`.

## Limitações e segurança

- Nenhuma release foi criada por esta atualização e nenhuma configuração foi alterada em sua conta do GitHub.
- A primeira versão com atualizador deve ser **instalada manualmente uma vez**. Versões anteriores que não têm feed não passam a atualizar automaticamente.
- A edição portátil continua exigindo atualização manual; use **NSIS Setup** para auto-update.
- Um build React/Windows completo ainda precisa ser executado pelo GitHub Actions; arquivos locais foram testados apenas quanto a sintaxe/configuração.
- Distribuir EXE sem assinatura digital pode acionar avisos Windows SmartScreen. Recomendamos assinatura de código quando o app for distribuído amplamente.
- Atualização automática é do **programa instalado**, não do banco Supabase. Migrações SQL permanecem controladas separadamente.
- Ao divulgar uma nova versão, o código precisa ser compilado e publicado; o GitHub Actions automatiza essa etapa, mas não publica automaticamente cada alteração do `main` sem uma nova tag.
