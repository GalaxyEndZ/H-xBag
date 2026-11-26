# HäxBag V298 — Auto-update Windows com diagnóstico no aplicativo

## O que foi corrigido

- `desktop/auto-update.cjs`: checagem automática na abertura (~10 s), a cada 1 hora e quando a janela volta a receber foco após 30 minutos sem checagem. Download automático, progressos, erros traduzidos, registro local, instalação ao encerrar normalmente ou reinício escolhido pelo usuário.
- `desktop/main.cjs` e `desktop/preload.cjs`: IPC limitado à janela confiável, expondo apenas estado, checagem e instalação (sem Node ou métodos IPC genéricos no React).
- `src/components/DesktopUpdateCenter.tsx` + `.css`: painel discreto no canto inferior direito do **aplicativo desktop**. Clique para verificar, acompanhar e reiniciar quando baixar.
- `.github/workflows/desktop-release.yml`: testa o atualizador, valida `latest.yml` e o Setup local, publica a release e **valida que ela está pública e contém ambos os arquivos**.
- `desktop/check-public-release.cjs` e `DIAGNOSTICAR_ATUALIZACOES_WINDOWS.bat`: diagnóstico externo que consulta a última release pública, sem precisar de login ou token.
- `package.json`: versão 0.298.0 e script de testes. Arquivo `.env.local` continua ignorado e NÃO deve ser enviado ao GitHub.

## O bloqueio principal: publicar uma versão real

O repositório `https://github.com/GalaxyEndZ/H-xBagReleases` **não havia exibido nenhuma release pública na inspeção de 26/11/2026**. Um repo vazio, uma tag isolada, ou somente um `.exe` enviado à aba Code **não** bastam para o `electron-updater`.

Para funcionar, o repo de releases deve ser **público** e a versão mais recente, **publicada (não Draft / nem Prerelease)**, precisa incluir no mínimo:

- `HaxBag-Setup-0.298.0-x64.exe` (NSIS gerado por electron-builder);
- `latest.yml` **da mesma compilação**, com versão `0.298.0` e checksum correspondente;
- opcionalmente `.blockmap` (útil para atualizações diferenciais).

### Uma vez: configurar CI no repo do código-fonte

O workflow `.github/workflows/desktop-release.yml` deve estar no **repositório do código-fonte** do HäxBag (não no `H-xBagReleases`, que serve como distribuição). Nas configurações de Actions **do repo do código**, cadastrar:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `HAXBAG_RELEASE_TOKEN` | Token Fine-grained com **Contents: Read and write** apenas no repo `GalaxyEndZ/H-xBagReleases` |
| Secret | `VITE_SUPABASE_URL` | URL HTTPS do projeto Supabase |
| Secret | `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase (jamais a service_role) |
| Variable | `VITE_HAXBAG_PUBLIC_URL` | URL HTTPS do site para convites (quando existir) |
| Variable (opcional) | `VITE_HAXBAG_VOICE_ICE_URL` | Endpoint de credenciais ICE/TURN (quando usado) |

**Nunca coloque o token na pasta do projeto, em commits, no `package.json` ou em `.env.local` enviado ao GitHub.**

### Publicar V298

No PowerShell **dentro do repo de código** com o projeto V298:

```powershell
npm install
npm run test:updater
git add .
git commit -m "HäxBag v0.298.0 - atualizador Windows"
git push origin main
git tag v0.298.0
git push origin v0.298.0
```

Se a branch principal tem outro nome, troque `main`. Se `v0.298.0` já existe, **não reutilize a tag**: aumente a versão e crie uma tag nova. O push da tag inicia o workflow Windows. Acompanhe a aba **Actions** no repositório do código; a release pública e os arquivos aparecerão em `https://github.com/GalaxyEndZ/H-xBagReleases/releases`.

Após publicação, teste localmente:

```powershell
npm run desktop:check-feed
```

Ou abra `DIAGNOSTICAR_ATUALIZACOES_WINDOWS.bat`. Se a verificação disser `404`, falta a release pública (ou ela ainda está draft); o app não poderá baixar nada até isso ser corrigido.

### O que instalar no PC

**Instale pelo menos uma vez um Setup NSIS com feed configurado**, não o `HaxBag-Portable-*.exe`. O instalador carrega a configuração `app-update.yml` embutida. Builds legados sem feed ou portáteis não podem receber esse mecanismo retroativamente.

Para comprovar atualização real, instale `v0.298.0`, então publique `v0.299.0` **com um novo instalador e novo latest.yml**, sem desinstalar. Abra a V298; o painel passa de “Verificando” para “Baixando” e “Pronta para instalar”. Reinicie para instalar. O app usa as verificações de integridade nativas do `electron-updater`.

Se estiver conectado em uma chamada, escolha **Depois**; ao fechar o aplicativo normalmente, a atualização baixada poderá ser instalada. A versão portátil continua com atualização manual.

## Diagnóstico no PC instalado

- Abra o app e clique em **Atualizações** no canto inferior direito.
- Se vir “Nenhuma release pública com latest.yml”, execute o diagnóstico de feed acima e confira as releases.
- Se vir “O aplicativo foi instalado sem app-update.yml”, reinstale um Setup gerado após V294 com feed válido.
- Se mostrar “Esta é a edição portátil”, utilize o Setup.
- Se o app disser “HäxBag atualizado” mas você alterou o código, confira se publicou **uma versão maior que a instalada**; arquivos novos somente na sua pasta ou no branch Git não atualizam o programa de ninguém.
- Consulte o arquivo `haxbag-update.log` dentro da pasta de dados de usuário do aplicativo Electron para erro e histórico de download.

## Limitações dos testes desta entrega

- O teste automatizado local cobre checagem, progresso, instalação solicitada, modo portátil e erro 404 com **simulações** (sem acesso ao Windows ou a uma release real).
- A geração do `.exe` NSIS e a atualização ponta a ponta dependem do GitHub Actions no Windows e da publicação acima. Nenhuma release foi criada por este pacote.
- O `package-lock.json` recebido da V297 estava incompleto para Electron. Aqui preservamos o lock existente e a atualização de versão; o workflow usa `npm install` para resolver as dependências na máquina com rede. Após rodar `npm install` localmente, inclua o lockfile regenerado no próximo commit. Não use `npm ci` antes de atualizá-lo.

> **Correção V298.1:** para o erro `latest.yml nao foi publicado`, consulte `HAXBAG_CORRECAO_PUBLICACAO_V298_1.md`. Use a tag `v0.298.1`, não reutilize `v0.298.0`.
