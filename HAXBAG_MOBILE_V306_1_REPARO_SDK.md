# HäxBag Mobile V306.1 — Reparação do SDK Android no GitHub Actions

## Falha anterior

`/bin/bash: sdkmanager: command not found` durante `Preparar SDK Android`.

## Correção

- `android-actions/setup-android@v4` baixa/configura as ferramentas do SDK e aceita licenças.
- Instala `platform-tools`, `platforms;android-36` e `build-tools;36.0.0`.
- Etapa de diagnóstico identifica imediatamente a ausência do comando, da plataforma ou dos build-tools.
- Mantém Java 21, Node 22 e a compilação APK de teste existente.
- Nenhum SQL é necessário.

## Como executar

1. Substitua os arquivos modificados no seu projeto.
2. Confirme `npm run mobile:check` e os testes locais disponíveis.
3. Faça commit e `git push origin main`.
4. No GitHub: Actions → HäxBag Mobile — APK de teste (Android) → Run workflow.
5. Se funcionar, baixe o artefato `HaxBag-Mobile-Android-Debug`.

**Não é necessário criar tag**. O workflow do Windows é disparado por `v*` e seria acionado por uma tag mobile.

### Validação

Essa alteração pode ser verificada estaticamente, mas depende de uma execução real no runner do GitHub para confirmar o APK.
