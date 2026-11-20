# HäxBag V211 — Portal de Entrada refinado

Base: **V210**. Esta atualização altera somente a interface de autenticação.

## Melhorias

- Portal visual com halos, marcas arcanas, partículas delicadas e emblema oficial, sem imagens externas adicionais.
- Área de apresentação revisada, com melhor contraste, recursos em destaque e acabamento ornamental.
- Formulários de Entrar/Criar conta/Recuperar com hierarquia visual, transições suaves e ícones vetoriais locais nos campos.
- Aviso de Caps Lock durante a digitação da senha, confirmação visual de senha e feedback de carregamento no botão.
- Ajustes em tamanhos de campo, estados de foco, espaçamentos, contrastes e telas pequenas.
- Animações reduzidas automaticamente quando o navegador solicita movimento reduzido.

## Instalação (correção)

1. Extraia a **correção V211** diretamente na pasta raiz do projeto HäxBag, mantendo a estrutura `src/`.
2. Substitua `src/Auth.tsx` e `src/Auth.css`.
3. Não sobrescreva as pastas `.git`, `node_modules` nem o arquivo `.env`.
4. Com as dependências instaladas, execute `npm run build` e teste login, cadastro, convite e recuperação de senha no navegador.

**Sem SQL novo.** O cadastro, o login e a recuperação continuam utilizando as mesmas chamadas Supabase da V210.

## Validação realizada

- 56 arquivos TS/TSX analisados sintaticamente (sem erros de sintaxe).
- 59 arquivos CSS com chaves balanceadas; `Auth.css` passou na análise do parser CSS.
- ZIPs verificados quanto à integridade.

**Limitação:** o build completo não foi executado neste ambiente; faltam dependências do projeto no cache local. Execute `npm run build` no seu computador antes de publicar.
