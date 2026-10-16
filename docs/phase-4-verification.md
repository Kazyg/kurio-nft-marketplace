# Verificação da Fase 4 — 15/10/2026

## Preparação e divisão de trabalho

Foram relidos README, contratos REST e verificações das Fases 2 e 3, além de inspecionados repositório, handlers, socket, Axios, hooks, sessão e Router antes das alterações. A criação idempotente e a matemática ETH existentes foram reaproveitadas. O agente A ficou com checkout/pedidos visuais e seus testes; B com contratos, repositório, handlers e testes do domínio; C com MSW/Socket.IO, reconciliação e testes de eventos. O coordenador ficou com rotas, APIs, hooks compartilhados, integração, validação e documentação. Os conjuntos de arquivos foram definidos antes da execução paralela.

## Funcionalidades

Checkout privado com perfil inicial, validação RHF/Zod, carteiras/rede compatíveis, conexão de carteira explicitamente simulada e estados conectado/recusado/desconectado. Cupons e resumo usam a API existente. A revisão solicita uma cotação; o envio final solicita outra e compara linhas, versões, quantidades, preços, desconto e taxas. Mudanças exigem nova aceitação. O domínio revalida validade, cupom, estoque, rede, versão do carrinho e snapshot, independentemente da interface.

Pedidos possuem página de listagem/detalhe e recibo a partir do snapshot persistido. Pendência e recusa têm feedback próprio. A confirmação visual depende de status confirmado informado pelo domínio. Referências e exploração de transações são identificadas como demonstração; não há blockchain, extensão ou gateway.

## Idempotência e recuperação

Cada tentativa persiste no cliente somente chave, payload e ID do pedido, separados por usuário. A mesma tentativa usa o mesmo payload e chave em retry/refresh. A API persiste a associação usuário/chave/payload/pedido sob Web Locks. Payload diferente com a mesma chave retorna 409. A consulta autenticada `GET /orders?idempotencyKey=...` recupera sem criar. Resultado desconhecido bloqueia nova compra até a tentativa ser recuperada ou receber uma resposta definitiva. Uma nova compra após resultado terminal exige ação explícita e uma nova chave.

## Máquina de estados e efeitos

O contrato mantém `pending`, `confirmed`, `declined` por compatibilidade; `declined` representa recusado. Somente `pending → confirmed` e `pending → declined` são permitidos. Estados terminais não mudam. `resolveAt` e `resolution` ficam persistidos, e a resolução é executada nas transações seguintes, inclusive pela leitura periódica do socket. Depois de fechar todas as páginas, a primeira operação REST após reabrir resolve prazos vencidos. Timers apenas acionam consultas; o resultado não depende de um timer sobrevivente.

Confirmação verifica todas as linhas antes de baixar estoque e subtrai somente quantidades compradas dos IDs originais do carrinho. Adições posteriores e linhas removidas/recriadas são preservadas. Uma repetição não reaplica efeitos. Pendência não consome estoque: se outra compra esgotar a edição antes da resolução, o pedido é recusado. Valores transportados permanecem strings ETH, com BigInt/wei nos cálculos do domínio. Snapshot financeiro, carteira, rede, colecionador e referência simulada ficam no pedido.

## Eventos e reconciliação

Mudanças confirmadas no repositório produzem uma outbox persistida limitada aos últimos 512 eventos. `nft.updated` inclui eventId, sequence, nftId, version, updatedAt e NFT/edições afetadas. `order.updated` inclui a mesma identidade/versionamento, orderId, userId e o pedido. O MSW lê a outbox e emite pelo binding existente; o cliente real Socket.IO recebe os frames. Não há chamada de mocks a React ou ao cache.

A subscription explícita contém token e subscriptionId. A sessão é verificada no repositório; pedidos só são emitidos para o proprietário. No cliente, sessão/subscription, identidade e versão são verificadas; versões iguais/antigas são descartadas. Structural sharing preserva versões mais novas e estados terminais contra respostas REST atrasadas. NFT atualiza/revalida catálogo, detalhe, carrinho e cotações. Pedido atualiza/revalida pedidos e recursos afetados.

