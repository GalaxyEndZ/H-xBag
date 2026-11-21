# HäxBag V220 — Correção de interface e intensidade das condições

## Correção de erro de execução ao abrir fichas
- A leitura de `group` nas informações de graduação passa a tolerar graduações indisponíveis durante o carregamento inicial, evitando a exceção `Cannot read properties of undefined (reading 'group')`.
- O painel de descanso e os testes de recuperação lidam com grupos temporariamente indisponíveis sem interromper a renderização.
- O editor de kits e a validação das perícias toleram um agrupamento desconhecido, exibindo opções vazias/erro de validação em vez de travar a página.

## Condições por natureza
| Natureza | Nível 1 (normal) | Nível 2 (grave) | Nível 3 (critica) | Nome do campo |
|---|---|---|---|---|
| Ruim | Normal | Grave | Crítica | Gravidade |
| Boa | Leve | Potente | Excepcional | Potência |
| Neutra | Leve | Moderada | Intensa | Intensidade |

- O mestre visualiza e edita com nomes adequados à natureza; filtros e bibliotecas usam os mesmos nomes.
- O radar de condições críticas continua contando apenas condições *ruins* classificadas com o nível interno `critica`.
- Os IDs persistidos `normal`, `grave` e `critica` NÃO mudam; não há SQL/migração e nenhum efeito é alterado automaticamente.

## Instalação
Extraia o ZIP de correção na raiz do projeto V219, substituindo os arquivos de mesmo nome. Faça backup antes de alterar o projeto. Depois, execute `npm run build` na sua máquina e publique os arquivos gerados normalmente. Uma atualização de página com Ctrl+F5 ajuda a carregar o novo JavaScript.

## Validação
- `tsc -b --force` com TypeScript global 5.8.3: sem erros.
- CSS analisado sintaticamente e ZIPs verificados.
- Build Vite não realizado neste ambiente por falta do pacote binário nativo Linux `@rolldown/binding-linux-x64-gnu` nas dependências do Windows.
