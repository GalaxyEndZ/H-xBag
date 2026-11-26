# HäxBag V304.7 — Comunicação refinada

Esta versão mantém todas as funções da V304.6 (comunicação, voz, presença, cargos, emojis, mensagens agendadas e enquetes) e altera principalmente CSS.

## Ajustes

- Corrige disputa de especificidade entre `CommunicationDesktopRedesignV299.css` e os botões de grupo da V304.5: títulos de canais e salas de voz voltam ao tamanho apropriado.
- Dá maior prioridade à conversa, ocultando o cabeçalho ornamental duplicado apenas no desktop (o botão de criar servidor segue disponível na barra de servidores).
- Melhora espaçamentos e legibilidade de mensagens e controles.
- Estabiliza as dimensões das miniaturas de anexos (o arquivo completo continua abrindo ao clicar).
- Reduz o lançador de mensagens privadas a um ícone na Comunicação desktop, preservando o painel aberto e o acesso às MPs.
- Respeita os temas de temporada; não altera o banco de dados.

## Testes

- `npm run test:updater` — 4 testes passaram.
- `GITHUB_REF_NAME=v0.304.7 node desktop/verify-release-version.cjs` — passou.
- JSX de `CommunicationHubV284.tsx` analisado sem erros de sintaxe.
- Chromium 1420, 1100 e 920 px: fonte dos grupos 10 px, barras e chat mantidos na área correta.

**Pendente:** `npm ci && npm run build` e conferência de todos os estados reais no Electron/Windows. Não foi realizado teste com login e Supabase ativo.

## Publicação

```powershell
npm ci
npm run build

git add .
git commit -m "HaxBag V304.7 - Melhorar Comunicacao"
git push origin main

git tag v0.304.7
git push origin v0.304.7
```

Publique a tag somente depois de confirmar que o build passou.
