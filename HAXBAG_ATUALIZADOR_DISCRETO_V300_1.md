# HäxBag V300.1 — Atualizações discretas

## Mudança na interface Desktop

- Removido o cartão de atualização fixo que aparecia no canto inferior direito sobre o chat.
- Removida a janela modal exibida pelo Electron após completar o download.
- Adicionado um ícone discreto de atualização na barra superior, ao lado das ações de conta.
- Esse ícone só exibe uma pequena marca quando há atualização pronta ou um erro.
- O painel de diagnóstico e os comandos **Verificar agora** e **Reiniciar e instalar** só aparecem após clicar no ícone.
- Não há abertura automática do painel quando o status muda.

## Funcionamento automático

O processo principal segue usando `electron-updater` com `autoDownload = true` e `autoInstallOnAppQuit = true`. Verifica atualizações periodicamente; se houver nova release válida, baixa os arquivos sem abrir diálogos. Depois do download, **não força o fechamento do programa**. O instalador do Windows deve aplicar a atualização quando o programa for encerrado normalmente.

O recurso requer a edição Windows **Setup/NSIS** instalada, uma release pública completa (`latest.yml` + instalador) e conexão com a internet. O modo portátil e o modo de desenvolvimento não recebem atualização automática.

O Windows e o instalador ainda podem exibir suas próprias mensagens de segurança ou confirmação. A alteração evita interrupções **dentro do aplicativo**; não desativa as verificações de integridade do `electron-updater`.

## Testes realizados

- Testes do atualizador (`npm run test:updater`).
- Verificação de versão (`HAXBAG_TAG=v0.300.1 node desktop/verify-release-version.cjs`).
- Sintaxe de `desktop/auto-update.cjs`, `src/App.tsx` e `src/components/DesktopUpdateCenter.tsx`.
- Compilação completa com dependências: ainda deve ser executada no CI do GitHub Actions/Windows.

## Publicação

1. Envie os arquivos de V300.1 para a **raiz do repositório de código-fonte**.
2. Confirme `node -p "require('./package.json').version"` → `0.300.1`.
3. Faça `git add .`, commit e `git push origin main` (ou sua branch padrão).
4. Crie uma **nova tag** `v0.300.1`, apontando para o commit atualizado.
5. `git push origin v0.300.1`.
6. Aguarde o workflow publicar os arquivos `latest.yml` e `HaxBag-Setup-0.300.1-x64.exe` no repositório de releases.

A versão anterior instalada precisa receber esta atualização antes que a experiência silenciosa passe a valer.
