# HäxBag V290 — Sala de voz redesenhada e transmissão de tela

Base: V289. Mantidos servidores, canais, convites, mensagens, anexos, permissões e canais de voz existentes.

## Alterações
- Redesign completo do painel de chamada, com cabeçalho, participantes maiores, resumo da sala e controles fixos, inclusive em telas menores.
- Botão **Transmitir tela**, disponível somente quando a chamada estiver conectada. Pede autorização explícita ao navegador para escolher janela, aba ou tela.
- A transmissão usa a trilha de vídeo do WebRTC, sem usar o Supabase como servidor de mídia. O canal privado Realtime V288 continua fornecendo presença e sinalização; o indicador de transmissão é anunciado pela presença da sala.
- Os demais participantes podem assistir dentro da chamada, escolher entre telas simultâneas e expandir em tela cheia (quando suportado pelo navegador).
- Botão **Parar transmissão** e detecção do encerramento pelo próprio navegador. A trilha enviada é removida sem interromper o áudio.
- Chamada persistente ao visitar canais de texto, com visualização compacta da transmissão.
- Captura **somente de vídeo**, sem áudio do sistema; a voz vem do microfone como antes. Nenhuma gravação foi adicionada.

## Instalação
Extraia `HaxBag_Atualizacao_Comunicacao_Tela_V290.zip` na pasta do projeto `haxbag`, preservando as pastas `src/components/`.
Arquivos modificados/adicionados: `src/components/VoiceCallV288.tsx`, `src/components/VoiceCallV290.css` e este documento.

**Nenhum SQL novo é necessário**, desde que as migrações V284, V286, V288 e o reparo V289 já estejam instalados.

## Requisitos
- HTTPS ou localhost, navegador com suporte à API `getDisplayMedia`, permissão da tela concedida pelo próprio usuário.
- Tela/aba/janela escolhida pelo usuário; a captura é interrompida ao sair da chamada, clicar em Parar transmissão ou interromper no navegador.
- Mesma infraestrutura WebRTC da V288 (malha até 8 participantes); em algumas redes será preciso configurar TURN. Compartilhar vídeo eleva o uso de CPU e upload.
- A permissão de transmissão/visualização é do canal de voz existente. Remoção em tempo real de participantes da sessão ainda requer revogação ativa no backend para desligamento imediato.

## Validação executada
- TypeScript do componente React e integração de Comunicação: `tsc -p tsconfig.voice.v288.json --noEmit --pretty false` passou.
- Prévia HTML demonstrativa testada por navegador automatizado com largura 390, 900, 1440 e 1920 px, sem rolagem horizontal; botões de transmitir/parar e microfone testados.
- Validação de integridade ZIP.

**Ainda não validado**: mídia WebRTC real entre duas contas Supabase em redes distintas, captura de tela em cada navegador e build Vite completo. A prévia HTML não captura tela nem acessa Supabase.
