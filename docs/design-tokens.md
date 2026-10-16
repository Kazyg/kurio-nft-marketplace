# Tokens do Figma

Fonte: [Frontend Challenge](https://www.figma.com/design/UoXFFcx1BAUTm4DFpXNAvE/?node-id=2-2), consultado diretamente pelo Figma MCP em 15/10/2026.

`get_metadata` identificou o frame `2:2` (Desktop / Início). `get_variable_defs` retornou as variáveis abaixo; `get_design_context` com screenshot do texto `3:127` confirmou fonte, peso e cor. Esta entrega usa os tokens em uma página técnica própria, sem implementar o layout do marketplace.

| Variável Figma            | Valor            | Token CSS                                       |
| ------------------------- | ---------------- | ----------------------------------------------- |
| color/ink                 | #140D0A          | --background, --primary-foreground              |
| color/foreground          | #F5F1EB          | --foreground                                    |
| color/surface-card        | #241612          | --card                                          |
| color/primary             | #D28A4C          | --primary                                       |
| color/secondary           | #B39463          | --secondary                                     |
| color/text-accent         | #E89B55          | --accent                                        |
| color/text-secondary      | #CFB28C          | --muted-foreground                              |
| color/text-primary        | #F7F3EC          | --text-primary                                  |
| color/surface-dark        | #38220F          | --muted                                         |
| color/border              | #3F2319          | --border, --input                               |
| color/border-soft         | #55321F          | --border-soft                                   |
| color/background-elevated | #FBFBFB          | --background-elevated                           |
| font/family               | Roboto Mono      | --font-mono                                     |
| Display/43 Bold           | 43px / 70px, 700 | --font-display-size, --font-display-line-height |
| Body/14 Regular           | 14px / 24px, 400 | --font-body-size, --font-body-line-height       |

A fonte é servida localmente por `@fontsource/roboto-mono`. O texto EXPLORAR (`3:127`) usa 16px/20px, peso 700, cor Ink. Raio de 6px, espaçamentos e layout da página de diagnóstico são decisões provisórias de infraestrutura, não tokens atribuídos ao Figma. Nenhuma URL temporária de asset é utilizada.
