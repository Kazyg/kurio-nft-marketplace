# Login, cadastro e autenticação social demonstrativa

## Referências e auditoria

Figma MCP `whoami`: **[conta Figma atual; e-mail omitido na entrega pública]**, Gui, equipe Starter com assento View. A cópia `Hfp4aJDaHzzuDlneSaFbwD` permitiu consultar os quatro frames solicitados, sem erro de permissão ou cota: desktop login `9:115`, desktop cadastro `9:1022`, mobile login `16:1022` e mobile cadastro `16:1228`. Foram obtidos contexto completo, componentes internos, tokens e screenshots. Os contextos estão em `reports/figma/auth-*-current.txt`. Nenhuma outra tela foi auditada.

Foram relidos README, arquitetura e verificação da Fase 3 e inspecionados formulário, rotas, guard, ciclo de sessão, cliente Axios, Query hooks, handlers e repositório. A base efetiva desta tarefa tinha **138 testes**, incluindo as entregas posteriores à referência de 79 testes do pedido.

| Divergência anterior                                                     | Correção                                                                                                                                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modal de 480px, altura variável, cantos/padding genéricos e título extra | Login 500×600, cadastro 500×656; posições X470/Y160 e X470/Y158 em viewport 1440×900; superfícies e faixa inferior laranja; título acessível sem duplicação visual |
| Sem abas desktop e texto diferente                                       | Entrar / Criar conta com divisor coral e estado ativo; textos, margens e fonte conforme contexto                                                                   |
| Campos de 46px, labels visuais extras e espaçamentos maiores             | Campos desktop 340×40, gap 12; labels continuam associadas, visualmente ocultas; placeholders e bordas do design                                                   |
| Recuperação exibida só como aviso                                        | Link-botão Esqueceu a senha? abre feedback honesto de indisponibilidade, sem simular envio                                                                         |
| Botões sociais desabilitados e sem ícones                                | Controles funcionais de 40px, ícones originais locais, divisor Ou continue com, loading e erro                                                                     |
| Página mobile derivada de formulário genérico, sem logo/hierarquia       | Logo em caixa Y80/136px, título Y256, formulário Y312, campos de 50px; CTA de 60px em Y492/login e Y588/cadastro                                                   |
| Mobile com elementos globais competindo com a autenticação               | Header, rodapé e navegação inferior ocultos somente nas rotas auth abaixo de 768px; página própria com rolagem normal                                              |
| Sem composição mobile específica de social/link inferior                 | Social em Y592/login e Y688/cadastro; troca de página em Y756/Y852 no estado sem erros; largura fluida com inset 28px                                              |

O botão Voltar existente foi preservado no topo mobile, assim como a correção SPA/cache da rodada anterior. A indicação visível de autenticação demonstrativa aparece após o link inferior; por isso o cadastro pode exceder os 896px e rolar, sem esconder conteúdo. Erros e o aviso de recuperação expandem o fluxo normalmente. No desktop com viewport baixo, o modal limita sua altura e permite scroll. O fundo usa a Home real já implementada e os dados REST, sem recriar o screenshot ou alterar catálogo, filtros, hero e demais telas. A abertura contextual pelo favorito conserva o NFT ao fundo, preservando o fluxo existente.

## Assets

Os SVGs foram baixados das URLs temporárias retornadas pelo MCP para `public/assets/figma`, sem referências temporárias no runtime:

- `auth-facebook.svg`: ícone original 20×20.
- `auth-google-{green,green-right,yellow,blue,blue-right,red,red-right}.svg`: sete camadas originais, posicionadas dentro do slot 20×20 conforme o componente Social Button; paths e dimensões raiz não foram redesenhados ou alterados.
- `auth-close.svg`: X original 18×18.
- `auth-hide.svg` e `auth-hide-mobile.svg`: ícones Iconly/Curved/Hide originais em suas dimensões exportadas; a alternância para senha visível reutiliza Eye existente.

Todos os arquivos são locais e não vazios. Os testes carregam os SVGs antes de capturar as telas e medem o slot Google e o Facebook em 20×20. Os quatro frames foram inspecionados visualmente, incluindo os estados desktop/mobile e o ícone de confirmação mobile.

## Fluxo social

`POST /api/auth/social` recebe apenas o provedor escolhido e retorna sessão válida do domínio MSW persistente. Google e Facebook usam IDs próprios estáveis, definidos nas fixtures; nenhum usuário é fabricado no componente ou cliente Axios. Na primeira utilização o handler cria a identidade, resolve colisões de e-mail/username sem tomar contas existentes e grava um hash de segredo aleatório não exposto. O mesmo provedor recupera o mesmo usuário por ID, inclusive após editar perfil ou trocar de provedor. As novas identidades começam sem carteiras, como um cadastro novo; o fluxo existente permite adicioná-las.

A função de sessão existente continua responsável por merge de carrinho, token e expiração. O hook social aplica a mesma sequência de cancelamento/limpeza dos caches privados e atualização da sessão dos hooks tradicionais. LoginDialog/AuthPage conservam seus callbacks e destino seguro, retomando checkout, perfil e favoritos. Repetições durante envio são bloqueadas por estado e trava síncrona; falhas REST não criam uma sessão visual de sucesso. O interceptor reconhece `/auth/social` como endpoint de autenticação, sem invalidar uma sessão anterior por uma falha nessa tentativa.

O cadastro tradicional mantém `RegisterInput` e suas regras: o campo visual Nome de usuário envia o nome público por `name`, conforme o contrato existente; o identificador `username` continua gerado pelo domínio e editável no perfil. Não houve migração de identidades tradicionais ou alteração das senhas existentes.

