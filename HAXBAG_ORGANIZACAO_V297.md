# HäxBag V297 — organização e consolidação segura

## O que mudou

- Versão: `0.296.0` → `0.297.0`.
- CSS: **94 → 52** arquivos. As regras dos arquivos antigos foram copiadas **sem mudanças** para 15 pacotes lógicos. A ordem de importação foi preservada dentro de cada componente e o caminho relativo de URLs CSS permaneceu na mesma pasta.
- Notas antigas: **48 arquivos** `.md`/`.txt` da raiz agora estão preservados integralmente em `docs/HISTORICO_DE_NOTAS.md`, com índice e seções pelo nome original.
- Documentação ativa (README, configuração do desktop, GitHub, Comunicação, segurança) continua separada.
- **SQL e regras TypeScript não foram mesclados.** Scripts SQL devem continuar separados para não executar migrações antigas novamente. Arquivos SVG são artes individuais usadas por temas e não devem ser concatenados.
- 3 imagens iniciais do Vite/React não utilizadas e sem referências (`vite.svg`, `react.svg` e `hero.png`) foram removidas; não foi removida nenhuma arte de tema ou arquivo de produção.
- Sem mudanças no banco de dados, permissões, lógica de RPG, React, autenticação ou atualizador Electron.

## Pacotes CSS criados

- `src/ConditionsPanel.styles.css` ← `ConditionsEnhancements.css`, `ConditionsV140.css`, `ConditionsV144.css`, `ConditionsV145.css`, `ConditionsV152.css`, `ConditionsSeverityV220.css`
- `src/themes/SeasonStyles.css` ← `seasonThemes.css`, `seasonThemes-enhanced.css`
- `src/themes/SheetBestiaryStyles.css` ← `rosterCrestFix.css`, `sheetsRefined.css`, `bestiaryRefined.css`
- `src/CombatActions.styles.css` ← `CombatCriticalV272.css`, `CombatDamageToggleV276.css`, `CombatActionsV277.css`, `CombatActionsV278.css`, `CombatActionsV279.css`
- `src/themes/MobileSessionStyles.css` ← `mobileSession.css`, `mobileEmojiPicker.css`
- `src/components/AppProfile.styles.css` ← `ProfileUnified.css`, `ProfileAtelier.css`, `ProfilePolish.css`, `ProfileV132.css`, `ProfilePersonalTheme.css`, `ProfileV150.css`, `ProfileSocialV158.css`, `SocialRpgSpacesV159.css`, `SocialProfileV160.css`
- `src/components/CommunicationHub.styles.css` ← `CommunicationHubV284.css`, `CommunicationHubV285.css`, `CommunicationHubV287.css`, `CommunicationHubV288.css`, `CommunicationHubV289.css`, `CommunicationHubV295.css`
- `src/components/FriendsPanel.styles.css` ← `FriendsPanel.css`, `SocialV156.css`, `SocialV160.css`, `SocialV161.css`, `SocialV162.css`, `SocialV163.css`, `SocialV180.css`, `SocialV189.css`, `SocialChatV201.css`, `SocialV214.css`
- `src/components/FriendsPanelRedesign.styles.css` ← `SocialRedesignV232.css`, `SocialRedesignV264.css`
- `src/components/VoiceCall.styles.css` ← `VoiceCallV288.css`, `VoiceCallV290.css`
- `src/components/SocialSuiteExtras.styles.css` ← `SocialV248Unified.css`, `SocialV280CommunityComments.css`
- `src/CombatDamage.styles.css` ← `CombatDamageV274.css`, `CombatDamageV282.css`
- `src/components/MinigamesExtras.styles.css` ← `ArcadeBoardVisualsV207.css`, `ArcadeMemoryV208.css`
- `src/components/ProfileLegacy.styles.css` ← `ProfileLegacy.css`, `ProfileLegacyV230.css`
- `src/components/PublicProfileBase.styles.css` ← `PublicAdventurerProfile.css`, `PublicProfileV151.css`

## Aplicação

A atualização incremental deve ser aplicada à pasta da **V296**, sobrepondo arquivos e **apagando os arquivos antigos removidos** (que constam em `ARQUIVOS_REMOVIDOS_V297.txt` dentro do ZIP incremental). Apenas copiar os arquivos novos sem remover os antigos não reduz a contagem de arquivos.

Se estiver em dúvida, use o ZIP completo V297 em uma cópia da pasta do projeto, preservando `.git` e seu `.env.local` local.

Para publicar: `git add -A` e **verifique `git status`** antes do commit, não suba `.env.local`, `node_modules` ou compilados. Faça commit/push e depois crie a tag `v0.297.0`, se o workflow atual estiver operacional.

## Verificação

- Cada CSS removido tinha exatamente uma importação e cada grupo era consecutivo, sem mexer na ordem da cascata.
- Todos os conteúdos CSS foram preservados no novo pacote (os comentários `arquivo original` marcam os limites).
- As notas históricas foram transferidas sem resumir seu texto.
- Testes estáticos e integridade dos arquivos são verificados antes do envio.
