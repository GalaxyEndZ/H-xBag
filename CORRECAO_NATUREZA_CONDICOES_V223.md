# HäxBag V223 — Natureza das condições corrigida

## Problema
Nas fichas, condições Boas ou Neutras eram exibidas como **Prejudiciais**.
O painel do mestre buscava `hax_list_condition_polarities` (natureza armazenada separadamente), mas os componentes de fichas e inimigos consultavam apenas `hax_list_condition_definitions`. Quando `polarity` vinha ausente, o código a transformava em Ruim.

## Correções
- Ficha do personagem: busca e combina as naturezas reais com as condições ativas.
- Ficha do inimigo: usa a mesma classificação correta.
- Biblioteca pública: consulta natureza separadamente e mantém o filtro compatível.
- Painel do mestre: centraliza a mesclagem e não interpreta ausência de dados como Ruim.
- Tratamento explícito para natureza ausente: exibe **Não informada** em vez de **Prejudicial**.
- Evita que uma condição sem natureza carregada seja editada e salva acidentalmente como Ruim.
- Não altera níveis, dados, efeitos, permissões ou registros no banco.

## Instalação
- **Projeto completo**: substitua a pasta pelo conteúdo do ZIP completo (preserve seu `.env` local).
- **Correção incremental**: extraia o ZIP de correção na raiz do projeto existente, mantendo as pastas `src/` e substituindo os dois arquivos.
- Depois, execute `npm run build` no ambiente do projeto e publique normalmente. Para recarregar a interface, use Ctrl+F5.
- Não é necessária migração SQL para a correção em projetos que já têm a RPC `hax_list_condition_polarities` funcionando.

## Validação
- Sintaxe TSX: aprovada no compilador TypeScript.
- Tipos das funções de mesclagem: aprovados com `tsc --strict`.
- Testes de lógica: cenários Boa, Neutra, Ruim, definição não retornada e natureza ausente aprovados.
- Build Vite do projeto inteiro não foi executado neste ambiente (dependências não instaladas).