O novo teste com sessão curta identificou uma corrida real na expiração durante a entrada em rota privada: o evento 401 cancelava a consulta de sessão que `beforeLoad` aguardava, desmontando a raiz em `CancelledError` antes do redirecionamento. `session-lifecycle.tsx` agora deixa a consulta concluir a revalidação REST sem cancelá-la nesse evento e no timer de expiração (`cancelRefetch: false`). A troca de identidade por storage continua cancelando a consulta anterior. Os guards, limpeza dos caches privados e redirecionamento seguro permanecem. O teste manteve a exigência de retorno automático ao login e de nova autenticação na mesma identidade.

## Acessibilidade e navegação

Labels, autocomplete, RHF/Zod, erros associados aos campos e validações REST foram preservados. Abas usam estado selecionado, roving tabindex e setas/Home/End. A ordem inclui Fechar → aba ativa → campos. O modal mantém trap de foco, fecha por X/Escape e restaura o foco ao acionador conectado. O Dialog recebeu apenas props opcionais; outros diálogos mantêm o comportamento padrão. Campos de senha/confirmar senha podem ser mostrados/ocultados no mobile. A troca de modo limpa rascunho/erros; `redirect` continua restrito a destinos locais seguros.

## Arquivos alterados

- `src/features/auth/auth-page.tsx`, `auth.css`; novos `auth-modal.tsx` e `social-provider-icon.tsx`.
- `src/shared/ui/login-dialog.tsx`, `dialog.tsx`.
- `src/shared/contracts/marketplace.ts`; `src/shared/api/marketplace.ts`, `marketplace-hooks.ts`, `client.ts`.
- `src/mocks/fixtures.ts`, `marketplace-handlers.ts`.
- `src/app/session-lifecycle.tsx`: correção da corrida de expiração detectada pelos testes novos.
- Onze SVGs `public/assets/figma/auth-*.svg` e quatro contextos `reports/figma/auth-*-current.txt`.
- Novo `tests/auth-visual-social.spec.ts` com 23 cenários.
- `tests/auth-phase3.spec.ts`: seletor do label de cadastro e título mobile atualizados ao texto solicitado; navegação por teclado estendida para conferir a aba ativa, sem remover asserts de foco, validação ou autenticação.
- README, contratos REST, arquitetura e este relatório.

Sem novas dependências, alteração de regras financeiras, pedidos, idempotência, estrutura da persistência do repositório ou protocolo Socket.IO.

## Validação

Rodada anterior diretamente afetada: **22/22** no preview, cobrindo autenticação tradicional, sessão, privacidade e retorno mobile. Nova rodada: **23/23** no preview, com ambos os provedores nos dois modos em desktop/mobile, medidas dos seis layouts (390/414/1440 × login/cadastro), alternância, foco, registro mobile, isolamento, falha, duplicatas, sessão expirada, provider inválido, favorito e carrinho → checkout. As requisições sociais são verificadas como respostas do Service Worker, com payload do provedor e sessão real do handler.

Capturas: `test-results/auth-visual-social-*/auth-figma-{login,register}-{390,414,1440}.png`.

| Comando                            | Resultado final                                   |
| ---------------------------------- | ------------------------------------------------- |
| `bun run typecheck`                | Aprovado                                          |
| `bun run lint`                     | Aprovado                                          |
| `bun run format:check`             | Aprovado                                          |
| `bun run build`                    | Aprovado                                          |
| `bun run build:demo`               | Aprovado                                          |
| `bun run test:e2e:dev --workers=2` | **161/161**, 6,8 min, sem retries                 |
| `bun run test:e2e:preview`         | **161/161**, 3,0 min, quatro workers, sem retries |

Foram preservados os 138 cenários anteriores e adicionados 23. Todas as execuções finais terminaram com código 0. Não houve mudança de código entre o preview aprovado e a repetição integral do dev com dois workers; somente o parâmetro CLI de concorrência mudou, mantendo os asserts e timeouts.

Uma execução completa anterior de desenvolvimento, com quatro workers, terminou em **160/161**: o Vite retornou `@vitejs/plugin-react can't detect preamble` durante a preparação de um teste antigo de checkout, antes de o diagnóstico/aplicação montar. A causa específica dessa ocorrência isolada de inicialização não foi determinada. A redução da concorrência foi usada na repetição integral aprovada, sem alterar a configuração permanente do projeto, adicionar retries ou enfraquecer verificações. O mesmo teste de checkout passou na repetição.

Após a correção de expiração, a rodada relevante em desenvolvimento passou em **53/53**, incluindo os 23 novos casos, autenticação tradicional, privacidade e checkout. Um teste novo de falha também precisou esperar o formulário estar visível antes de configurar `/__mock/scenario`: o acesso inicial por `page.goto` ainda podia estar inicializando o MSW no dev e responder 404. Essa preparação foi corrigida sem aumentar timeouts ou remover asserts. A primeira regressão completa foi interrompida para corrigir essa preparação; nenhum resultado parcial é apresentado como aprovação integral.

## Limites

Não há OAuth, comunicação com provedores, recuperação de senha ou pagamento real. Cada provedor representa uma única identidade de demonstração neste domínio local, compartilhada entre abas da mesma origem, não uma conta real do visitante. Não foi feita auditoria das demais telas, Lighthouse ou deploy. Os testes usam Chromium e simulação de viewport baixo; teclado virtual e navegadores de dispositivos físicos não foram verificados.
