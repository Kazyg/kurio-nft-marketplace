# Carrinho: correção visual e acesso ao pagamento

## Figma e escopo

Conta confirmada por `whoami`: **[conta Figma atual; e-mail omitido na entrega pública]** (Gui), equipe Starter, assento View. A cópia `Hfp4aJDaHzzuDlneSaFbwD` foi acessada com sucesso; não ocorreu o erro de permissão da conta antiga.

Frames confirmados na cópia atual:

- `11:1278`: Desktop / Carrinho de NFTs — contexto completo e screenshot consultados.
- `16:360`: Mobile / Carrinho de NFTs — contexto completo e screenshot consultados; composição de 414px.
- `11:2862`: Desktop / Pagamento — nome, estrutura e dimensão 1440×1657 confirmados por metadata.
- `16:748`: Mobile / Pagamento — nome, estrutura e dimensão 414×896 confirmados por metadata.

Também foram consultadas as medidas do corpo desktop `70369:240`. Os contextos atuais estão em `reports/figma/cart-desktop-current.txt`, `cart-mobile-current.txt` e `cart-body-metadata.txt`. Não houve auditoria das demais telas, troca de tokens globais ou alteração visual do checkout.

## Auditoria e correções

| Divergência anterior                                                       | Correção                                                                                                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Faixa “SELEÇÃO DO COLECIONADOR / Meu carrinho / Revise…” ausente no design | Faixa removida; breadcrumb desktop e título mobile “Carrinho de NFTs” com voltar                                                                           |
| Padding interno extra e colunas arbitrárias                                | Área desktop de 1200px: tabela 782px, intervalo 86px e resumo 332px; reflow intermediário sem comprimir a tabela no mobile                                 |
| Colunas Obra / Quantidade / Disponibilidade                                | NFTs / Preço / Edições / Total / remoção, alinhadas entre cabeçalho e linhas                                                                               |
| Preços repetidos apenas no resumo                                          | Preço unitário e subtotal por linha vêm de `Quote.snapshot.lines`; nenhum cálculo por ponto flutuante no componente                                        |
| Linhas altas, imagem 76×84 e divisórias                                    | Linhas desktop de 70px, imagens 70×70, superfície card, intervalo de 12px e controles 20×30                                                                |
| Resumo em caixa com borda/padding e título divergente                      | “Resumo da carteira”, sem caixa externa no desktop, formulário de 40px, tipografia e separação conforme contexto                                           |
| Lixeira Lucide genérica                                                    | SVG Iconly/Curved/Delete original, exportado localmente                                                                                                    |
| Relacionados ausentes                                                      | Título/divisória, cinco cards desktop, imagens 255px de área, nomes/preços, três páginas desktop com 15 NFTs REST e indicadores interativos                |
| Mobile como tabela reorganizada                                            | Cabeçalho próprio, cards horizontais de 100px, imagem/edição/preço, controles compactos, resumo com cantos superiores de 40px, cupom de 50px e CTA de 60px |
| Estilo global de cards pares deslocava relacionados mobile                 | Override restrito ao carrossel, sem mudar a Home; testes verificam alinhamento e ausência de recorte dos preços                                            |
| CTA “Finalizar compra” e bloqueio genérico                                 | “Conectar e finalizar” e feedback específico para atualização, falha e expiração de cotação                                                                |

A disponibilidade continua acessível a leitores de tela; erros de estoque permanecem visíveis. A remoção está disponível em todos os itens mobile, mesmo que o frame a desenhe apenas em uma linha. O resumo mantém status de cotação e mensagens de erro necessários ao fluxo real. Valores, NFTs, edições e quantidades variam com o estado REST; não foram copiados os preços estáticos do Figma. A adaptação mobile dos relacionados usa duas colunas visíveis com rolagem horizontal, pois não há essa seção no frame mobile. Header e navegação inferior ficam ocultos somente no carrinho mobile, como na composição de referência; o header global desktop foi preservado. Rodapé existente foi preservado.

## Assets e arquivos

SVGs originais locais, sem URLs temporárias no runtime:

- `public/assets/figma/cart-delete.svg`: lixeira, raiz 17,6505×19,9838, dentro do slot de 24px.
- `cart-minus.svg` e `cart-plus.svg`: sinais desktop, slots de 16px.
- `cart-mobile-minus.svg`: controle mobile original de 24px.
- `cart-back-circle.svg` e `cart-back-arrow.svg`: voltar mobile; seta orientada como no contexto.

Imagens de NFT continuam dinâmicas, pelos assets locais já referenciados no catálogo REST.

Arquivos de aplicação alterados: `src/features/cart/cart-page.tsx`, `cart.css`, novo `cart-related.tsx`; `src/shared/ui/nft-card.tsx` (variante compacta sem favorito/badge/preço anterior, restrita ao carrinho); `src/shared/layout/marketplace-layout.tsx` (classe de rota para o estilo mobile).

Testes: novo `tests/cart-visual-checkout.spec.ts`; seletores do CTA/cupom atualizados em `tests/cart-phase3.spec.ts` e `purchase-journey-phase4.spec.ts`, sem remover asserts. Nenhuma alteração de contrato REST, IndexedDB, estoque, cálculo financeiro, sessão, guards, ciclo de pedido, idempotência, eventos Socket.IO ou reconciliação REST.

