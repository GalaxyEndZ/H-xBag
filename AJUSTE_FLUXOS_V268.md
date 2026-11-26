# HäxBag V268 — Correção do layout dos Fluxos

## O que mudou

- A árvore dos Fluxos do Kisatsutai agora ocupa **toda a largura** do painel, sem dividir espaço com um campo de anotações.
- O campo “Anotações adicionais e Fluxos legados (não apagar)” não é mais exibido para personagens Kisatsutai. **O conteúdo antigo não é excluído:** `sheet_data.flows.details` permanece salvo, mas não aparece na interface.
- A árvore é fluida em telas largas, sem largura mínima fixa de 1000 px.
- Em áreas estreitas, os 20 nós são organizados em cartões por graduação, sem rolagem horizontal.
- O inspetor de habilidades aparece abaixo da árvore, salvo quando há espaço suficiente para ficar ao lado.
- Regras, efeitos e seleções de Fluxos da V267 foram mantidos.

## Instalação

1. Faça backup do projeto.
2. Extraia **HaxBag_Correcao_Arvore_Fluxos_V268.zip** dentro da pasta `haxbag/` (onde está `package.json`). Substitua os arquivos.
3. Reinicie `npm run dev`. Se desejar, execute `npm run build` para validar em Windows.

Não é necessário SQL; dados existentes não são apagados.

## Validação

TypeScript `tsc -b`: sem erros. A compilação do Vite não foi concluída neste ambiente Linux por ausência das dependências nativas do Rolldown para Linux.
