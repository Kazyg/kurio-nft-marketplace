# Entrega final — Fase 5C

## Estado

Preparação local concluída; publicação e validação pública ainda pendentes. A fase não está concluída enquanto não houver URL pública validada e repositório entregue.

- Repositório: sem remote configurado. Destino proposto `Kazyg/kurio-nft-marketplace`; a consulta GitHub retornou404 e a criação/visibilidade aguarda confirmação.
- URL pública: ainda não publicada.
- Commit entregue: ainda não consolidado; o único commit inicial era17c632e. Os arquivos da aplicação já estavam não rastreados no início da fase e foram preservados.
- Vercel: CLI64.3.1, conta autorizada `kazyg`, escopo Hobby `guilherme-severos-projects-43576b3c`.

## Funcionalidades

Catálogo responsivo com busca/filtros/paginação, detalhes e galeria, favoritos, autenticação, perfil, carteiras por rede, carrinho persistente, cotação, checkout idempotente, pedidos e recibos. REST é interceptado por MSW e eventos reais do cliente Socket.IO passam pelo transporte MSW/binding. IndexedDB e Web Locks preservam o domínio local, inclusive após refresh e timeout.

## Configuração de deploy

`vercel.json`: framework Vite, instalação `bun install --frozen-lockfile`, build `bun run build:demo`, saída `dist`. O filesystem é consultado antes do fallback para index.html; `/assets`, `/api` e o worker não recebem fallback HTML. O worker usa Cache-Control no-cache. Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite) e [configuração estática](https://vercel.com/docs/project-configuration/vercel-json).

`.env.demo` habilita `VITE_ENABLE_MSW=true`; API permanece `/api` e Socket.IO utiliza a origem atual. Não há segredos Vite, dependência de localhost ou assets temporários Figma no runtime. Fontes Roboto Mono,40 WebPs responsivos, PNGs originais, SVGs e Service Worker estão locais. `.gitignore` e `.vercelignore` excluem caches, relatórios, artefatos, vínculo Vercel e envs privados, preservando os três envs públicos revisados.

Não foram alterados componentes, contratos, cálculos, estoque, sessão, idempotência ou protocolo. E-mails e ID pessoal de equipe Figma foram omitidos nos relatórios públicos, preservando a distinção entre conta antiga/atual e os resultados históricos. A auditoria5A possui evidências em `docs/phase-5-visual-audit.md`; não está ausente.

## Testes selecionados

Typecheck, lint e build:demo aprovados. Formatação será conferida após a documentação final.

Executados uma única vez no preview de produção, serialmente, sem retries: **13/13 aprovados em58,0s**. Não foram criados testes, alterados asserts, atualizados snapshots ou repetido Lighthouse.

| Arquivo existente               | Casos selecionados                                            |
| ------------------------------- | ------------------------------------------------------------- |
| auth-phase3.spec.ts             | Login com validação/refresh; autenticação mobile              |
| catalog.spec.ts                 | Catálogo via Service Worker; acesso direto ao detalhe/estoque |
| cart-phase3.spec.ts             | Persistência, quantidade e remoção                            |
| checkout-phase4.spec.ts         | Compra/recibo; cliques repetidos; recuperação após timeout    |
| network.spec.ts                 | Axios+MSW+Socket.IO; fallback de rota                         |
| purchase-journey-phase4.spec.ts | Catálogo→detalhe→carrinho→login→checkout→recibo/refresh       |
| realtime-phase4.spec.ts         | nft.updated/versões; order.updated/reconexão/refresh          |

Comando utilizado:

```sh
bun run test:e2e:preview tests/auth-phase3.spec.ts:8 tests/auth-phase3.spec.ts:86 tests/catalog.spec.ts:7 tests/catalog.spec.ts:122 tests/cart-phase3.spec.ts:33 tests/checkout-phase4.spec.ts:78 tests/checkout-phase4.spec.ts:194 tests/checkout-phase4.spec.ts:248 tests/realtime-phase4.spec.ts:53 tests/realtime-phase4.spec.ts:88 tests/network.spec.ts:2 tests/network.spec.ts:48 tests/purchase-journey-phase4.spec.ts --workers=1 --retries=0
```

O runner existente constrói produção com `VITE_ENABLE_MSW=true`; o deploy utiliza o build demo explicitamente aprovado. Resultado local preservado em `reports/phase-5c/selected-tests/index.html`.

## Validação pública

Ainda não executada. Após publicar, verificar Home, detalhe, login Ana, inclusão no carrinho, carteira compatível, checkout, confirmação, recibo, refresh, evento Socket.IO, acesso direto e navegação390px; conferir console, imagens/fontes/worker e origem das requisições. Resposta HTTP200 isolada não será considerada aprovação funcional. A correspondência de commit deve ser conferida nos metadados do deploy e no repositório.

## Lighthouse anterior

Sem novas auditorias nesta fase. Medianas das12 medições5B:

| Página/perfil    | Performance | Acessibilidade | Boas práticas | SEO |    LCP |     CLS |      TBT |
| ---------------- | ----------: | -------------: | ------------: | --: | -----: | ------: | -------: |
| Home desktop     |          99 |            100 |           100 | 100 |  991ms | 0,00908 |      0ms |
| Detalhes desktop |          99 |            100 |           100 | 100 |  947ms |       0 |      0ms |
| Home mobile      |          80 |            100 |           100 | 100 | 4324ms |       0 | 104,19ms |
| Detalhes mobile  |          79 |            100 |           100 | 100 | 4234ms | 0,04860 |  112,5ms |

Performance mobile≥90 continua pendente, relacionada ao caminho inicial de JavaScript/mocks/React/Query sob throttling móvel. Não foi alegado cumprimento dessa meta. [Método e resultados](phase-5b-verification.md).

## Limitações e próximos passos

Simulação local sem backend, blockchain, OAuth ou movimentação financeira real. Dados não sincronizam entre dispositivos/origens. IndexedDB/Web Locks exigem navegador compatível e contexto seguro. Binding Socket.IO utiliza somente transporte WebSocket, sem paridade completa com servidor. Leitores de tela reais e outros motores não foram auditados. Baselines dependem de Windows/Chromium documentados. O histórico de ERR_NO_BUFFER_SPACE motivou execução serial nesta fase.

Faltam confirmar/criar o repositório, consolidar/enviar a versão, publicar na Vercel e registrar a verificação pública. Credenciais, reset e cenários de recusa/timeout/rede/eventos estão no README. Se a sessão CLI expirar, executar `bunx vercel login`, autorizar a própria conta pelo link oficial e depois `bunx vercel --prod` na raiz. Nenhum token deve ser enviado pelo chat ou incluído no projeto.