Reconexão identifica a sessão via REST antes de assinar e revalida recursos ativos. Logout/troca de usuário remove listeners e fecha a conexão anterior. Polling REST de pedidos pendentes garante recuperação se um evento se perder. Nenhuma reconexão cria uma tentativa. O diagnóstico original continua usando o mesmo binding/heartbeat e sua configuração própria, sem alterar o protocolo.

## Contratos e cenários

`Order` recebeu snapshot de carteira, rede, colecionador, referência simulada e prazo/resultado de resolução. `CreateOrderInput` aceita colecionador e rede opcionais, preservando os clientes anteriores. `GET /orders?idempotencyKey=...` filtra tentativas do usuário atual. `PATCH /__mock/nfts/:id` altera preço/disponibilidade com versões e eventos. `POST /__mock/realtime` interrompe transporte ou reenvia eventos persistidos para verificar reconciliação.

Cenários: `confirmed`, `declined`, `pending` sem resolução automática (compatibilidade), `pending-confirmed`, `pending-declined`, `timeout-before-create`, `timeout-after-create` e `connection-error`. `orderResolutionMs` controla o prazo persistido, `expiredCoupons` invalida cupons, e latência/falhas/sessão/cotação continuam configuráveis. `responseDelays: [{path, method?, delayMs, remaining}]` captura a resposta dentro da transação e a atrasa fora do lock, permitindo reproduzir uma resposta antiga que chega após um evento novo. Falha de conexão usa erro de rede MSW; timeouts liberam o lock antes de atrasar a resposta. Endpoints de controle só existem com MSW habilitado.

## Arquivos

Criados em `src/`: `features/checkout/checkout-page.tsx`, `checkout.css`, `use-purchase-attempt.ts`; `features/orders/orders-page.tsx`; `shared/api/order-hooks.ts`; `shared/contracts/realtime.ts`; `shared/realtime/reconcile.ts` e `marketplace-realtime.tsx`; `mocks/socket-marketplace.ts`. Criados em `tests/`: `phase4-helpers.ts`, `checkout-phase4.spec.ts`, `orders-domain-phase4.spec.ts`, `realtime-phase4.spec.ts`, `purchase-journey-phase4.spec.ts`. Criado este relatório.

Modificados: contratos marketplace, repositório, handlers HTTP/socket, Axios marketplace API, hooks de cache, Router, entradas provisórias da Fase 3, layout/navegação, estilos compartilhados, Dialog (gancho opcional de restauração de foco), README, contratos REST e arquitetura. Nenhuma dependência, token ou asset foi substituído.

## Validação

| Comando                    | Resultado final                 |
| -------------------------- | ------------------------------- |
| `bun run typecheck`        | Passou                          |
| `bun run lint`             | Passou                          |
| `bun run format:check`     | Passou                          |
| `bun run build`            | Passou                          |
| `bun run build:demo`       | Passou                          |
| `bun run test:e2e:dev`     | **79/79**, 2,4 min, sem retries |
| `bun run test:e2e:preview` | **79/79**, 1,6 min, sem retries |

Os 49 testes anteriores foram preservados sem alteração. Os 30 novos dividem-se em 18 de checkout, sete de domínio, quatro de tempo real e um percurso completo catálogo → detalhe → carrinho → login → checkout → recibo. As execuções completas finais foram sequenciais, com quatro workers Chromium e sem edições durante a atividade dos servidores. Os comandos terminaram com código 0.

O preview executa `bun run build` + `bun run preview` com `VITE_ENABLE_MSW=true`, usando a otimização de produção e a mesma ativação de mocks do modo demo. O build demo também foi validado separadamente. Axios/MSW original, `diagnostic:result` e heartbeat além de 30 segundos continuam aprovados nos dois ambientes.

Novos testes REST usam Axios no navegador; cenários vêm dos handlers MSW e nenhum teste modifica o estado interno para produzir resultados. A fixture Axios recebe o token de uma autenticação REST e gera somente a identidade do visitante, como o cliente da aplicação. Testes de tempo real observam contadores incrementados exclusivamente nos listeners de eventos Socket.IO recebidos/validados; um contador específico de `order.updated` impede que polling REST ou eventos NFT mascarem sua ausência.

