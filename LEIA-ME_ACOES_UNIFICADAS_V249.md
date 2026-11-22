# HäxBag — Feed unificado, ações padronizadas

## Atualização

1. Faça backup do código e do banco de dados.
2. Execute `HAXBAG_ACOES_UNIFICADAS_V249.sql` **após** as migrações já usadas no projeto (com Social, banimentos e republicações).
3. Copie os arquivos atualizados para o projeto, mantendo `src/components/`.
4. Execute `npm run build` e confira a atualização no navegador.

## O que mudou

As publicações comuns e as publicações especiais agora usam **o mesmo componente de ações**, no mesmo padrão visual:

- Curtir/descurtir;
- Comentar e responder;
- Salvar/remover de salvos;
- Republicar e citar com referência ao conteúdo original;
- Copiar o texto;
- Editar e fixar/desafixar (apenas autor);
- Excluir (autor ou moderação autorizada pela origem);
- Silenciar o autor e denunciar outras pessoas.

Fixações feitas pelo próprio usuário aparecem primeiro na linha do tempo unificada. As publicações continuam em suas tabelas originais; as relações de curtidas, os comentários e as fotos não são migrados.

## Regras e limitações

- Republicar/citar publicações clássicas é permitido apenas quando são **públicas**, não existe bloqueio entre as contas e o autor permite compartilhamentos.
- Postagens restritas a amigos, seguidores ou grupos não podem ser republicadas publicamente.
- Editar/fixar publicações clássicas requer a migração SQL. O backend verifica que a conta é a autora e que não está suspensa ou banida.
- Conteúdo original excluído fica indisponível nas citações, sem reproduzir cópias não autorizadas.
- As interfaces permanecem em uma única linha do tempo, mas comentários e curtidas continuam nos respectivos sistemas existentes.

## Validação

Verificações realizadas: sintaxe TSX com TypeScript, referências da barra de ações e integridade dos ZIPs. A compilação completa não pôde ser executada aqui porque as dependências do projeto não estão instaladas; execute `npm run build` no ambiente do projeto. A aplicação da migração em um banco real também precisa ser verificada.
