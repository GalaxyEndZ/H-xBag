# HäxBag V288 — Comunicação com canais de voz

Base: V287. Foram preservadas as funcionalidades anteriores de servidores, convites, canais de texto, mensagens, anexos, moderação e permissões.

## O que há de novo

- Tipo `Voz` ao criar um canal, sem alterar os canais de texto existentes.
- Seções próprias para canais de texto e salas de voz, inclusive salas reservadas à equipe.
- Entrada explícita em chamada, com solicitação de permissão do microfone no navegador.
- Voz em tempo real por WebRTC entre navegadores; sinalização e presença por Supabase Realtime (canais privados com RLS).
- Identificação dos participantes na chamada, controle de microfone e som, volume de entrada e saída da chamada.
- Chamada permanece aberta em um painel compacto quando o usuário navega para um canal de texto.
- Microfone e conexões encerrados quando o usuário sai da chamada; tratamento de erros de permissão e rede.
- Interface responsiva e acabamento visual para canais e sala de voz.

## Instalação

1. Instale os arquivos de atualização na raiz `haxbag`, substituindo `src/components/CommunicationHubV284.tsx` e adicionando os novos CSS e TSX.
2. No Supabase SQL Editor, execute `HAXBAG_CANAIS_VOZ_V288.sql` **uma vez**, depois das migrações V284/V286.
3. Rode `npm run build` no seu Windows, publique o site com HTTPS (ou use localhost para desenvolvimento).
4. Crie um canal do tipo Voz; entre com duas contas em navegadores/dispositivos diferentes; permita o microfone em ambos.

## Condições técnicas e limitações

- V288 utiliza malha WebRTC (peer-to-peer), indicada para grupos pequenos (até 8 participantes, incluindo o próprio usuário).
- O Supabase fornece sinalização/presença; **não transmite o áudio** pelo banco de dados.
- Redes com NAT ou firewall restritivos podem precisar de um serviço **TURN**. A V288 usa STUN público por padrão.
- Configuração TURN opcional: `VITE_HAXBAG_VOICE_ICE_URL` pode apontar para um endpoint HTTPS da sua infraestrutura que valide o JWT e retorne `{ "iceServers": [{ "urls": "turn:...", "username": "credencial-temporaria", "credential": "segredo-temporario" }] }`. **Nunca** coloque a chave permanente ou segredo TURN em `VITE_*`.
- O navegador pode bloquear a reprodução automática de som: use o botão **Ativar áudio dos participantes** se aparecer.
- O acesso ao microfone depende de HTTPS/localhost e permissão concedida pelo usuário. Não há câmera, vídeo, gravação, compartilhamento de tela ou ligações que toquem quando o usuário estiver offline.
- A autorização do Realtime é verificada quando o usuário entra no tópico; remoções de membros podem exigir que a conexão de voz seja revalidada/reconectada para revogar a sessão antiga. Para revogação imediata em produção, implemente controles adicionais no backend/serviço de mídia.

## Verificações executadas

- TypeScript isolado: `tsc -p tsconfig.voice.v288.json --noEmit` sem erros (configuração de checagem incluída no pacote).
- Prévia HTML testada com Chromium em 390, 900 e 1440 px, sem overflow horizontal, com botões de microfone, som e entrar/sair respondendo.
- Verificação de integridade dos arquivos ZIP.

**Não validado**: chamada de áudio real com duas contas no Supabase do usuário, implantação do SQL e build Vite completo no Windows. A prévia HTML é demonstrativa e não acessa microfone nem Supabase.
