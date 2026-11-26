# HäxBag Desktop V299 · Redesign do aplicativo

Esta versão modifica **o código real** da interface do Electron, não uma prévia/imagem.

## O que mudou

- **Navegação principal:** os quatro espaços (Social, RPG, Minigames, Comunicação) passam a ter uma linha completa para cada ação, com indicadores de seleção, hover e foco. Os menus contextuais ficam separados e roláveis.
- **Barra superior:** breadcrumbs, busca global, notificações e controles com dimensões consistentes.
- **Comunicação:** cabeçalho contextual, rail de servidores, canais, salas de voz, indicadores de não lidos e ações de convite/configuração remodelados.
- **Chat:** melhor leitura dos nomes, mensagens, imagens anexadas, boas-vindas, divisores de data e campo de composição.
- **Voz / transmissão:** superfícies e bordas alinhadas ao restante da Comunicação.
- **Atualizador:** card reduzido quando tudo está atualizado; expande-se ao clicar e continua destacando erros e atualizações prontas para instalar.
- **Responsividade:** o painel de membros sobrepõe a conversa em telas menores, evitando quarta coluna vazia; o menu de canais continua acessível no layout estreito.
- **Temas:** cores obtidas dos tokens `--season-*`; preserva as paletas de temporada.

## Arquivos

- `src/DesktopRedesignV299.css` — sistema visual global do Electron.
- `src/components/CommunicationDesktopRedesignV299.css` — componentes da Comunicação.
- `src/App.tsx` — aplica a classe `hb-desktop-v299` e importa o CSS novo.
- `src/components/CommunicationHubV284.tsx` — importa o CSS novo da Comunicação.
- `package.json`, `package-lock.json` — versão **0.299.1** para esta release.

Não foram alterados contratos de banco, políticas RLS, lógica de RPG, envio de mensagens, acesso à voz ou distribuição de atualizações.

## Aplicar

O pacote completo pode substituir o projeto da V298.1. Na raiz do projeto:

```powershell
npm install
npm run build
npm run desktop:dev
```

Para publicar uma **nova** atualização no GitHub, faça commit/push do projeto no repositório do código e, **depois do commit**:

```powershell
git tag v0.299.1
git push origin v0.299.1
```

O workflow do Electron publica a nova versão no repositório de releases configurado, com o Setup e `latest.yml`. A versão instalada V298.1 poderá detectá-la quando o workflow concluir corretamente.

## Observações de verificação

- CSS validado com parser PostCSS; TSX validado por parser TypeScript.
- `npm run test:updater`: 4 testes aprovados.
- A compilação React completa e a aparência no Electron devem ser verificadas num ambiente com dependências instaladas e sessão autenticada; o pacote desta entrega é código-fonte, não um `.exe` compilado.
