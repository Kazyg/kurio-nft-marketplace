# Entrega final — Fase 5C

## Estado

Aplicação publicada e verificação funcional pública aprovada em 16/10/2026. A versão final reúne o código validado e esta documentação de entrega.

- Repositório público: [Kazyg/kurio-nft-marketplace](https://github.com/Kazyg/kurio-nft-marketplace), criado após confirmação explícita. Remote `origin`, branch `main`.
- URL pública: [kurio-nft-marketplace-two.vercel.app](https://kurio-nft-marketplace-two.vercel.app).
- Versão entregue: `v1.0.0-demo`. O SHA da versão é resolvido por `git rev-parse 'v1.0.0-demo^{commit}'` e registrado nos metadados Vercel `deliveredCommit`/`githubCommitSha`; `deliveredVersion` identifica a tag. A documentação evita um hash autorreferente no próprio commit.
- Vercel: CLI 64.3.1 local, conta autorizada `kazyg`, escopo Hobby `guilherme-severos-projects-43576b3c`; projeto `kurio-nft-marketplace`.

O código foi inicialmente consolidado em `ffbd5ac315623b5da34d17fc684e6e4cbcac6f7e`, preservando o commit inicial 17c632e. Os arquivos já estavam não rastreados antes da fase; nenhum histórico foi descartado ou reescrito. A versão de entrega acrescenta somente documentação sobre o deploy/verificações. Os 303 arquivos iniciais incluem 40 WebPs, 24 baselines PNG, fixtures, contratos, lockfile e configurações de testes/Lighthouse. Relatórios de execução e credenciais locais ficam ignorados. Commits novos utilizam o e-mail público noreply GitHub.

## Funcionalidades

Catálogo responsivo com busca/filtros/paginação, detalhes e galeria, favoritos, autenticação, perfil, carteiras por rede, carrinho persistente, cotação, checkout idempotente, pedidos e recibos. REST é interceptado por MSW e eventos reais do cliente Socket.IO passam pelo transporte MSW/binding. IndexedDB e Web Locks preservam o domínio local, inclusive após refresh e timeout.

## Configuração de deploy

`vercel.json`: framework Vite, instalação `bun install --frozen-lockfile`, build `bun run build:demo`, saída `dist`. O filesystem é consultado antes do fallback para index.html; `/assets`, `/api` e o worker não recebem fallback HTML. O worker usa Cache-Control no-cache. Referências: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite) e [configuração estática](https://vercel.com/docs/project-configuration/vercel-json).

`.env.demo` habilita `VITE_ENABLE_MSW=true`; API permanece `/api` e Socket.IO utiliza a origem atual. Não há segredos Vite, dependência de localhost ou assets temporários Figma no runtime. Fontes Roboto Mono, 40 WebPs responsivos, PNGs originais, SVGs e Service Worker estão locais. `.gitignore` e `.vercelignore` excluem caches, relatórios, artefatos, vínculo Vercel e envs privados, preservando os três envs públicos revisados.

Não foram alterados componentes, contratos, cálculos, estoque, sessão, idempotência ou protocolo. E-mails e ID pessoal de equipe Figma foram omitidos nos relatórios públicos, preservando a distinção entre conta antiga/atual e os resultados históricos. A auditoria 5A possui evidências em `docs/phase-5-visual-audit.md`; não está ausente.

## Testes selecionados

Typecheck, lint, format:check e build:demo aprovados. O build remoto limpo instalou o lockfile com Bun 1.4.1 e compilou com TypeScript 6.0.3/Vite 8.3.4; localmente foram utilizados Bun 1.4.2 e Node 24.14.0. A Vercel selecionou Node 24.x, builder de 2 cores/8GB, região iad1. Não foram alteradas dependências.

Executados uma única vez no preview de produção, serialmente, sem retries: **13/13 aprovados em 58,0s**. Não foram criados testes, alterados asserts, atualizados snapshots ou repetido Lighthouse.

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

**7/7 casos existentes aprovados em 30,8s**, com um worker e zero retries, apontando exclusivamente para a URL HTTPS pública. Foi usada configuração temporária ignorada, sem webServer local, autenticação Vercel ou bypass; nenhum teste novo foi criado. Casos: autenticação mobile; detalhe direto/estoque; catálogo e detalhe 390px sem overflow; Axios+Service Worker+Socket.IO; jornada completa pela interface até recibo e refresh; nft.updated/versões; order.updated/reconexão/refresh. A compra selecionou carteira compatível e o recibo veio do estado persistido confirmado, sem fabricação de sucesso.

Relatório: `reports/phase-5c/public-check/index.html`. Na inspeção complementar de Home 390px e Detalhes 1440px, foram observados contexto seguro, Service Worker controlador, Roboto Mono carregada, imagens visíveis decodificadas e ausência de overflow. Console/pageerror, requestfailed e requisições a origens externas ficaram vazios. Capturas em `reports/phase-5c/public-390.png`/`public-1440.png` e dados em `public-observation.json`; não são baselines novas.

`/mockServiceWorker.js` retornou 200, JavaScript válido e Cache-Control no-cache. Asset inexistente retornou 404 textual, não HTML do SPA. O JavaScript de ambiente publicado foi inspecionado por nomes de chaves: não contém VERCEL_OIDC_TOKEN, chave privada nem token GitHub. Os campos VITE_VERCEL expostos são metadados públicos do build. `.env.local` gerado pela CLI está excluído tanto do Git quanto do upload.

A primeira implantação de produção (`dpl_BGQj35uTk2jCRKzY5LVs9ukKqLpn`) confirmou `deliveredCommit` e `githubCommitSha` iguais ao commit inicial da aplicação. A implantação final da tag registra o SHA correspondente no mesmo alias público; a evidência final é preservada em `reports/phase-5c/deployment-version.json`. A diferença entre os commits é exclusivamente a documentação dos resultados e URLs; a implantação final também é conferida sem autenticação Vercel, com HTTP/MSW e Socket.IO no diagnóstico público.

## Lighthouse anterior

Sem novas auditorias nesta fase. Medianas das 12 medições 5B:

| Página/perfil    | Performance | Acessibilidade | Boas práticas | SEO |    LCP |     CLS |      TBT |
| ---------------- | ----------: | -------------: | ------------: | --: | -----: | ------: | -------: |
| Home desktop     |          99 |            100 |           100 | 100 |  991ms | 0,00908 |      0ms |
| Detalhes desktop |          99 |            100 |           100 | 100 |  947ms |       0 |      0ms |
| Home mobile      |          80 |            100 |           100 | 100 | 4324ms |       0 | 104,19ms |
| Detalhes mobile  |          79 |            100 |           100 | 100 | 4234ms | 0,04860 |  112,5ms |

Performance mobile≥90 continua pendente, relacionada ao caminho inicial de JavaScript/mocks/React/Query sob throttling móvel. Não foi alegado cumprimento dessa meta. [Método e resultados](phase-5b-verification.md).

## Limitações e próximos passos

Simulação local sem backend, blockchain, OAuth ou movimentação financeira real. Dados não sincronizam entre dispositivos/origens. IndexedDB/Web Locks exigem navegador compatível e contexto seguro. Binding Socket.IO utiliza somente transporte WebSocket, sem paridade completa com servidor. Leitores de tela reais e outros motores não foram auditados. Baselines dependem de Windows/Chromium documentados. O histórico de ERR_NO_BUFFER_SPACE motivou execução serial nesta fase.

Não há novas funcionalidades ou auditorias planejadas nesta entrega. Performance mobile permanece pendente, e a causa de sistema de ERR_NO_BUFFER_SPACE das execuções paralelas anteriores não foi resolvida; os testes desta fase passaram serialmente sem retries. Não há impedimento funcional observado no fluxo público validado.

Credenciais, reset e cenários de recusa/timeout/rede/eventos estão no README. Se a sessão CLI expirar, executar `bunx vercel login`, autorizar a própria conta pelo link oficial e depois `bunx vercel --prod` na raiz. Nenhum token deve ser enviado pelo chat ou incluído no projeto. Deploy foi realizado pela CLI; integração Git automática/webhook não foi configurada, portanto futuros commits exigem novo deploy manual ou conexão do repositório no painel.
