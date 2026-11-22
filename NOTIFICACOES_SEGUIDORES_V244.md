# Novos seguidores — atualização de notificações

## O que muda
- Sempre que alguém começar a seguir um perfil, um aviso é criado no servidor.
- O aviso apresenta o @ do novo seguidor e um botão para abrir seu perfil.
- Os avisos aparecem em **Social → Notificações** e entram no contador do sino do site.
- Configurações de notificações, usuários silenciados e bloqueios são respeitados.
- Deixar de seguir não gera aviso; deixar de seguir e seguir novamente várias vezes não causa spam (janela de 24 horas).

## Instalação
1. Faça backup do projeto e do banco.
2. Aplique o SQL `HAXBAG_NOTIFICACOES_SEGUIDORES_V244.sql` como proprietário do banco **após** a criação das tabelas do Social.
3. Substitua `src/App.tsx`, `src/components/SocialV231Suite.tsx` e `src/components/SocialV231Suite.css`.
4. Execute `npm run build` e publique.

## Validação manual
- Com duas contas de teste não bloqueadas, uma segue a outra: aparece um único aviso na conta seguida.
- O @ e o link abrem o perfil da conta que seguiu.
- Marcar lida reduz o contador do sino.
- Desativar notificações, silenciar ou bloquear impede novas notificações.
- Repetir seguir/deixar de seguir em menos de 24h não duplica o aviso.

Não gera notificações retroativas para seguidores anteriores à instalação. O sino atualiza ao entrar, ao ser aberto e a cada 60 segundos; a Central de Notificações atualiza ao ser aberta.
