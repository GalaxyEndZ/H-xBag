# HäxBag V302.0 — Chamada flutuante e presença privada

## O que foi implementado

### 1. Chamada contínua entre as áreas

- A conexão WebRTC deixou de pertencer à página de Comunicação. O **host global** permanece montado ao alternar entre RPG, Social, Minigames e Comunicação, sem capturar um segundo microfone.
- Um painel de chamada pode ser **arrastado**, **minimizado** e **fixado**. A posição e a preferência de fixação são salvas no dispositivo.
- O painel mostra as pessoas da chamada e oferece os controles anteriores: microfone, som, tela, volume e sair.
- O botão **▣ Janela** tenta abrir uma janela nativa **Document Picture-in-Picture**, sobre outras janelas, com a transmissão selecionada. Se a versão do Electron não oferecer a API, a janela flutuante **dentro** do HäxBag continua funcional.
- A janela nativa mostra **vídeo da tela**, sem áudio duplicado; os controles da chamada continuam no painel principal. Fechar a janela nativa não encerra a chamada.

### 3. Presença e atividade em tempo real

1. Execute `HAXBAG_PRESENCA_V302.sql` no SQL Editor do Supabase (requer Comunicação V284).
2. No HäxBag, use **Presença** na barra superior para escolher **Disponível**, **Ocupado** ou **Invisível**.
3. A preferência **Mostrar atividade atual** é separada do status. Ela revela apenas `No RPG`, `No Social`, `No Arcade`, `Na Comunicação` ou `Em chamada`.
4. No painel de membros dos servidores e nos perfis do Social, aparece o status das pessoas com quem você divide algum servidor, desde que elas tenham escolhido compartilhar.

**Privacidade e segurança:** a presença começa como **Invisível** e a atividade, **desligada**. O banco aplica RLS: cada usuário altera apenas sua própria linha e só membros de servidores em comum podem consultá-la. Não há lista pública global, nem envio de nomes de personagens, campanhas privadas ou conteúdo de mensagens. Ao escolher invisível, o app remove o registro; telas de outros usuários podem demorar até a próxima sincronização periódica para refletir a ausência. Linhas antigas deixam de ser exibidas após cerca de 95 segundos sem atualização.

## Compatibilidade

- Mantido o atualizador silencioso V300.1 e o layout V301.1/V301.2.
- Não foi alterada a lógica de fichas, inventários, combates, permissões de personagens ou regras de RPG.
- Não foi introduzida gravação de áudio/vídeo, serviço de mídia ou servidor TURN. O comportamento de conexão continua dependendo do WebRTC e da configuração ICE/TURN já existente.
- A janela PiP nativa exige suporte do Electron/Chromium e uma interação de usuário. A janela flutuante dentro do app funciona sem essa API.

## Publicação

Confira `package.json` = `0.302.0`, faça commit e push dos arquivos do código-fonte; **depois** crie e publique a tag `v0.302.0`.

```powershell
npm ci
npm run build
npm run test:updater

git add .
git commit -m "HaxBag V302.0 - Chamada flutuante e presenca"
git push origin HEAD

git tag v0.302.0
git push origin v0.302.0
```

A primeira compilação deve rodar o SQL antes do teste da presença. Para testar voz: entre numa sala, navegue para Fichas, minimize/expanda o painel, compartilhe uma tela e encerre a chamada. Para presença: use duas contas que sejam membros de um mesmo servidor, habilite Disponível em uma delas, alterne a atividade e teste Invisível.

## Validação local

Sintaxe TSX/TS analisada; testes pré-existentes de atualizador executados com sucesso; verificador de tag confirmou V302.0. A compilação completa ficou indisponível neste ambiente porque o cache npm não contém os pacotes do Electron. Execute `npm ci && npm run build` no Windows/GitHub Actions antes de publicar a release.
