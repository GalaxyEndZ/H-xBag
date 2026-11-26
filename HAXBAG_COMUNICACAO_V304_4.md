# HäxBag V304.4 — Redesign da Comunicação

## O que mudou
- O cabeçalho da Comunicação foi simplificado: o caminho servidor/canal agora aparece somente na área principal e no menu de canais, sem a barra de contexto duplicada.
- O chat ganhou cabeçalho de canal com controles agrupados: fixadas, membros, convites (quando permitido) e configurações.
- A busca e o contador de mensagens foram reunidos em uma única linha de ferramentas.
- O menu lateral usa espaçamento mais compacto e agrupa ações administrativas em “Gerenciar servidor”.
- Emojis, mensagens agendadas e enquetes agora usam uma barra compacta. O painel selecionado aparece por cima da conversa; as funções continuam montadas e utilizáveis.
- O desenho respeita o modo de foco, a largura de canais ajustável e o menu móvel.

## Instalação
Substitua o conteúdo da pasta do projeto pelo ZIP completo ou aplique os arquivos do pacote de alterações. Nenhuma migração SQL adicional é necessária.

## Validações
- Sintaxe estática dos 94 arquivos TS/TSX: aprovada.
- CSS de redesign analisado com tinycss2: sem erros de parsing.
- Quatro testes locais do atualizador: aprovados.
- `desktop/verify-release-version.cjs` validado com `v0.304.4`.
- Compilação Vite/Electron NÃO executada neste ambiente: o pacote `electron` não estava disponível no cache npm offline. Execute `npm ci && npm run build` antes de publicar a tag.

## Publicação
```powershell
npm ci
npm run build
git add .
git commit -m "HaxBag V304.4 - Redesign da Comunicacao"
git push origin main
git tag v0.304.4
git push origin v0.304.4
```
