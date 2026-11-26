# HäxBag V280 — Comunidades e Ações de Combate

A V280 inclui o acabamento visual das Ações de Combate da V279 e estas correções nos comentários do Social/Comunidades:

- Mostra o @username real também em comentários escritos com a própria conta.
- Em comentários feitos como personagem, mostra o personagem e indica qual conta real publicou.
- O @username leva ao perfil da conta responsável.
- O autor pode editar texto de comentários próprios, incluindo os feitos como personagens.
- Edição mantém autor, personagem e comentário-pai; exibe marca `Editado` com data/hora.
- Limite de 1600 caracteres; Cancelar e Salvar com tratamento de erros.
- A verificação de autoria acontece no backend por RLS e gatilho, não só na interface.

## Instalação

1. Extraia a atualização na raiz do projeto HäxBag.
2. Execute `HAXBAG_COMENTARIOS_COMUNIDADES_V280.sql` no Supabase SQL Editor (necessário para salvar edições).
3. Rode `npm run dev` no Windows e teste um comentário próprio feito como personagem.

A migração não apaga comentários e não muda permissões de leitura de comunidades privadas.
