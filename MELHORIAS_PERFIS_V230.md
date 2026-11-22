# HäxBag V230 — Perfis mais completos

## O que mudou
- Perfil público: capa sem linhas e elementos artificiais sobre imagens pessoais; texto de apresentação resumido no cabeçalho, controles sociais mais organizados e indicadores que abrem diretamente os respectivos conteúdos.
- Perfil público: novo quadro de apresentação antes das publicações, vitrine de insígnias e crônicas, resumo de conquistas e melhor adaptação a telas estreitas.
- Perfil público: botão para copiar o @usuário com mensagem de confirmação; navegação por abas com setas esquerda/direita, Home e End.
- Privacidade: a seção da Carta de Identidade agora só aparece quando `identity_card_visible` e `privacy.show_identity_card` permitem; a prévia pública respeita esta configuração.
- Ateliê (Identidade & Legado): prévia pública mais fácil de acessar, indicadores da preparação da vitrine e atalhos para foto, capa, personagens em destaque e crônicas.
- Nenhuma alteração no esquema do banco e nenhuma modificação em dados salvos.

## Como instalar
- No ZIP de correção: extraia na pasta **raiz do projeto** para que os caminhos `src/components/...` sejam preservados, substituindo os arquivos correspondentes.
- No ZIP completo: a pasta `haxbag` contém o código da V230.
- Execute `npm install` (se necessário) e `npm run build`, depois recarregue o site com Ctrl+F5.

## Arquivos alterados
- `src/components/PublicAdventurerProfile.tsx`
- `src/components/PublicProfileV230.css` (novo)
- `src/components/ProfileLegacy.tsx`
- `src/components/ProfileLegacyV230.css` (novo)

## Validação
- TSX: parse/transpilação com TypeScript, sem erros de sintaxe.
- CSS: analisado com tinycss2, sem erros.
- Build completo não pôde ser executado neste ambiente: tentativa de instalar dependências bloqueada pela ausência de pacotes em cache e falha de npm. Execute `npm run build` na sua instalação.
