# HäxBag V269 — Árvore de Fluxos aprimorada

Atualização visual da seção **4. Fluxos** do Kisatsutai, baseada na V268.

## O que foi alterado
- Progressão visual **Raposa → Tigre → Dragão → Corvo**, da esquerda para a direita.
- Cinco opções de atributo em cada graduação; 20 Fluxos permanecem acessíveis.
- Cartões maiores, nomes legíveis, estados disponíveis/aprendidos/bloqueados distintos.
- Conexões curvas destacam as escolhas realmente registradas; um traçado pontilhado antecipa uma possível escolha ao selecioná-la.
- Etapas navegáveis por botões e painel de detalhes horizontal, evitando o espaço desperdiçado na ficha.
- Em tablets e celulares, os Fluxos se reorganizam em cartões por graduação, sem rolagem horizontal.
- O campo antigo de anotações continua oculto; os dados legados permanecem intocados.

## Instalação
1. Copie os arquivos do ZIP **de atualização** para a pasta raiz do projeto `haxbag`, substituindo os arquivos com o mesmo caminho em `src/components/`.
2. Reinicie `npm run dev`.
3. Não é necessária migração SQL.

## Compatibilidade e preservação
- Utiliza a API `KisatsutaiFlows` e os dados `flows.selections` já existentes na V268.
- Não modifica o catálogo dos Fluxos, os valores de atributos ou as regras de graduação.
- As anotações legadas continuam armazenadas em `flows.details` sem serem exibidas.
- A prévia HTML é uma demonstração local e não grava escolhas em fichas reais.

## Verificação
TypeScript validado com `tsc -b` (TypeScript 5.8 do ambiente). Prévia visual e interação verificadas em Chromium. O bundle final do Vite não foi executado neste ambiente.
