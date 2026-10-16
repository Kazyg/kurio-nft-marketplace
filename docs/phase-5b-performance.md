# Fase 5B — imagens e carregamento

## Inventário e conversão

Os oito PNGs oficiais em `public/assets/nfts` possuem 1254 × 1254 px e somam **16.102.885 bytes**. Os maiores são Cosmic Bloom, Sage Nomad e Violet Nomad, com 2.068.526 bytes cada. Não houve troca de arte, recorte ou remoção dos originais.

Foram geradas 40 variantes WebP locais, em 160, 320, 640, 960 e 1254 px. A conversão utiliza Pillow 12.2.0, WebP com qualidade 90, método 6 e redimensionamento Lanczos. Para regenerar: `python -m pip install Pillow==12.2.0` e `python scripts/optimize-images.py`. Pillow é necessário somente para regeneração, não para executar, testar ou construir o projeto.

| Conjunto das oito artes |      Bytes | Redução frente aos PNGs |
| ----------------------- | ---------: | ----------------------: |
| PNG original 1254 px    | 16.102.885 |                       — |
| WebP 1254 px            |  1.297.800 |                  91,94% |
| WebP 960 px             |    829.476 |                  94,85% |
| WebP 640 px             |    392.808 |                  97,56% |
| WebP 320 px             |    122.910 |                  99,24% |
| WebP 160 px             |     43.166 |                  99,73% |

Todas as variantes juntas somam **2.686.160 bytes**. Os originais continuam disponíveis no build por compatibilidade com os dados persistidos, mas os componentes que apresentam artes conhecidas usam as variantes responsivas. Assim, o diretório distribuído cresce pelo conjunto de variantes; a economia acima corresponde aos arquivos transferidos ao navegador, não à remoção dos PNGs do disco.

A compressão é com perdas. A diferença RGB RMS das versões 1254 px em relação ao original ficou entre 1,885 e 2,390 em escala 0–255; esse dado não substitui a inspeção visual. As comparações de screenshots da Fase 5B registram a aparência renderizada. Não são utilizadas imagens externas ou placeholders.

## Aplicação

`src/shared/lib/nft-image.ts` reconhece apenas as oito artes oficiais e fornece `src`, `srcSet`, `sizes` e dimensões. URLs desconhecidas permanecem intactas; contratos REST, fixtures e IndexedDB não precisam de migração.

- Hero: prioridade alta, carregamento normal e `sizes` alinhado à composição própria mobile (120/138 px) e desktop (408 px). Arte secundária de 58 px com lazy loading.
- Cards: primeiro card do catálogo com carregamento eager e prioridade alta por ser LCP mobile; demais com lazy loading, dimensões explícitas e seleção responsiva conforme colunas.
- Banners, promoções e diário: lazy loading e dimensões intrínsecas; imagens dos artigos mobile consideram duas colunas.
- Detalhes, miniaturas, carrinho e recibos: integração do mesmo helper no trabalho de acessibilidade, com dimensões e `sizes` específicos. A arte principal dos detalhes recebe prioridade alta; a imagem ampliada pode utilizar a variante de maior resolução.

## Fontes e JavaScript

A Roboto Mono permanece local, com pesos 400, 500 e 700 e `font-display: swap`. O HTML antecipa apenas WOFF2 400 e 700, utilizados no primeiro viewport. O Vite resolve os preloads para os mesmos arquivos com hash utilizados no CSS: 12.680 e 12.696 bytes, respectivamente. Não foram adicionadas fontes externas nem substituída a família visual.

As rotas passam a carregar diagnóstico, carrinho, autenticação/favoritos, perfil, carteiras, checkout e pedidos sob demanda com `React.lazy`. Detalhes utiliza a API nativa `route.lazy`/`createLazyRoute` do TanStack Router, com estado pendente reservado apenas nessa rota pública. Um import tardio anterior expunha o rodapé antes do skeleton, causando CLS desktop de 0,438; a reserva da rota nativa e do skeleton corrige a transição sem manter todo o módulo de detalhes no carregamento da Home. O catálogo permanece no módulo inicial: sua versão lazy apresentava um intervalo de aproximadamente 270 ms entre download do módulo e início das consultas, relacionado à suspensão; o import estático permite iniciá-las junto da montagem da aplicação. A primeira implementação com `lazyRouteComponent` expôs um aviso real de suspensão condicional do React 19.3.1 na biblioteca instalada; foi substituída sem ignorar o erro nem atualizar dependências. O erro de rota foi extraído para não importar toda a autenticação no bootstrap.

Filtros laterais são montados apenas em desktop, em vez de criar no mobile uma árvore escondida por CSS com controles Radix. `useDesktop` fornece o snapshot real já no primeiro render client, preservando a composição desktop. O controle de preço carrega quando é visível; seu fallback local reserva 170 px. Os diálogos de filtro, imagem ampliada e login carregam somente quando abertos, mantendo os callbacks e a gestão de foco do Radix. A conexão de tempo real é montada automaticamente em um `Suspense` isolado com fallback nulo; seu módulo deixa de bloquear a primeira pintura, sem timers, condição de auditoria ou mudanças nos eventos e na reconciliação. Cards utilizam `React.memo` com comparação padrão, preservando as assinaturas de sessão, favoritos e mutations existentes.

O botão compartilhado retorna diretamente as classes estáticas quando não recebe `className` customizada, evitando inicializar o merger Tailwind nessa situação. A equivalência exata foi verificada para variantes ausente, default e outline; classes customizadas continuam passando pelo mesmo `cn` original.

