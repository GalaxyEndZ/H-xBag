# HäxBag V304.0 — Enquetes, Enciclopédia, comunidades e Arcade

Base: versão V303.0. Esta entrega mantém os recursos de desktop, voz e presença das versões anteriores.

## Novidades

- **Enquetes** nos canais de texto e espaços das comunidades. Perguntas com 2 a 8 opções, múltipla escolha, votos privados e totais calculados por RPC. As enquetes que já existiam nas publicações do Social foram preservadas.
- **Emojis e figurinhas** do servidor: upload de PNG/WebP/GIF pela equipe, seleção pelo código `:nome:` e exibição em mensagens. O bucket `hax-v304-server-media` é público para carregar os arquivos; evite imagens sensíveis.
- **Entrada personalizada** dos servidores: boas-vindas, regras, até cinco perguntas, confirmação do usuário e cargo personalizado opcional. A política de envio bloqueia mensagens de membros ainda não aprovados; a equipe gestora mantém seu acesso. A adesão antiga continua válida até que o dono ative a configuração.
- **Enciclopédia** no menu de RPG **imediatamente abaixo do Bestiário**. Páginas por campanha, categorias, níveis de visibilidade, edição por mestre, histórico de alterações e controle de conflitos entre edições.
- **Mensagens agendadas** nos canais de texto, com cancelamento antes do envio. Requer instalar e ativar o job do Supabase Cron (ver abaixo). O aplicativo não precisa permanecer aberto.
- **Torneios do Arcade** por temporada mensal, para os dez minigames. O ranking recebe apenas pontuações provenientes dos registros de partidas já verificados pelo backend, quando as tabelas antigas registram encerramento e pontuação de modo compatível.
- **Foto de perfil** nos cartões da barra lateral, usuários e mensagens na Comunicação e participantes das salas de voz. Usa `hax_profile_showcase` (com fallback para `profiles.avatar_url` e, depois, iniciais).

## Instalação do banco

1. Faça backup do Supabase antes de alterações.
2. Execute **`HAXBAG_V304_RECURSOS.sql`** no SQL Editor (após V231, V284/V289 e V303).
3. Para habilitar **envio realmente automático** de mensagens agendadas, habilite a extensão Supabase `pg_cron` e execute **`HAXBAG_V304_HABILITAR_AGENDADOR.sql`** como proprietário do banco. Confirme o job `haxbag-v304-scheduled-messages` em `cron.job`.
4. Abra o HäxBag atualizado, faça login e teste num servidor e numa campanha de homologação.

Sem o agendador, as mensagens podem ser incluídas na fila, mas **não serão enviadas automaticamente**. Não considere o recurso pronto até confirmar o job.

## Testes que devem ser feitos no ambiente real

- Verificar um membro entrar num servidor configurado, aceitar regras e receber o cargo inicial. Confirmar também pelo cliente Supabase que não consegue mandar mensagens antes da aceitação.
- Criar enquete com duas contas; cada conta deve ver apenas seus próprios votos na tabela, mas os mesmos totais agregados.
- Confirmar upload e exibição de um emoji, inclusive em outra conta. O bucket de mídia é público.
- Editar uma página da Enciclopédia com dois usuários simultâneos para testar rejeição de edição obsoleta; confirmar que jogadores não leem páginas exclusivas de mestres.
- Agendar uma mensagem de teste e fechar o Electron. Ela deve aparecer no canal após a próxima execução do Cron. Testar cancelamento.
- Verificar se uma nova partida concluída aparece no torneio. **Importante:** o modelo das tabelas antigas do Arcade/Pong pode variar conforme migrações anteriores; o SQL instala gatilhos em `hax_arcade_runs`/`hax_pong_runs` quando existem e procura colunas usuais de usuário, status, pontuação e término. Se o backend salva as informações noutro formato, o ranking do torneio permanecerá vazio até adaptar o gatilho. Não são aceitas pontuações livres enviadas pelo navegador.
- Conferir as fotos da vitrine do perfil na barra lateral, nos perfis de outros membros, nas mensagens, na chamada e no modo compacto.
- Confirmar o build completo no CI/Windows e uma atualização automática para V304.0.

## Publicação

Depois de copiar os arquivos da pasta `haxbag` para a raiz do repositório e confirmar build: 

```powershell
npm ci
npm run build
git add .
git commit -m "HaxBag V304.0 - Enciclopedia, enquetes e Arcade"
git push origin main
git tag v0.304.0
git push origin v0.304.0
```

Crie a tag **após** o commit. Não publique uma release se o CI falhar. Execute as migrações separadamente e verifique o funcionamento antes de disponibilizar o recurso aos jogadores.

## Validação local

Sintaxe TSX/TS, 4 testes do atualizador, consistência `package.json`/lockfile e integridade do ZIP. **Não houve execução da migração em Supabase real nem compilação completa com dependências do npm no ambiente atual.**
