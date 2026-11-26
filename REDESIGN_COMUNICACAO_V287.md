# HäxBag V287 — Redesign da aba Comunicação

Base: projeto completo V286 (incluindo o reparo de RLS dos servidores).

## Melhorias

- Área de Comunicação ocupa a largura disponível da página, sem ficar presa a um contêiner estreito central.
- Novo cabeçalho e barra de contexto do servidor/canal, com atalhos funcionais para localizar canais, escrever e convidar (quando autorizado).
- Navegação de servidores mais ampla e confortável, canais mais legíveis e diferenciação visual entre canais públicos e privados.
- Conversa principal com título, descrição, contagem de mensagens carregadas e pesquisa local mais fáceis de identificar.
- Mensagens com melhor hierarquia tipográfica, espaçamento, indicadores de data, ações, reações e destaque para anexos.
- Área de boas-vindas com atalho para escrever a primeira mensagem quando o canal estiver vazio.
- Editor de mensagens ampliado, com campo de texto, botão de anexo e envio mais acessíveis.
- Membros, moderação e configurações com espaços e tamanhos aprimorados.
- Ajustes responsivos para desktop, tablet e celular; em telas pequenas, o servidor/canal ativo e o chat têm prioridade.

## Arquivos alterados

- `src/components/CommunicationHubV284.tsx`: interface, atalhos e acessibilidade.
- `src/components/CommunicationHubV287.css`: nova camada visual, importada depois da V285.

## Preservação e instalação

- **Sem SQL novo.** Mantenha as migrações V284 e reparo V286 do Supabase já aplicados.
- Não foram modificadas as regras de RLS, nem tabelas, sessões, mensagens ou convites existentes.
- Extraia o ZIP de atualização na raiz do projeto `haxbag`, substituindo os arquivos de mesmo caminho.
- Execute `npm run build` e teste a aba com seu Supabase real.

## Validação

- Sintaxe TSX via TypeScript transpileModule: aprovada.
- CSS analisado: sem erros de parsing.
- Prévia visual em 1920, 1280, 900 e 390 px: sem estouro horizontal; teste de navegação por canais em 390 px.
- Build integrado e operações no Supabase real: **não executados** neste ambiente.