A primeira medição integrada identificou CLS desktop de 0,585: o rodapé aparecia enquanto o módulo do catálogo ainda não tinha carregado, sendo deslocado quando a página chegava. O `Suspense` ao redor do conteúdo reserva um viewport de altura enquanto um componente de rota é importado. A reserva existe apenas no carregamento; não muda a altura final das páginas. O tempo de espera de `beforeLoad` mantém a configuração original do Router: forçar `pendingMs: 0` globalmente causava desconexão prematura de observadores da consulta de sessão e `CancelledError` no guard de rotas privadas, portanto essa configuração foi removida, sem alterar regras de sessão. Os testes focados de Perfil e Carteiras mobile passaram após a correção. O probe posterior registrou Performance 98 e CLS 0,0091 no desktop. O primeiro card do catálogo, identificado pelo Lighthouse como LCP mobile, recebe carregamento eager e prioridade alta; os demais continuam lazy. O `sizes` mobile desconta margens, gap e padding da arte (`(100vw - 80px) / 2`, ou 64 px em telas de até 380 px), evitando solicitar a variante 640 px quando 320 px cobre o DPR observado.

O bootstrap foi dividido em `main.tsx` e `app/mount.tsx`: o primeiro inicia os mocks sem aguardar a avaliação do ReactDOM. Um plugin Vite injeta no HTML preloads dos arquivos com hash do módulo de montagem e suas dependências estáticas. `modulepreload` busca e compila os módulos, mas não os avalia. O import e a execução da aplicação continuam ocorrendo estritamente depois de `await enableMocking()`, preservando a captura de WebSocket pelo Engine.IO. Rotas privadas e imagens não são incluídas nesses preloads.

O build de demonstração inspecionado após os ajustes sob demanda gerou montagem de 260,93 kB (gzip 81,42 kB), frente a aproximadamente 320 kB na integração anterior. O chunk de botão, após redistribuição de dependências, possui 28,82 kB (9,29 kB). Os chunks de preço (22,07 kB/7,84 kB), diálogo (31,70 kB/10,99 kB) e rota de detalhes (12,96 kB/4,67 kB) não são requisitados na abertura da Home mobile. Os tamanhos individuais dos chunks não são aditivos a uma suposta economia, pois o bundler redistribui dependências compartilhadas; o relatório principal registra a transferência e as medições finais.

Os probes mobile anteriores à otimização do lock registraram Performance entre 77 e 80, FCP de 2,85–2,91 s e LCP de 3,98–4,26 s; não atingiam a meta. A variante correta de 320 px passou a ser selecionada e as consultas do catálogo iniciaram cerca de 270 ms antes, mas não bastaram. A inspeção de rede revelou que o atraso simulado de 120 ms era aguardado dentro do Web Lock transacional, serializando requisições independentes. O coordenador moveu essa espera para antes da transação, mantendo a duração por requisição e operações atômicas. As medianas finais, com esse ajuste integrado e a configuração padrão de CPU/rede/cache preservada, constam no relatório principal.

MSW é iniciado antes da importação da aplicação, como antes. Socket.IO, reconexão, persistência, consultas e regras financeiras foram preservados. Nenhuma integração foi desligada para reduzir JavaScript ou melhorar pontuações.

Em produção, `worker.start({ quiet: import.meta.env.PROD })` desativa somente os grupos de logs de depuração das requisições MSW. Desenvolvimento mantém os logs, e `onUnhandledRequest` continua registrando erros. Um experimento antecipando o preload do bundle MSW piorou o probe mobile de 79 para 76 (FCP de 2,91 para 3,48 s); essa hipótese foi refutada e a alteração de preload MSW foi revertida. Os preloads da aplicação e das fontes permanecem. Não houve mudanças no preset, cache ou throttling para elevar notas.

Os probes de Detalhes após os ajustes registraram Performance 99 desktop e 80 mobile, Accessibility/Best Practices/SEO 100 em ambos, CLS zero desktop e 0,0486 mobile. LCP foi de 945 ms desktop e 4172 ms mobile; TBT, zero e 101 ms. Isso confirma a correção do deslocamento do rodapé, mas ainda não comprova a meta Performance mobile. Probes são diagnósticos individuais; as metas são avaliadas pelas medianas finais das três medições por combinação.

## Verificações focadas

- `bun run typecheck`: aprovado após integração de imagens e imports dinâmicos.
- ESLint dos arquivos deste trabalho: aprovado.
- `bun run build:demo`: aprovado; preloads apontam para assets locais com hash e variantes WebP estão em `dist/assets/nfts/responsive`.
- Medianas Lighthouse, testes completos e baselines: consolidados pelo coordenador em `docs/phase-5b-verification.md`, após integração de acessibilidade e regressão visual.

## Arquivos

- `scripts/optimize-images.py`.
- `public/assets/nfts/responsive/*.webp`.
- `src/shared/lib/nft-image.ts`.
- `src/shared/ui/nft-card.tsx`.
- `src/features/catalog/catalog-page.tsx`.
- `src/app/router.tsx`, `route-pages.tsx`, `phase-three-pages.tsx`, `lazy-pages.tsx` e novo `route-error.tsx`.
- `src/app/route-pending.tsx`, `src/app/mount.tsx`, `src/main.tsx` e `vite.config.ts`.
- `src/app/nft-route.tsx`, `src/app/nft-route.lazy.ts`, `src/shared/ui/button.tsx` e `src/mocks/enable.ts`.
- `src/shared/ui/login-dialog.tsx` e novo `login-dialog-content.tsx`.
- `index.html`.

Os componentes de detalhes, carrinho e pedidos foram integrados pelo agente responsável por acessibilidade; a lista consolidada está no relatório principal.
