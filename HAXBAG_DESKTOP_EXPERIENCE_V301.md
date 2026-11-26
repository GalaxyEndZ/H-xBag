# HäxBag Desktop Experience — V301.0

**Escopo:** somente o aplicativo Windows (Electron). A versão web mantém sua navegação responsiva e o funcionamento anterior. Não exige migração SQL. Nenhuma regra de combate, ficha, permissões do Supabase, voz, identidade de conta ou rotina de atualização foi modificada.

## Redesign implementado

- **Dois níveis de navegação:** trilha vertical persistente para Social, RPG, Minigames e Comunicação; quando expandido, um painel separado mostra apenas as ferramentas da área atual. Menos opções duplicadas e menos dispersão visual.
- **Navegação contextual:** Comunicação inicia com a trilha compacta para aproveitar o espaço do chat; RPG e Social preservam a área de ferramentas. Botão na barra superior alterna. Preferência da V300 continua reconhecida.
- **Ajuste real de largura:** painel lateral global entre **254 e 336 px**; painel de canais da Comunicação entre **202 e 360 px**. Arraste a divisória, use setas com foco ou dê dois cliques para restaurar. Durante o arraste somente a variável CSS muda; React não redesenha todas as mensagens a cada movimento.
- **Recolher canais:** na Comunicação, o botão `«` recolhe a coluna de canais; o botão **Canais** reabre sem perder servidor ou mensagem atual.
- **Preferências do desktop:** ícone de layout na barra superior para densidade **Confortável/Compacta**, modo de foco e restauração dos tamanhos. A densidade e os tamanhos são guardados apenas no computador. Modo de foco não persiste após fechar o aplicativo.
- **Atalhos de teclado:** `Ctrl+\` alterna o painel global (fora de campos de texto); `Alt+1` Social; `Alt+2` RPG; `Alt+3` Minigames; `Alt+4` Comunicação. Eles não interceptam teclas enquanto você digita ou usa um diálogo.
- **Tela de comunicação:** cabeçalhos compactados, chat com mais espaço, painel de membros em sobreposição e editor preservado. A versão desktop pode usar a altura livre da janela; o modo estreito mantém a navegação de toque.
- **Atualizações V300.1 preservadas:** download em segundo plano e ícone discreto no topo, sem cartão sobre a conversa.

## Arquivos principais

- `src/App.tsx` — composição do shell, preferências, atalhos e divisória global.
- `src/DesktopExperienceV301.css` — nova hierarquia das colunas e painel de configurações.
- `src/components/DesktopWorkspaceControlsV301.tsx` — controle interativo das preferências.
- `src/components/CommunicationHubV284.tsx` — divisória e recolhimento de canais, sem alterar consultas ou permissões.
- `src/components/CommunicationExperienceV301.css` — dimensões e hierarquia do chat.
- `package.json` e `package-lock.json` — versão sincronizada em `0.301.0`.

## Testar antes de publicar

```powershell
npm install
npm run build
npm run test:updater
npm run desktop:dev
```

Dentro da versão desktop, conferir:

1. Social, RPG, Minigames e Comunicação alternam corretamente (botões e Alt+1..4).
2. Expandir/recolher o painel com `Ctrl+\`; os submenus do RPG continuam acessíveis.
3. Arrastar a borda do painel global; fechar e abrir novamente; confirmar largura guardada.
4. Na Comunicação, redimensionar canais, recolher, reabrir e enviar uma mensagem.
5. Abrir membros e uma sala de voz; confirmar que não perde os controles de áudio.
6. Verificar densidade, foco, restauração, busca Ctrl+K e atualizações discretas.
7. Redimensionar a janela, inclusive para até 800 px, para verificar o drawer móvel.

**Nota sobre validação neste ambiente:** os arquivos TSX passaram na análise sintática do compilador TypeScript; os CSS passaram no parser; os quatro testes do atualizador passaram. A instalação de pacotes npm falhou por falta de acesso ao registro, logo o build Vite/TypeScript completo e o teste visual do Electron ainda devem ser realizados no Windows ou GitHub Actions.

## Publicar no repositório de código-fonte

Copie a pasta `haxbag` atualizada sobre o projeto. No terminal na pasta raiz:

```powershell
node -p "require('./package.json').version"  # deve mostrar 0.301.0
git add .
git commit -m "HäxBag v0.301.0 - Desktop Experience"
git push origin HEAD
git show HEAD:package.json | Select-String '"version"'
git tag v0.301.0
git push origin v0.301.0
```

**IMPORTANTE:** não crie uma tag antes do commit que contém a versão correspondente. Confirme o instalador e o `latest.yml` em `GalaxyEndZ/H-xBagReleases` após a execução do workflow.

## Próximas etapas desejadas

Esta versão inaugura a **V301 Desktop Experience** (opção 1). As outras prioridades escolhidas podem seguir de forma incremental: **V302 Comunicação 2.0** (microfone, saída de áudio, push-to-talk, transmissão), **V303 notificações inteligentes**, **V304 perfis e presença**, **V305 desempenho e recuperação**. Não estão sendo descritas como recursos já implementados nesta entrega.
