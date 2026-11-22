# HäxBag — ajustes de kits equipáveis e solicitações de comunidades

## Kits equipáveis — uma única alternativa por item

- **Simples, 1 kg:** Saco de dormir (Descanso Precário) **ou** duas perícias extras (+10/+10).
- **Padrão, 2 kg:** Futon (Descanso Mediano) **ou** duas perícias de arquétipo (+15/+10) com uma funcionalidade única **ou** duas funcionalidades únicas.
- **Raro, 4,5 kg:** Barraca (Descanso Completo) **ou** três perícias (+15/+15/+10, sendo três de arquétipo ou duas de arquétipo mais uma extra) com duas funcionalidades únicas **ou** três funcionalidades únicas.

As funcionalidades do kit Padrão incluem dano extra, proteção, Classe de Armadura, perícia principal e remoção de condições. O Raro também permite Constituição, PV, PR, ações complexas e dados de iniciativa. O mestre define os valores e observações necessários. A retirada de condições segue **controle manual do mestre**.

O editor de inventário, as lojas e o Baú do Mestre compartilham as mesmas opções. Itens recém-salvos gravam a versão de regras nos metadados; kits antigos conservam suas configurações legadas. Os bônus fixos de perícia e os valores de perícia principal configurados são aplicados somente com o kit equipado. Outras funcionalidades ficam registradas na descrição do item, com valores informados pelo mestre, e não disparam decisões narrativas automaticamente.

## Erro nas comunidades

A mensagem `record "new" has no field "event_id"` vem de um gatilho que tentava ler o campo de um evento ao processar uma solicitação de entrada em comunidade. O arquivo `HAXBAG_CORRECAO_SOLICITACOES_COMUNIDADES.sql` corrige o gatilho e preserva as notificações de curtidas, pedidos de entrada e inscrições em eventos.

### Instalação

1. Faça um backup do código e do banco.
2. Aplique o SQL no editor do banco **depois** da migração de Social que criou a função `hax_v231_notice`.
3. Extraia o ZIP de atualização na raiz do projeto, preservando o diretório `src/`.
4. Execute `npm run build` e publique a atualização.
5. Confira a criação de cada uma das opções de kit, o uso do descanso por itens equipados e o pedido de entrada em comunidade privada.

**Verificações locais:** TypeScript com `tsc -b` concluído sem erros; testes isolados das dez combinações de kits concluídos. O build final pelo Vite e a execução do SQL em banco real não foram concluídos neste ambiente; devem ser confirmados antes da publicação.