## Investigação do pagamento

A rota real é `/checkout`, registrada no TanStack Router com `beforeLoad: requireSession`. O carrinho utiliza Link para essa rota somente quando a cotação pertence ao carrinho e à versão atual, não expirou e não há atualização pendente ou erro. O guard consulta a sessão por REST; visitantes seguem para `/login?redirect=%2Fcheckout`. Após login, o fluxo existente mescla o carrinho e retoma `/checkout`. Conexão/seleção de carteira ocorre no checkout, não é pré-requisito para abrir a rota.

Foi reproduzida a navegação no navegador usando o botão Comprar do detalhe, a navegação ao carrinho, o CTA, login e a chegada à tela de pagamento. Também foi repetido com sessão ativa, sem erro de rota nem alerta. Os testes cobrem sessão expirada antes da navegação e retomada após autenticar novamente, sem perda de itens ou pedido criado ao simplesmente navegar.

Foi reproduzido um bloqueio legítimo por cotação vencida: antes o CTA ficava desabilitado com status genérico; agora aparece “Sua cotação expirou. Clique em Atualizar cotação para continuar ao pagamento.” Atualizar a cotação habilita o Link e permite seguir ao login/pagamento. O prazo padrão do mock é de cinco minutos. Cupom inválido, falha REST e alterações pendentes também bloqueiam legitimamente e recebem instruções.

**A causa exata da ocorrência original relatada pelo usuário não foi comprovada.** Não foi reproduzido erro de navegação no estado saudável e não há evidência para atribuir o relato a um guard defeituoso. A expiração é um impedimento reproduzido e agora explicado; não se afirma que tenha sido necessariamente o caso do usuário. Nenhuma validação foi removida para forçar o acesso. A cotação é obtida/revalidada por REST no checkout, mantendo as regras da Fase 4.

### Como testar manualmente

1. Executar `bun run dev`, ou `bun run build:demo` seguido de `bun run preview`. Build normal requer backend real ou `VITE_ENABLE_MSW=true` durante a compilação.
2. Abrir um NFT, escolher edição disponível e clicar em Comprar; abrir `/cart`.
3. Esperar a cotação atualizada. Se expirar, usar Atualizar cotação; remover/corrigir cupom inválido caso haja erro.
4. Clicar em Conectar e finalizar. Como visitante, entrar com `ana@kurio.demo` / `Kurio123!`, ou cadastrar uma conta. O destino automático é `/checkout`.
5. No pagamento, revisar dados, selecionar carteira/rede compatível, conectar a carteira simulada, clicar em Revisar compra, marcar “Revisei as edições, quantidades, valores e a compra simulada.” e confirmar. Se os dados mudarem, atualizar a revisão. Não existe pagamento blockchain real.

## Validação

| Comando                    | Resultado final                   |
| -------------------------- | --------------------------------- |
| `bun run typecheck`        | Aprovado                          |
| `bun run lint`             | Aprovado                          |
| `bun run format:check`     | Aprovado                          |
| `bun run build`            | Aprovado                          |
| `bun run build:demo`       | Aprovado                          |
| `bun run test:e2e:dev`     | **128/128**, 4,2 min, sem retries |
| `bun run test:e2e:preview` | **128/128**, 2,5 min, sem retries |

As duas suítes completas terminaram com código 0, sem falhas, mantendo os **118 cenários anteriores** e acrescentando dez. A cobertura inclui estrutura/medidas desktop, composição mobile, ausência da faixa indevida, relacionados com navegação/paginação, remoção pelo SVG, sessão ativa/visitante/expirada, cotação vencida e preservação de itens. Os cenários anteriores continuam verificando quantidades, estoque, cupons, carrinho vazio, falhas, idempotência, pedidos, HTTP/MSW e Socket.IO no navegador de desenvolvimento e no build de produção.

Os dez testes novos também passaram em uma rodada focada no preview. A primeira rodada focada manteve todos os testes anteriores de carrinho, checkout e jornada aprovados; três testes novos de captura falharam por preparação do visitante/espera de imagens lazy e foram corrigidos sem tolerância adicional ou remoção de asserts. O novo assert de geometria depois identificou o transform global de 32px nos cards pares mobile; a correção foi restrita aos relacionados do carrinho e revalidada antes das execuções completas.

As capturas em 390, 768 e 1440px estão em `test-results/cart-visual-checkout-*/cart-figma-*.png`, além das capturas anteriores de `cart-phase3`. Foram inspecionadas visualmente e as medidas estruturais são verificadas no navegador. Os resultados e traces do Playwright ficam nos diretórios habituais ignorados pelo Git.

## Limites

Sem novas dependências, deploy, Lighthouse ou auditoria de outras telas. A cobertura automatizada usa Chromium; não foi validado em dispositivos físicos ou Safari/Firefox. Pagamento e conexão de carteira continuam explicitamente simulados. O estado exato que impediu o acesso do usuário permanece não identificado; os bloqueios reproduzíveis e os percursos saudáveis estão cobertos.
