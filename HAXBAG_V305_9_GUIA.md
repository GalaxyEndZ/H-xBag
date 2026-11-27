# HäxBag V305.9 — Enciclopédia com imagens

## O que mudou

A Enciclopédia continua vinculada à campanha e preserva os artigos, categorias,
texto, revisão e visibilidade existentes. Agora cada artigo aceita uma **capa e uma
galeria de até 12 imagens**; a primeira imagem enviada torna-se a capa. As imagens
aparecem em miniatura na biblioteca, em destaque dentro do artigo e podem ser
ampliadas. Mestres podem enviar/remover imagens e escolher outra capa.

Formatos: PNG, JPEG e WebP. Limite: 5 MB por arquivo. O upload acontece ao salvar
o artigo, como no Bestiário. Se o envio falhar depois de salvar o texto, o artigo
permanece salvo e a interface informa as imagens que não foram enviadas.

## Migração obrigatória

1. Execute o SQL **HAXBAG_V3059_ENCICLOPEDIA_IMAGENS.sql** no Supabase SQL Editor,
   depois da migração V304. Faça backup e teste em homologação primeiro.
2. O SQL cria uma tabela vinculada aos artigos e um bucket privado de imagens,
   com políticas RLS para membros e mestres, além de limites no Storage e banco.
3. **Não** crie o bucket como público. Arquivos são exibidos através de URLs
   temporárias após a validação da permissão de leitura.
4. Nenhuma alteração nos artigos já cadastrados é exigida.

## Testes recomendados

- Mestre cria artigo com PNG, JPG e WebP: a capa aparece na lista e no artigo.
- Mestre acrescenta fotos, troca a capa, exclui uma imagem e amplia a foto.
- Teste exceder 5 MB e 12 imagens: o app deve rejeitar o envio.
- Jogador da campanha acessa imagens de artigo compartilhado, sem botões de edição.
- Artigo marcado "Somente mestres" não fica visível para jogador comum,
  inclusive em acesso direto ao arquivo privado.
- Confirme que uma conta de outra campanha não consegue consultar nem assinar
  arquivos da Enciclopédia.
- Confira a navegação de Enciclopédia no navegador e no Electron.

**Nota:** o histórico de revisões V304 registra versões do **texto** do artigo;
alterações da galeria são controladas separadamente e não restauradas ao voltar
para uma revisão textual.

## Build e publicação

Execute `npm ci` e `npm run build` no Windows antes de publicar a tag `v0.305.9`.
A validação local deste pacote não substitui a execução da migração no Supabase
nem o teste de uploads entre contas reais.
