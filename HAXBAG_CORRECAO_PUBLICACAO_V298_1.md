# HäxBag V298.1 — Correção da publicação de atualizações

## Erro solucionado

O workflow anterior concluía a compilação e a verificação local de `latest.yml`, porém a verificação da release no GitHub falhava com:

```text
latest.yml nao foi publicado.
Process completed with exit code 1.
```

Isso indica que a release consultada não tinha o manifesto entre os anexos; não significa que o arquivo local estava ausente, nem que o aplicativo Windows já instalado é o problema.

## Mudanças

- A release continua usando o `electron-builder` para **gerar** o instalador NSIS e `latest.yml` da mesma compilação.
- Antes de tornar a release pública, o workflow agora faz um **upload explícito** de `latest.yml`, do `HaxBag-Setup-<versao>-x64.exe` e, quando disponível, do `.blockmap`.
- O envio usa `gh release upload --clobber`, permitindo corrigir anexos parciais.
- Se a release de destino não existir, ela é criada como rascunho (`draft`).
- Os arquivos são conferidos na API do GitHub (com tentativas para eventuais atrasos) **antes** de publicar.
- A validação final pública continua obrigatória. Se faltar algum anexo, a Action falha e não declara sucesso indevidamente.
- Versão do pacote sincronizada em `package.json` e `package-lock.json`: **0.298.1**.

## Como aplicar

1. Extraia o pacote **completo** e substitua os arquivos do projeto no repositório **de código-fonte** (não em `H-xBagReleases`). Não comite `.env.local` ou tokens.
2. Faça commit e push para `main` (ou a branch utilizada pelo projeto).
3. Crie a tag **nova** `v0.298.1` e envie-a ao GitHub. **Não reutilize** `v0.298.0`, pois ela já disparou um workflow com os arquivos antigos.

```powershell
git add .
git commit -m "Corrigir publicacao de latest.yml (v0.298.1)"
git push origin main
git tag v0.298.1
git push origin v0.298.1
```

Se o seu branch não se chama `main`, ajuste o comando `git push origin main`.

4. Na aba Actions do repositório de código-fonte, abra **Publicar HäxBag Desktop (Windows)** e confira a etapa **Garantir upload do latest.yml e Setup na release de destino**.
5. Abra https://github.com/GalaxyEndZ/H-xBagReleases/releases e confirme a versão `v0.298.1` com os anexos `latest.yml` e `HaxBag-Setup-0.298.1-x64.exe`.
6. Para diagnóstico local: `npm run desktop:check-feed`.

## Observações

- O secret `HAXBAG_RELEASE_TOKEN` continua necessário no repositório de origem, com **Contents: Read and write** no `GalaxyEndZ/H-xBagReleases`. Não o cole em arquivos versionados.
- Uma release com `latest.yml` **não faz versões antigas sem feed começarem a se atualizar**. Instale uma vez o instalador NSIS gerado após a configuração do auto-updater.
- Requer validação no runner Windows do GitHub Actions e teste de atualização ponta a ponta: os testes locais aqui não executam uma publicação real.
- Se houver regras de proteção/imutabilidade para releases, a versão nova `v0.298.1` evita precisar modificar uma release publicada anteriormente.
