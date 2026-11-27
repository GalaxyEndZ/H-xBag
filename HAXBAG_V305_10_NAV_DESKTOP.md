# HäxBag V305.10 — Social e RPG com navegação consistente

- Redesenho das duas barras contextuais no Electron; web e telas pequenas não mudam.
- Largura-padrão de navegação 320 px, com redimensionamento entre 300 e 380 px. Preferências maiores que 308 px são preservadas.
- Banner de temporada com nome legível e ícone proporcional.
- Itens longos do RPG quebram linha sem ocultar o texto; contadores e marcas de mestre permanecem visíveis.
- Social com grupos e itens mais uniformes; seleção ativa e foco por teclado reforçados.
- Rail de atalhos de ambas as áreas com botões do mesmo tamanho.
- Rodapé do perfil preservado e com nome/e-mail ajustados.
- Sem SQL novo.

## Verificação recomendada

1. `npm ci` e `npm run build` no Windows.
2. Abrir Social e RPG com tema Vale dos Corvos e Silvam Argentea.
3. Verificar atalhos, grupos recolhíveis, perfil no rodapé, barra de rolagem e rótulos compridos.
4. Testar redimensionamento com mouse e teclado, janelas de 900 a 1440 px e menu compacto.
5. Só publicar a tag depois de o build e os testes de interface passarem.
