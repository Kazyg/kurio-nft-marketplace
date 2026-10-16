# Fase 5B — acessibilidade

## Método e evidências

Inspecionados README, arquitetura em `docs/architecture.md`, verificações das Fases 2–4, relatório visual 5A, componentes e testes existentes. A árvore inicial do Git contém o projeto como arquivos não rastreados; nenhuma limpeza, commit ou alteração de domínio foi realizada nesta auditoria.

Ferramentas: Chromium do Playwright 1.64.1 e `@axe-core/playwright` / axe-core 4.14.0. Os testes usam as regras etiquetadas WCAG 2 A/AA, WCAG 2.1 A/AA e WCAG 2.2 AA. Não há exclusões de elementos ou regras para esconder falhas. JSON completo de cada execução axe é anexado ao resultado Playwright.

`tests/accessibility-phase5b.spec.ts` acrescenta 32 cenários: Home, detalhes, carrinho vazio, login/cadastro, perfil, carteiras, lista de interesse, atividade e checkout em 390/1440 px; confirmação alcançada pela compra real na interface; erros de formulário e catálogo; loading e movimento reduzido; favorito já selecionado; teclado, foco e reflow. Autenticação, carrinho e pedido passam pelas APIs MSW existentes. A página de confirmação usa consentimento e revisão; não há fabricação de sucesso no componente.

O reflow é testado em 720 × 450 CSS px, equivalente ao espaço disponível de uma janela 1440 × 900 ampliada a 200%. Isso verifica composição e ausência de overflow; não é apresentado como teste manual do zoom do navegador ou de uma tecnologia assistiva real.

## Problemas encontrados e correções

| Problema                                                                                                                                                     | Correção                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CTA em link herdava a cor clara, apesar da classe do botão definir texto escuro; contraste 2,49:1 no carrinho vazio.                                         | Aplicada a variável `--primary-foreground` aos links que usam essa classe. Mantidos fundo, dimensões e composição.                                                                |
| Erros da revisão usavam vermelho escuro `#a42525` sobre fundo escuro.                                                                                        | Reutilizadas as cores de erro claras já existentes na aplicação para texto e borda.                                                                                               |
| `aria-label` em elementos genéricos sem papel: exploração da navegação mobile e avatar vazio.                                                                | Imagens decorativas compostas recebem `role="img"` e mantêm nomes apropriados.                                                                                                    |
| Bolinhas da galeria tinham área clicável de 7 × 7 px; paginação de relacionados tinha largura de 20 px.                                                      | Áreas de interação de pelo menos 24 × 24 px; bolinha continua com 7 px em pseudo-elemento. Teste verifica hit testing e seleção dos cinco alvos, sem cobertura pelo painel.       |
| O nome do carrinho colocava a quantidade entre parênteses; comparação WCAG 2.5.3 do axe desconsidera esses trechos e acusava ausência da quantidade visível. | Nome acessível informa explicitamente `Carrinho, N itens`. Badge visual e navegação permanecem iguais.                                                                            |
| Favorito com texto visível “Favoritar” mudava seu nome acessível para “Remover…”.                                                                            | Toggle mantém nome “Favoritar [NFT]”; `aria-pressed` comunica seleção. As verificações anteriores passaram a verificar esse estado explicitamente, preservando as checagens REST. |
| Abas de detalhes sem relacionamento com painel e sem navegação por setas; formulário de autenticação não era um painel nomeado.                              | IDs, `aria-controls`, `aria-labelledby`, painel e tabulação móvel única. Setas/Home/End selecionam e focam a aba de detalhes; autenticação preserva seu comportamento existente.  |
| Link de pular conteúdo não tinha alvo programaticamente focável.                                                                                             | `main` recebe `tabIndex=-1`; primeiro Tab + Enter leva o foco ao conteúdo.                                                                                                        |
| Wrapper de diálogo não restaurava foco por padrão quando aberto sem `Dialog.Trigger`.                                                                        | Captura e restauração do elemento anterior, mantendo precedência dos callbacks específicos existentes. Radix continua responsável pelo trap, Escape e scroll lock.                |
| Campos ENS e observação tinham erro visual sem descrição associada; formulários de carteira simultâneos podiam reutilizar IDs.                               | `aria-describedby` e IDs gerados por instância de carteira. Validações e mensagens originais preservadas.                                                                         |
| Foco dependia de estilos pontuais e padrão do navegador.                                                                                                     | Outline global visível com token de foco, incluindo textarea, summary e painéis focáveis. Controles com tratamento próprio mantêm seus estilos.                                   |
| Skeletons tinham somente rótulo e busy.                                                                                                                      | Status e texto oculto de carregamento; movimento reduzido continua desativando shimmer, transições e smooth scroll pelo media query existente.                                    |

Também foram adicionadas dimensões intrínsecas às imagens locais de estrelas, busca, carrinho, entrada e compartilhamento. Imagens NFT de detalhes, miniaturas, carrinho e resumo de pedido usam o helper responsivo da frente de performance, preservando alternativas textuais e dados originais.

## Validação e limites

Uma primeira rodada dos 30 testes passou em 29 cenários. O caso de erro falhou por autoria do cenário: uma consulta antiga ainda ativa consumiu uma das duas falhas programadas, fazendo o retry da nova consulta retornar sucesso. O trace mostrou 503 na consulta anterior, 503 na nova e 200 no retry. O teste foi isolado na rota de diagnóstico antes de programar falhas; nenhuma assertion de erro ou regra da aplicação foi relaxada. Dois casos adicionais cobrem favorito ativo e hit testing da galeria mobile.

Os 32 cenários passaram em desenvolvimento e no preview de produção, incluindo a execução serial final. A primeira rodada de preview com quatro workers teve uma falha de download do JavaScript inicial no beforeEach, antes da validação de cadastro; o mesmo caso passou nas rodadas seguintes, sem alteração de código ou assertion. Os relatórios dessa ocorrência permanecem preservados. Typecheck, lint e verificação de formatação passaram após a integração. A execução geral e as medianas Lighthouse estão consolidadas em `docs/phase-5b-verification.md`.

Verificações automáticas não certificam conformidade integral WCAG nem substituem uso com NVDA/VoiceOver ou revisão humana de todas as alternativas textuais. Contratos REST, precisão financeira, IndexedDB, sessão, estoque, idempotência e protocolo Socket.IO não foram alterados por esta frente.

## Arquivos envolvidos

- `src/index.css`; `src/shared/ui/dialog.tsx`, `favorite-button.tsx`, `network-feedback.tsx`, `star-rating.tsx`.
- `src/shared/layout/marketplace-layout.tsx`, `header-search.tsx`.
- `src/features/auth/auth-page.tsx`, `profile/profile-page.tsx`, `wallets/wallets-page.tsx`.
- `src/features/nft-details/nft-details-page.tsx`, `share-nft.tsx`.
- `src/features/cart/cart-page.tsx`, `cart.css`; `checkout/checkout-page.tsx`, `checkout.css`; `orders/orders-page.tsx`.
- Novo `tests/accessibility-phase5b.spec.ts`; seletores de nome/estado em testes existentes de catálogo, autenticação, privacidade, detalhes, sessão, Home e jornada de compra.
