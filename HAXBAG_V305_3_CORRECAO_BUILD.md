# HäxBag V305.3 — correção de compilação

- Corrigido `channel.description` para `channel.topic` no contexto da Comunicação (tipo `Channel`).
- Atualizado `.github/workflows/desktop-release.yml`: `actions/checkout@v5` e `actions/setup-node@v5` (Actions executam com Node.js 24; o projeto permanece configurado para Node.js 22).
- `package.json` e `package-lock.json` sincronizados com a versão `0.305.3`.
- Não requer migração SQL.

## Para validar e publicar

```powershell
npm ci
npm run build
$env:HAXBAG_TAG = 'v0.305.3'
node desktop/verify-release-version.cjs
git add .
git commit -m 'HaxBag V305.3 - Corrigir compilacao e Actions'
git push origin main
git tag v0.305.3
git push origin v0.305.3
```

Se a compilação falhar, não publique a tag.
