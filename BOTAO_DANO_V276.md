# HäxBag V276 — Botão para abrir a seção Dano

## Alterações

- Botão **Dano** logo abaixo de **Reações**: abre/fecha a seção de rolagem sem navegar para outra página.
- Seção recolhida por padrão para reduzir o espaço ocupado pela ficha.
- O botão **Dano** da navegação rápida abre a mesma seção, ao invés de tentar rolar até conteúdo oculto.
- O atalho **Abrir seção Dano** do painel de críticos também expande a seção.
- A seleção Dano puro / Forma de Respiração, rolagem de dano causado, custo manual e consumo automático de PR permanecem inalterados.
- A seção não aplica dano recebido, não reduz PV/PS e não oferece ataques de sanidade aos jogadores.
- O estado da rolagem é mantido ao fechar e reabrir o painel, até trocar de personagem/inimigo.

## Instalação

Extraia este ZIP na pasta que contém a pasta `haxbag`, ou abra-o e copie o conteúdo da pasta `haxbag` para a raiz do seu projeto, substituindo os arquivos indicados. Não é necessário SQL.

## Validação

`tsc -b --pretty false`: passou. Build Vite: indisponível neste ambiente Linux com dependências nativas do Windows.
