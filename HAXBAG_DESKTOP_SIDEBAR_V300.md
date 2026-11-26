# HäxBag Desktop V300.0 — navegação contextual e Comunicação

Esta revisão se aplica somente ao aplicativo Electron para Windows. A versão web, mecânicas de RPG, dados de campanhas, permissões, chamadas de voz, Supabase e atualização automática usam as mesmas implementações da V299.1.

## O que mudou

- A navegação global da Comunicação começa em modo compacto (76 px): quatro espaços principais, logo e perfil clicável.
- O botão com o desenho de um painel, no início da barra superior, alterna entre **Expandir menu lateral** e **Recolher menu lateral**. A escolha é persistida no armazenamento local (`haxbag-desktop-sidebar-v300`), sem sincronização entre contas.
- Nas outras seções, o menu permanece expandido por padrão, com as opções de RPG, Social e Arcade acessíveis. É possível recolher o menu manualmente em qualquer área.
- A barra de busca global continua no topo, sem cópia na navegação lateral.
- Na Comunicação, os servidores, os canais e as mensagens têm mais largura útil; a área de canais mantém as ações originais.
- A página não repete o cartão de perfil dentro da lista de canais, já que o perfil global segue acessível na lateral.
- O painel de membros fica sobre a conversa quando aberto e não reserva coluna de leitura.
- A versão web mantém integralmente sua barra lateral anterior. Em janelas com até 800 px de largura, o drawer móvel continua responsável pela navegação.

## Publicação

A versão declarada em `package.json` e `package-lock.json` é `0.300.0`. Envie **todos os arquivos** do projeto ao repositório de código e verifique antes de criar a tag:

```powershell
node -p "require('./package.json').version"
git add .
git commit -m "HaxBag Desktop V300 - navegacao contextual"
git push origin HEAD
git show HEAD:package.json | Select-String '"version"'
git tag v0.300.0
git push origin v0.300.0
```

Na release pública, confirme `latest.yml` e o instalador `HaxBag-Setup-0.300.0-x64.exe`. Não envie `dist` nem `node_modules` para o repositório se já forem ignorados.

## Limites da validação

A estrutura TSX foi analisada sintaticamente com o compilador TypeScript; o CSS, com o parser PostCSS; os quatro testes do atualizador e a verificação de versão passaram. A compilação completa depende das dependências npm, que não puderam ser instaladas neste ambiente por tempo limite. É recomendado verificar visualmente a V300 no Electron antes de publicar a release.