Cobertura: compra confirmada/recusada/pendente; validação/formulário/carteira/rede/cupom; cotação atualizada e mudanças de preço/estoque; sessão expirada; duplo envio; timeout antes/depois da criação; refresh durante envio e pendência; idempotência/payload conflitante; estoque concorrente; preservação de adições posteriores e linhas recriadas; snapshots financeiro/carteira imutáveis; replay duplicado/invertido; reconexão; troca de conta inclusive sem reload; resposta REST pendente chegando após confirmação real por socket. O domínio usa relógio controlado para prazos e cenários configuráveis para latência/respostas atrasadas.

Checkout e confirmação geram capturas em 390, 768 e 1440px após fontes/imagens/resumo carregarem. Foram revisadas capturas desktop/mobile; não houve overflow, e o recibo mobile permite rolar e alcançar o fechamento pelo teclado. Foco inicial, Escape, Tab e retorno ao controle apropriado são verificados. Essa revisão é funcional, sem alegação de fidelidade aos frames Figma não consultados.

Relatório Playwright: `playwright-report/index.html`; capturas e traces: `test-results/` (ignorados pelo Git). Versões mantidas: Bun 1.4.2, React 19.3.1, TypeScript 6.0.3, Vite 8.3.4, Query 5.104.3, Router 1.170.44, Axios 1.20.0, MSW 2.15.0, binding 0.2.0, Socket.IO Client 4.8.4 e Playwright 1.64.1.

## Problemas encontrados e corrigidos

- A resolução anterior tratava pendência como efeito antecipado. Agora somente confirmação baixa estoque/carrinho, com uma transição terminal atômica e rastreamento dos IDs das linhas compradas.
- A recuperação automática da tentativa podia competir com o envio em andamento. O bloqueio síncrono impede essa recuperação concorrente; chave e payload permanecem estáveis após reload.
- O modal de carteira não restaurava foco com Escape. O Dialog recebeu um gancho opcional e o checkout restaura foco ao controle disponível; o recibo também restaura foco e usa IDs únicos para exploração simulada.
- Uma rodada parcial de UI terminou 16/21 por foco e esperas incorretas: fixture antes do bootstrap MSW e busca de heading oculto pelo recibo. Corrigidos os fluxos e as esperas sem adicionar retries.
- A primeira rodada completa terminou 76/79: o indicador global acrescentava outro `role=status` aos testes antigos de perfil, e a fixture visitante dependia de uma identidade apagada pelo reset. O indicador usa `aria-live=polite` e a fixture gera identidade quando ausente. Os 49 testes anteriores não foram modificados.
- Capturas iniciais podiam registrar somente o loading. A preparação agora espera campos, resumo, fontes e imagens.
- Em execuções parciais no sandbox Windows, o encerramento automático do Vite ficou pendente e exigiu encerrar exclusivamente os processos identificados daqueles testes. As execuções completas finais usaram permissão de processo adequada e encerraram normalmente; nenhum teste falho foi ocultado por retry.

## Limitações e revisão final

O Figma MCP não foi acessado nesta fase: o usuário adiou a auditoria visual e pediu reutilização dos tokens/assets existentes. Nenhuma conta foi consultada nesta fase; a última conta identificada na Fase 3 era `[conta Figma anterior; e-mail omitido na entrega pública]`, sem permissão na nova cópia. Os IDs antigos não foram usados como se estivessem validados. Fidelidade aos novos frames fica para a revisão final.

Pedidos anteriores a esta fase recebem migração compatível. Como não havia snapshot histórico de carteira, esse campo só pode usar o registro disponível ou um marcador explícito de informação histórica indisponível; os valores financeiros e recibos antigos não são recalculados.

O domínio é local IndexedDB e requer contexto seguro/Web Locks. WebSocket usa exclusivamente o transporte já validado pelo binding MSW; não implementa polling Socket.IO, rooms ou um backend remoto. A outbox não é um histórico ilimitado; a reconciliação REST é obrigatória após perda de eventos. Revisão visual detalhada, Lighthouse, leitores de tela e outros navegadores ficam para a fase final. Não houve avanço para otimização/Fase 5.
