# HäxBag — Projeto fonte

HäxBag é uma plataforma de RPG compartilhado com campanhas, fichas, inventários, áreas sociais e um Arcade de minigames. O projeto usa React, TypeScript, Vite e Supabase.

## Por que este pacote tem menos arquivos?

Esta distribuição inclui apenas **código-fonte, recursos e configurações**. As pastas `.git`, `node_modules` e `dist` não acompanham o ZIP:

- `.git`: histórico e informações da sua cópia local. **Não apague a pasta `.git` do seu projeto atual.**
- `node_modules`: dependências, reinstaladas a partir de `package-lock.json`.
- `dist`: resultado gerado automaticamente pelo build.

As notas antigas de atualização foram reunidas em `HISTORICO_DO_PROJETO.md`. Os arquivos do site (`src/`, `public/` e as configurações) não foram fundidos, removidos ou alterados nesta reorganização.

## Como usar na pasta do projeto atual

1. Faça backup do projeto.
2. Extraia o conteúdo da pasta `haxbag` deste ZIP **sobre a pasta `haxbag` existente**, mantendo as pastas `.git` e `node_modules` já presentes no computador. Substitua apenas os arquivos correspondentes.
3. Se ainda tiver os antigos arquivos `*.md` de atualizações na raiz, poderá arquivá-los após conferir `HISTORICO_DO_PROJETO.md`. Não exclua suas anotações pessoais.
4. Execute:

```powershell
npm ci
npm run build
npm run dev
```

O comando `npm ci` recria a pasta `node_modules` a partir do arquivo de dependências travadas. Se ela já estiver instalada corretamente, você pode testar o build diretamente.

**Importante:** este ZIP compactado não modifica o banco de dados, o Supabase nem as regras do RPG. Não há SQL novo.

## Para reduzir o número de arquivos no computador

As dependências em `node_modules` são necessárias para desenvolver e fazer build, então elas voltarão a existir após `npm ci`. A pasta `dist` pode ser removida e recriada com `npm run build`. Não exclua `.git` caso use Git ou GitHub.

Para enviar ou arquivar o código, use o ZIP compacto: é um único arquivo que não contém esses artefatos gerados.

## Organização

- `src/` — aplicação React e regras dos sistemas.
- `public/` — ícones e recursos estáticos.
- `package.json` e `package-lock.json` — instalação reproduzível.
- `vite.config.ts`, `tsconfig*.json` — configurações de desenvolvimento.
- `HISTORICO_DO_PROJETO.md` — documentação histórica consolidada.
