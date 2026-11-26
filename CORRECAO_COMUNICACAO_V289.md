# HäxBag V289 — Comunicação refinada e RLS dos canais corrigido

**Base preservada:** V288 com os canais de voz, mensagens, convites, cargos e políticas anteriores. O arquivo `.env.local` não é distribuído.

## Correção do erro em hax_v284_channels

A leitura de `hax_v284_channels` usava `hax_v284_channel_readable(id)` que consultava a própria tabela. A política foi reescrita para se basear diretamente no vínculo ao servidor e no campo `staff_only`, mantendo canais privados reservados à equipe. A criação, edição e exclusão seguem disponíveis apenas para donos, admins e moderadores, com proprietário do servidor tratado como responsável mesmo se o vínculo automático de membro estiver atrasado. O frontend cria o UUID antes do envio e não usa `INSERT ... RETURNING`.

Execute **`HAXBAG_REPARO_CANAIS_RLS_V289.sql`** no Supabase SQL Editor *após* a migração V284, o reparo V286 e a migração de voz V288 (se usa voz). Não reexecute a V284. O reparo é idempotente e não apaga dados.

## Refinamentos da aba

- Hierarquia visual mais clara entre servidor, canal ativo, conversa, ações e chamadas de voz.
- Destaque do canal selecionado, números por categoria, mensagem do autor e foco por teclado.
- Cabeçalho de boas-vindas compacto quando já existe conversa, liberando área útil.
- Indicador de carregamento, sem mostrar mensagens do canal anterior ao alternar canais.
- Atualização periódica das reações de outros participantes.
- Atalhos `Ctrl/⌘+K` (buscar mensagens) e `Ctrl/⌘+Shift+K` (buscar canais); `Esc` fecha modais.
- A criação limpa filtros de canais para exibir imediatamente o novo canal.
- Ajustes de contraste, composição, avisos, chamadas e telas pequenas.

## Verificação

Testar com duas contas: proprietário e membro. Criar canais texto e voz como proprietário; confirmar que membro comum NÃO consegue criar canais, que canais privados NÃO aparecem para membros comuns, e que mensagens/reactions funcionam. Necessário testar no Supabase real.
