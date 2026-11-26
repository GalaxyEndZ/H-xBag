# HäxBag V304.1 — Correção de compilação TypeScript

Esta atualização preserva as funcionalidades e o SQL da V304.0. **Não há nova migração SQL.**

## Correções

- `src/components/CommunicationHubV284.tsx`: removidas duas comparações impossíveis `channel?.kind !== 'voice'` dentro do ramo em que o TypeScript já sabe que o canal não é de voz (TS2367). O agendamento e as enquetes continuam disponíveis apenas na área de canais de texto.
- `src/components/PollsV304.tsx`: duas operações Supabase passaram a usar `Promise.resolve(...)`, convertendo o *thenable* tipado como `PromiseLike` em `Promise` completo. Os erros de rejeição foram tipados como `unknown` (TS2339 e TS7006).
- `src/components/ScheduledMessagesV304.tsx`: mesma correção para criação/cancelamento de agendamentos.
- `src/components/ServerOnboardingV304.tsx`: mesma correção para salvar configurações e concluir a entrada no servidor.
- `package.json` e `package-lock.json`: versão sincronizada em `0.304.1` para publicação.

## Verificações locais

- 94 arquivos TS/TSX: sintaxe analisada sem erros com o compilador TypeScript 5.8.3.
- `node --test tests/desktop-update.test.cjs`: 4 testes aprovados.
- `GITHUB_REF_NAME=v0.304.1 node desktop/verify-release-version.cjs`: aprovado.
- **Compilação completa não executada neste ambiente**, pois `npm ci` falhou por DNS (`EAI_AGAIN`) ao acessar o registro npm. Execute os comandos abaixo na máquina de desenvolvimento ou no GitHub Actions.

## Teste e publicação

```powershell
npm ci
npm run build

git add .
git commit -m "HaxBag V304.1 - Corrigir compilacao TypeScript"
git push origin main

git tag v0.304.1
git push origin v0.304.1
```

As tags devem ser criadas **após** o commit corrigido ter sido enviado. Ajuste `main` se a branch principal tiver outro nome.
