# HäxBag V201 — Conversas privadas redesenhadas

## Alterações

- Reorganização da lista de contatos: contador de conversas, busca, filtro de não lidas, visual selecionado e data da última mensagem.
- Cabeçalho da conversa mais compacto e consistente com os temas do HäxBag.
- Pesquisa dentro da conversa recolhível, aberta apenas ao clicar em **Buscar** (busca entre as mensagens carregadas).
- Mensagens consecutivas do mesmo remetente em até 5 minutos são agrupadas visualmente; a foto permanece no início do grupo.
- Balões ajustados ao texto, horários e ações **Copiar**/**Apagar** alinhados horizontalmente.
- Fotos em balões compactos, ampliáveis pela URL assinada já existente.
- Editor reorganizado com anexos, campo de mensagem, botão Enviar e instruções de teclado.
- Ajustes de interface e navegação para celulares e tablets; respeita os temas da temporada.

## Arquivos alterados

- `src/components/FriendsPanel.tsx`
- `src/components/SocialChatV201.css` (novo)

## Compatibilidade

Mantidas as RPCs existentes, as mensagens já salvas, permissões, bloqueios, fotos, exclusões, marcação de leitura, pesquisa e atualizações periódicas. **Nenhuma migração SQL é necessária.**

## Validação

- Sintaxe de 53 arquivos TS/TSX validada com TypeScript.
- Novo CSS validado com parser CSS.
- `npm run build` não pode ser concluído neste ambiente devido à falta das dependências de tipos do Node e do Vite.

Ao instalar a correção, preserve a pasta `.git` e os arquivos `.env` e execute `npm ci` e `npm run build` no seu computador.
