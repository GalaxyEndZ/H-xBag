# HäxBag V284 — Comunicação

Versão construída **sobre o projeto enviado** `haxbag(20261126-043959).zip`.

## Novos recursos

- **Comunicação** como quarto espaço, ao lado de Social, RPG e Minigames, integrado à navegação, busca global e voltar/avançar.
- Criação de servidores de texto, descrição e ícone; cada servidor começa com `#geral` e `#avisos`.
- Canais públicos e canais reservados à equipe, com assunto/descrição.
- Mensagens com atualização em tempo real via Supabase Realtime e consulta periódica de contingência, histórico limitado às 100 últimas por canal.
- Responder, editar as próprias mensagens, apagar, fixar/desafixar (equipe), reações com emojis, pesquisa local nas mensagens carregadas.
- Anexos **privados** de até 8 MB: PNG, JPG, WEBP, GIF, PDF e TXT; links de visualização temporários.
- Indicação de canais com mensagens novas, registro de última leitura, lista de membros e cargos (dono, administrador, moderador, membro).
- Convites com código/link, prazo de 7 dias e revogação; entrada por código ou link.
- Moderação: cargos, expulsão de membro segundo a hierarquia e exclusão de mensagens.
- Botão de mensagens privadas que **reutiliza o chat do Social** sem migrar ou duplicar conversas.
- Layout responsivo, respeitando a paleta da temporada.

## Instalação

1. Faça backup do seu projeto atual.
2. Extraia o ZIP de atualização **na raiz da pasta `haxbag`**, substituindo os arquivos.
3. No Supabase, abra **SQL Editor** e execute o script `HAXBAG_COMUNICACAO_V284.sql` inteiro, uma vez.
4. Teste com pelo menos duas contas: crie um servidor, gere um convite, entre com a segunda conta, envie mensagens e teste canais reservados à equipe.
5. Rode `npm run build` no seu computador. O arquivo `.env.local` não foi incluído nos ZIPs por conter configurações privadas.

> O frontend sozinho não ativa os servidores: é **obrigatório executar o SQL** antes de usar Comunicação.

## Limites atuais

- **Não há voz, vídeo, transmissão de tela nem bots** nesta versão; exigem serviços e controle de sessões próprios. Não existem botões simulando chamadas em funcionamento.
- Busca limitada às últimas 100 mensagens carregadas por canal.
- A atualização em tempo real depende da publicação `supabase_realtime` no banco; há atualização periódica se não estiver disponível.
- Expulsão não é bloqueio permanente: um ex-membro pode retornar com um convite válido.
- Excluir um servidor ou canal não remove automaticamente os objetos antigos do Storage; novos usuários não terão acesso, pois a autorização é validada por canal.
- Os dados e as regras do RPG/Social existentes não foram migrados nem modificados.

## Arquivos modificados / novos

- `src/App.tsx` — navegação e renderização do novo espaço.
- `src/siteNavigation.ts` — URL e histórico do novo espaço.
- `src/components/SocialRpgSpacesV159.css` — menu de quatro abas.
- `src/components/CommunicationHubV284.tsx` — interface e Supabase.
- `src/components/CommunicationHubV284.css` — visual responsivo.
- `HAXBAG_COMUNICACAO_V284.sql` — tabelas, funções, políticas RLS, Storage privado e Realtime.
- `COMUNICACAO_V284.md` — estas instruções.

## Validação neste ambiente

- Componente novo testado com TypeScript isolado (sem erros).
- Sintaxe de `App.tsx` e `siteNavigation.ts` validada com o compilador TypeScript.
- Build completo e aplicação da migração em um banco Supabase real não foram executados neste ambiente.
