# HäxBag V265 · Social mais ágil

## O que mudou

- **Navegação rápida** dentro da aba Social, acessível por **Ctrl+K** (ou ⌘K no macOS) e pelo botão **Ir para…**. Pesquisa por nome da página e descrição, com setas e Enter; permite fechar com Escape ou clique fora.
- Os destinos são derivados dos menus React disponíveis para a conta; o painel administrativo **não** aparece para contas sem autorização verificada.
- Novos estilos do navegador de páginas, com cores da temporada, layout mobile e foco acessível.
- Link de salto por teclado para o título da página; foco adequado após seleção e respeito à preferência de movimento reduzido.
- Na busca de usuários, o estado de carregamento começa com o debounce, evitando exibir a mensagem “Nenhum perfil encontrado” antes do retorno.
- Perfil lateral mais compacto no mobile, mantendo todos os menus e ações.

## Arquivos alterados

- `src/components/FriendsPanel.tsx` (integração, navegação, acessibilidade e busca)
- `src/components/SocialNavigatorV265.tsx` (novo componente)
- `src/components/SocialNavigatorV265.css` (estilos da nova interface)

## Como atualizar

1. Faça cópia de segurança do seu projeto.
2. Extraia o arquivo **HaxBag_Atualizacao_Social_V265.zip** na raiz do seu projeto, preservando o caminho `src/components`. Confirme a substituição de `FriendsPanel.tsx`.
3. Execute `npm install` se ainda não tiver as dependências e, em seguida, `npm run build` na sua máquina.
4. Publique o novo `dist` e faça atualização forçada do navegador (`Ctrl + F5`).

O arquivo **HaxBag_Social_V265_Completo.zip** já contém o código-fonte integral e a nova navegação; não inclui `node_modules`, `dist` ou configurações secretas `.env.local`.

## Compatibilidade e testes

- Verificação `tsc -b` concluída sem erros de TypeScript.
- Os módulos nativos do Vite existentes no projeto original são pacotes para Windows; por isso, a geração do bundle Vite não foi reproduzida neste ambiente Linux. O build final deve ser executado na máquina de destino.
- Nenhum ajuste SQL ou nova tabela foi adicionado.
- A prévia HTML é ilustrativa: mostra o novo modal em funcionamento com dados de exemplo, sem acessar Supabase.
- Recomenda-se testar no navegador o fluxo completo de publicação, mensagens e permissões administrativas após instalar, além das larguras 360px, 768px e desktop.
