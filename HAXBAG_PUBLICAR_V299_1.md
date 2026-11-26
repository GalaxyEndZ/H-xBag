# Publicar HäxBag Desktop V299.1 — Correção do erro de tag

## Diagnóstico

O workflow `desktop/verify-release-version.cjs` compara `github.ref_name` com a versão de `package.json` **no commit apontado pela tag**. Se a tag `v0.299.0` encontra `0.298.1`, o problema não é a versão dentro do ZIP V299: o GitHub Actions fez checkout de um commit antigo, normalmente porque a tag foi criada/enviada **antes** do commit atualizado, ou os arquivos foram enviados à pasta errada.

Esta entrega usa uma nova tag `v0.299.1` para não alterar a tag já publicada com erro.

## Passos no PowerShell (na raiz do repositório do CÓDIGO-FONTE)

1. Substitua/mescle os arquivos do projeto com o ZIP completo da V299.1. Garanta que o `package.json` correto esteja na **raiz**, ao lado da pasta `desktop/`, e não dentro de uma segunda pasta `haxbag/`.
2. Confirme a versão:

```powershell
node -p "require('./package.json').version"
# Esperado: 0.299.1
```

3. Envie **o commit antes de criar a tag**:

```powershell
git status
git add .
git commit -m "HäxBag Desktop V299.1 - corrigir tag da release"
git push origin HEAD
```

Se não houver nada para commit, verifique se substituiu os arquivos no repositório correto antes de prosseguir.

4. Confirme o conteúdo do commit que será publicado:

```powershell
git show HEAD:package.json | Select-String '"version"'
# Esperado: "version": "0.299.1"
```

5. Crie e envie a tag **somente agora**, ainda na mesma branch:

```powershell
git tag v0.299.1
git push origin v0.299.1
```

**Não mova nem faça `--force` na tag `v0.299.0`.** O GitHub Actions do repositório do código fará a publicação dos binários em `GalaxyEndZ/H-xBagReleases`.

## Verificação

No workflow da tag `v0.299.1`, a etapa `Conferir versão da release` deve registrar `Preparando v0.299.1`. Após o sucesso, abra `https://github.com/GalaxyEndZ/H-xBagReleases/releases` e verifique o instalador `HaxBag-Setup-0.299.1-x64.exe` e `latest.yml`.

Se o workflow continuar mostrando outra versão, confira no GitHub a página do commit apontado pela tag; a versão validada sempre vem daquele commit, e não do estado mais recente de `main`.
