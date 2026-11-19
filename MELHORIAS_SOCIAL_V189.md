# HäxBag V189 — Social mais fluido

Esta versão parte da V188 e mantém Minigames/Pong, ranking global, histórico de navegação, RPG e as migrações anteriores.

## Mudanças

- Redesenho responsivo do Social: navegação, atalhos, editor de posts, cartões, pessoas e mensagens com maior consistência visual e respeito aos temas existentes.
- Feed com a opção **Mais interações**: ordena localmente as publicações já carregadas pela soma de curtidas e comentários, com desempate pela data. Essa seleção não consulta ou ordena o feed inteiro no servidor.
- Publicações com mais de 420 caracteres exibem um trecho inicial e os controles **Ler publicação completa** / **Mostrar menos**, sem alterar seu texto original.
- Mensagens privadas: pesquisa do texto dentro das **últimas mensagens carregadas** da conversa atual; contador de resultados e botão Limpar. A busca não examina mensagens mais antigas que ainda não foram carregadas.
- Mensagens privadas: botão **Copiar** disponível para mensagens de texto não apagadas; informa **Copiado** quando a cópia funciona.
- Ajustes de espaçamento, estados hover/foco, cartões e layout mobile.

## Instalação

1. Substituir os arquivos do projeto pelos desta versão, preservando o `.env`.
2. Instalar as dependências quando necessário: `npm install`.
3. Validar a compilação: `npm run build`.

Não é necessário SQL novo para a V189. As migrações das versões anteriores continuam sendo necessárias conforme os recursos ativados.

## Validação realizada

- 46 arquivos TypeScript/TSX passaram na análise de sintaxe com TypeScript.
- Os arquivos CSS passaram na análise sintática do PostCSS.
- A instalação das dependências no ambiente de edição não foi possível em modo offline (cache do npm incompleto); por isso, a compilação completa do projeto não foi confirmada.
