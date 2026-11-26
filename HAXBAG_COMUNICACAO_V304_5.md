# HäxBag V304.5 — Refinamento da Comunicação

Base: V304.4. Alteração focada no layout; sem migração SQL adicional.

## Melhorias

- Os grupos **Canais de texto**, **Equipe**, **Salas de voz** e **Voz da equipe** podem ser recolhidos individualmente.
- A preferência fica salva localmente (`haxbag:v3045:channel-groups`). Pesquisa e modo de não lidos mostram temporariamente todos os grupos sem alterar essa preferência.
- O cabeçalho da Comunicação ocupa menos altura no Electron e deixa mais espaço para as mensagens.
- Em canais com mensagens, a seção de boas-vindas não ocupa mais espaço no começo do histórico na versão desktop.
- Mensagens têm tipografia levemente maior; ações aparecem ao passar o mouse ou navegar com teclado, e continuam visíveis em dispositivos touch.
- A área de ferramentas e o compositor ganharam acabamento mais uniforme, respeitando as paletas existentes.

## Arquivos modificados
- `src/components/CommunicationHubV284.tsx`
- `src/components/CommunicationRefinementV3045.css` (novo)
- `package.json`
- `package-lock.json`

## Validação
- 94 arquivos TS/TSX: análise sintática aprovada.
- Novo CSS: sem erros de parsing de stylesheet.
- 4 testes locais do atualizador: aprovados.
- Verificação da tag `v0.304.5`: aprovada.
- Não houve build completo Electron/Vite, pois as dependências npm não estavam instaladas no ambiente de trabalho. Execute `npm ci` e `npm run build` antes de criar a tag.

## Publicação
```powershell
npm ci
npm run build
git add .
git commit -m "HaxBag V304.5 - Refinar Comunicacao"
git push origin main
git tag v0.304.5
git push origin v0.304.5
```

Se a tag já existir ou `npm run build` falhar, não recrie a tag nem force o push sem investigar o erro.
