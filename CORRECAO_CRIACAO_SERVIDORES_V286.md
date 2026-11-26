# HäxBag V286 — Correção da criação de servidores

## Problema

Ao criar um servidor da aba Comunicação, o Supabase pode responder:
`new row violates row-level security policy for table "hax_v284_servers"`.

O `INSERT ... RETURNING id` da V285 precisa obedecer à política SELECT, mas a política original só permite ler o servidor após o usuário ser incluído em `hax_v284_members` pelo trigger `AFTER INSERT`.

## Correção

- `HAXBAG_REPARO_SERVIDORES_RLS_V286.sql`: permite que o proprietário autenticado leia seu próprio servidor, mantendo os outros servidores restritos aos membros; reexecutável e sem exclusão de dados.
- `src/components/CommunicationHubV284.tsx`: cria o UUID do servidor no cliente e faz o `INSERT` sem pedir retorno imediato; em seguida, carrega os servidores e seleciona o novo. Mantém o trigger e a criação padrão de `#geral` e `#avisos`.
- Mensagem de erro distingue falhas de permissão RLS de ausência de tabela/migração.

## Aplicação

1. No Supabase SQL Editor, execute **somente** `HAXBAG_REPARO_SERVIDORES_RLS_V286.sql` (se já executou a migração V284).
2. Extraia `HaxBag_Correcao_Servidores_Comunicacao_V286.zip` sobre a pasta principal do projeto `haxbag` e confirme a substituição dos arquivos.
3. Reinicie/recompile a aplicação (`npm run build`) e faça login novamente se a sessão estiver expirada.
4. Tente criar um servidor. Ele deve aparecer com os canais `#geral` e `#avisos`.

Se a tabela V284 realmente não existir, execute primeiro `HAXBAG_COMUNICACAO_V284.sql`. **Não** desative RLS e **não** execute de novo a migração V284 se ela já está instalada, pois as políticas originais não usam `IF NOT EXISTS`.

## Limites da validação

Código revisado e pacotes conferidos estaticamente. O reparo SQL não foi executado contra seu banco Supabase; faça um teste de criação na instalação real.
