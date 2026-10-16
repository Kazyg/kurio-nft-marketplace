# Organização e trabalho por features

Login/cadastro tradicionais e autenticação social de demonstração usam os clientes REST e o ciclo de sessão em `shared/api/marketplace-hooks.ts`. `POST /auth/social` cria/recupera a identidade no handler transacional MSW e reutiliza o merge de carrinho; componentes não fabricam sessões. `features/auth` concentra formulário RHF/Zod, ícones locais dos provedores, modal responsivo e estilos. O Dialog compartilhado aceita ícone, overlay e callbacks de foco opcionais; os demais modais mantêm seus padrões.

`src/app` compõe providers e rotas. `src/features/<feature>` contém contratos, consultas, hooks e páginas daquela feature. `src/shared` contém cliente Axios, configuração, QueryClient e componentes de UI. `src/mocks` descreve os serviços simulados. `tests` contém integrações de navegador; `scripts` contém comandos portáveis Bun/Windows/Linux.

Features podem ser implementadas separadamente, sem importar detalhes internos de outras features. Compartilhe apenas contratos ou UI realmente reutilizados. Ao adicionar uma feature, mantenha seus dados simulados em handlers/fixtures MSW e registre sua rota em `src/app/router.tsx`. Combine mudanças nos arquivos de composição, package.json e lockfile para evitar conflitos entre agentes.

Na Fase 5B, as rotas secundárias usam React.lazy integrado ao TanStack Router. O catálogo permanece no módulo inicial para iniciar suas consultas sem uma suspensão adicional. Detalhes usa `route.lazy` nativo e reserva altura durante o carregamento, evitando saltos do rodapé; as configurações de espera dos guards privados permanecem intactas. Filtros desktop não são montados no mobile, e slider e diálogos carregam quando necessários. O tempo real é montado automaticamente em um Suspense isolado, preservando sessão, protocolo e reconciliação. O diálogo de login carrega seu conteúdo ao abrir, preservando os mesmos callbacks, sessão e foco. `shared/lib/nft-image.ts` adapta somente as oito artes locais conhecidas para srcset/sizes WebP, sem alterar contratos ou registros persistidos; URLs desconhecidas são mantidas. Os PNGs originais permanecem disponíveis.

Regressão visual utiliza configuração separada (`playwright.visual.config.ts`) e baselines por sistema operacional em `tests/visual-baselines`. Os cenários são preparados por REST/MSW, sem setters internos. Lighthouse usa build demo, Chromium novo por medição e presets oficiais, mantendo o bootstrap MSW anterior ao import da aplicação. Relatórios e condições estão em `docs/phase-5b-verification.md`.

Query keys pertencem à feature; o QueryClient compartilha cache de 60s, descarte após 5min, no máximo uma tentativa adicional para erros de rede/5xx e nenhuma para 4xx/mutações. Respostas do diagnóstico são validadas com Zod.

Bootstrap: carregar configuração → iniciar MSW quando habilitado → importar a aplicação → montar React. O import dinâmico da aplicação é necessário porque Engine.IO captura o construtor WebSocket na avaliação do módulo.

O HTTP é interceptado pelo Service Worker, enquanto WebSocket é interceptado pelo MSW no contexto da página. O binding traduz Engine.IO/Socket.IO; não existe servidor Socket.IO local, callback substituto ou setter acionado por mocks. Um UUID por conexão correlaciona a requisição emitida com a resposta recebida pelo cliente real.

Na Fase 2, `shared/contracts/marketplace.ts` define a fronteira REST, `shared/api/marketplace.ts` concentra chamadas tipadas e `marketplace-hooks.ts` integra cache e mutations. As features recebem dados exclusivamente por essa fronteira; fixtures e regras financeiras pertencem aos mocks. O repositório IndexedDB usa Web Locks para serializar operações entre abas e grava apenas alterações válidas, exceto falhas explicitamente posteriores ao commit.

Consultas de catálogo e detalhe recebem AbortSignal do TanStack Query. A chave de listagem inclui os parâmetros validados. TanStack Router preserva busca, filtros e paginação na URL usando serialização textual exata, sem coerção de ETH para float. Favoritos usam cancelamento, snapshot otimista, rollback e revalidação. Favoritos e carrinho usam chaves separadas por proprietário, e mudanças de autenticação descartam caches privados.

`app/session-lifecycle.tsx` centraliza expiração de sessão e sincronização de autenticação entre abas, evitando um timer por card. O contexto visual da operação permanece montado durante o diálogo de login.

Na Fase 4, `features/checkout` coordena formulário, revisão de cotações e tentativa idempotente persistida por usuário. `features/orders` renderiza estado e recibo usando exclusivamente o snapshot do pedido. `shared/api/order-hooks.ts` consulta pedidos, aplica versões monotônicas e revalida pendências via REST. A API continua sendo a autoridade financeira.

O repositório aplica a máquina de estados e efeitos atômicos sob Web Locks e grava uma outbox versionada junto das mudanças. O prazo/resultado de pedidos pendentes é persistido; qualquer transação posterior resolve prazos vencidos mesmo após reload. `mocks/socket-marketplace.ts` lê a outbox e emite eventos pelo mesmo binding MSW/Socket.IO usado no diagnóstico. Não há comunicação de mocks com setters React.

`shared/realtime/marketplace-realtime.tsx` monta uma conexão por sessão, identifica a sessão via REST, assina com token/subscriptionId e valida eventos antes de reconciliar TanStack Query. Estados terminais e versões superiores não regridem por respostas atrasadas. Conexões antigas perdem listeners ao trocar identidade; reconexão revalida recursos ativos e não envia pedidos. A outbox limitada não substitui recuperação REST.

Publicação: `vercel.json` utiliza `build:demo`, saída estática `dist` e filesystem antes do fallback SPA. Worker e assets mantêm seus próprios arquivos; rotas `/api` não são reescritas para HTML. HTTP e Socket.IO utilizam a origem pública e o bootstrap existente, sem backend Vercel ou conexão privada. Dados IndexedDB são específicos do navegador e da origem, não compartilhados entre visitantes/dispositivos. [Ponto de entrada arquitetural](../ARCHITECTURE.md) e [entrega pública](final-delivery.md).
