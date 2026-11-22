# HäxBag — Republicações com mensagem e foto (V250)

## Atualizações

- O botão **Republicar** abre um compositor para adicionar uma mensagem opcional antes de publicar.
- **Citar** utiliza o mesmo compositor, mas exige um comentário.
- Ambas as ações exibem a prévia e os dados do autor original.
- Os cartões especiais agora mostram a foto pública do usuário (ou inicial, se não houver foto), além de seu `@`.
- A mensagem de uma republicação pode ser editada posteriormente pela ação **Editar**, já existente no cartão.
- O feed clássico mantém suas publicações; o compartilhamento é salvo como publicação vinculada ao post original no feed integrado.
- Nenhuma alteração no banco é exigida, assumindo que as migrações sociais existentes até as ações unificadas já foram aplicadas.

## Arquivos modificados

- `src/components/FriendsPanel.tsx`
- `src/components/SocialV231Suite.tsx`

## Arquivos novos

- `src/components/SocialShareComposerV250.tsx`
- `src/components/SocialShareComposerV250.css`

## Instalação

Extraia **HaxBag_Correcao_Republicacoes_V250.zip** na raiz do projeto e substitua os arquivos existentes. Em seguida execute `npm run build`.

Os três componentes TSX relacionados passaram pela verificação de tipos TypeScript (modo com verificações de variáveis não usadas habilitadas). O build completo e o comportamento com dados reais ainda precisam ser testados no ambiente de publicação.
