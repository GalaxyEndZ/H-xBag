# HäxBag V303 — Servidores, Comunidades e Conquistas

## Pré-requisitos
Esta versão utiliza o projeto V302 e os bancos do Social (V231), Comunicação (V284/V286/V289) e Presença (V302).

## Instalação
1. Faça backup do banco e teste primeiro em um projeto Supabase de homologação.
2. No SQL Editor, execute **HAXBAG_V303_SERVIDORES_COMUNIDADES_CONQUISTAS.sql** integralmente.
3. Copie os arquivos do projeto para o repositório principal (não o repositório de instaladores).
4. Execute `npm ci` e `npm run build` em uma máquina com dependências instaladas.
5. Envie o commit à branch principal. Depois crie e envie a tag `v0.303.0`.
6. Confira se a release gerou `latest.yml` e `HaxBag-Setup-0.303.0-x64.exe`.

## Novidades
**Servidores → Cargos e permissões** (apenas dono): crie cargos personalizados, defina nome, cor, prioridade visual e conceda permissões. Cargos básicos permanecem. O Supabase controla as ações; alterar a interface local não permite criar canais nem moderar mensagens sem autorização. Permissões desta entrega: gerenciar canais, moderar mensagens, gerenciar convites e ler canais privados. As atribuições são feitas por uma RPC que verifica identidade e propriedade do servidor.

**Social → Comunidades → Comunidade selecionada → Espaços**: áreas de discussões, avisos e recursos (texto e links). Donos/moderadores criam e apagam espaços. Só membros aprovados leem ou publicam. Em Avisos, só dono e moderadores publicam. Conteúdo existente de comunidades e feed foi preservado.

**Social → Minha atividade** ou **Perfil → Insígnias**: vitrine separada de conquistas globais. Os critérios são contados e concedidos pelo banco, nunca por dados enviados pelo cliente. Inclui marcos de posts, comentários, comunidades, servidores, mensagens e partidas de Pong quando o placar RPC estiver disponível. A função reavalia automaticamente ao abrir a vitrine ou pressionar Atualizar. Conquistas obtidas ficam gravadas.

## Limitações desta entrega
- Permissões customizadas não substituem Dono/Admin/Moderador e são **aditivas**; não revogam direitos legados de moderação.
- Moderação remota de áudio (silenciar ou expulsar alguém de uma chamada) ainda não está incluída: requer validação específica no sinalizador WebRTC e nas políticas do servidor.
- A biblioteca comunitária aceita referências em texto/links; upload próprio de arquivos ficou para uma atualização posterior.
- As conquistas do Arcade cobrem as partidas de **Pong** registradas. Outros minigames ainda não participam.
- A vitrine é pessoal. Conquistas de outras pessoas não são expostas automaticamente; divulgação pública exigirá uma configuração de privacidade futura.
- A compilação final e as políticas SQL ainda precisam ser validadas no Supabase e no Electron reais.

## Teste de regressão sugerido
- Dono cria e atribui cargo; membro não consegue atribuir cargo alterando requisição.
- Membro com `manage_channels` cria canal; sem permissão não cria.
- Membro sem `read_private_channels` não lê canal privado nem seu conteúdo/anexo.
- Somente dono/moderador cria espaço de Comunidade; pedido pendente não lê posts de espaços.
- Avisos aceitam postagem do moderador e recusam postagem de membro normal.
- Conquista não pode ser inserida diretamente pelo cliente; RPC só concede após critério real.
- Aplicativo continua iniciando, navegando, atualizando em silêncio e mantendo chamadas da V302.
