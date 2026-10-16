# Perfil, carteiras e checkout — 16/10/2026

## Referência e escopo

Consultados diretamente pelo Figma MCP os quatro frames do arquivo `Hfp4aJDaHzzuDlneSaFbwD`: Perfil `9:1238`, Carteiras `9:1670`, Pagamento desktop `11:2862` e mobile `16:748`. `whoami` confirmou `[conta Figma atual; e-mail omitido na entrega pública]`, plano Starter/View; todos os frames retornaram contexto completo e screenshot. Não houve bloqueio, repetição de consultas nem auditoria de outras telas. Contextos de trabalho estão em `reports/figma/account-*-current.txt` e `checkout-*-current.txt`.

Foram lidos os contratos REST, verificações das Fases 3/4 e `docs/architecture.md` (não existe `ARCHITECTURE.md` na raiz). Não houve alteração de dependências, tokens globais, preços, matemática financeira, protocolo Socket.IO, estrutura IndexedDB ou máquina de estados dos pedidos.

## Causa comprovada do bloqueio de rede

O checkout anterior escolhia `isDefault` ou a primeira carteira sem consultar a rede dos itens. A rede tinha um estado separado, inicialmente copiado dessa carteira, e podia ser alterada sem trocar a carteira. A condição `cart.items.every(nft.network === network)` também tornava qualquer carrinho multirrede impossível de comprar. A API cotava o carrinho inteiro; mudar somente a carteira não resolvia essa mistura legítima.

| Etapa rastreada          | Evidência e correção                                                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFT/edição no carrinho   | `Nft.network` define a rede; edições pertencem ao NFT e não possuem uma rede independente. Fixtures alternam `ethereum`, `polygon`, `solana`.                                                                                |
| Seleção inicial          | Carteiras iniciais de Ana/Bruno são Ethereum; a interface antiga priorizava qualquer principal, inclusive uma Polygon cadastrada pelo usuário. Agora prioriza principal compatível, depois outra carteira compatível.        |
| Rede e carteira efetivas | A rede deriva dos NFTs. Somente redes presentes e carteiras dessa rede são oferecidas. ID, versão, rede e provedor compõem a identidade da conexão; alterações invalidam conexão/revisão.                                    |
| Cotação REST             | `QuoteInput.network?` filtra a seleção na API pelos NFTs atuais do repositório. `Quote.network?` registra esse escopo. Rede inválida ou seleção vazia é rejeitada.                                                           |
| Criação do pedido        | Payload envia `quoteId`, o ID efetivamente exibido da carteira, rede e colecionador. A API compara a rede cotada/carteira, recalcula a seleção e valida versões, estoque, cupom e validade.                                  |
| Identificadores          | Contratos, fixtures, formulários, handlers e repositório usam os mesmos três identificadores canônicos. Não foi encontrada divergência de caixa/aliases que justificasse normalização adicional.                             |
| Estado antigo            | Carteiras antigas continuam válidas sem os novos metadados opcionais. A seleção é recalculada a partir dos recursos REST restaurados. Não houve reset nem migração especulativa; testes verificam persistência após refresh. |

Os testes reproduzem principal Polygon com carrinho Ethereum, compras Ethereum/Polygon, ausência de carteira compatível e mistura das duas redes. Não foi inspecionado o banco privado de uma sessão anterior do usuário; não se afirma corrupção legada sem evidência.

## Decisão para múltiplas redes

O usuário escolhe explicitamente qual rede comprar. Antes dessa escolha, conexão e revisão permanecem bloqueadas. A cotação e o pedido incluem apenas as linhas dessa rede. A confirmação remove somente as quantidades/IDs comprados; outros itens permanecem no carrinho. Uma segunda compra exige a ação existente “Iniciar nova compra”, nova revisão e nova chave idempotente. Nenhum item é convertido ou removido silenciosamente.

O parâmetro de rede é opcional: clientes antigos continuam cotando o carrinho inteiro e a API continua rejeitando um pedido multirrede com uma única carteira. O cache inclui a rede; dados anteriores de outra chave não são apresentados como a cotação atual. A versão do carrinho inteiro continua conservadoramente exigindo nova revisão após qualquer alteração.

## Ajustes visuais e funcionais

- Sidebar compartilhada com largura 310px, intervalo 28px e conteúdo principal 862px em uma área de 1200px. Campos de 417×40px, cores existentes e Roboto Mono. Navegação duplicada anterior removida somente de Perfil/Carteiras; interferência dos estilos legados nos títulos corrigida.
- Sidebar leva a Perfil, Carteiras, Atividade/pedidos e favoritos, executa logout e informa explicitamente a indisponibilidade de ofertas, downloads e suporte.
- Perfil dispõe nome/usuário, e-mail/ENS e apelido/avatar nas três linhas do design. Avatar e senha mantêm validação e contratos existentes. Apelido é atualizado por PATCH da carteira existente, com mensagem explícita em caso de sucesso parcial do perfil.
- Carteira principal tem os campos do Figma em duas colunas. Campos adicionais opcionais são persistidos pelo mesmo REST e IndexedDB: `displayName`, `profileName`, `secondaryAddress`, `referralCode`, `email`, `ens`. Não resolvem ENS nem verificam blockchain. Rede, formato de endereço, unicidade e conflito de versão continuam validados.
- Carteira secundária permite cadastro/edição. “Igual à carteira principal” reutiliza a principal no estado visual sem criar outro registro/ID. Carteiras salvas ficam disponíveis no checkout após refresh.
- Checkout desktop tem formulário à esquerda e NFTs, cupom, valores REST, seleção de carteira/provedor e ações à direita. Nome/e-mail e observação são dados do pedido; os demais campos exibem o perfil/carteira selecionados e direcionam a edição aos contratos próprios.
- Checkout mobile tem título, Voltar, cartões de carteira, Trocar carteira, provedores, total e ações próprios. Os dados adicionais e NFTs ficam numa seção expansível, sem duplicar campos/IDs. Trocar carteira abre essa seção e foca o seletor.
- Observação opcional do colecionador é validada até 1000 caracteres, persistida no pedido e incluída no payload normalizado da idempotência.

Os SVGs originais foram baixados para `public/assets/figma/account-*.svg` e `checkout-*.svg`, preservando dimensões naturais e sem URLs temporárias em produção. Imagens de NFT continuam dinâmicas pela API. Header/footer existentes foram reutilizados.

### Diferenças deliberadas em relação aos frames

O design é estático e apresenta dados exemplificativos; nomes, carteiras, imagens, quantidades e preços reais vêm dos mocks REST. A opção marcada nos screenshots do Figma não determina a carteira da compra: somente combinações compatíveis são oferecidas.

Revisão, aceite financeiro, conexão demonstrativa, erros e recuperação existentes permanecem visíveis; por isso a confirmação exige mais controles/espaço que o frame estático. O botão final diz “Confirmar compra”. A alteração de senha mantém seu próprio envio REST, separado do botão Salvar perfil. Biografia continua acessível numa seção expansível abaixo. Carteiras salvas têm uma lista de gerenciamento adicional. Perfil/carteiras mobile são adaptações acessíveis, pois não há frames específicos.

## Arquivos alterados/criados nesta rodada

- `src/features/profile/profile-page.tsx`, `profile.css`.
- `src/features/wallets/wallets-page.tsx`, `wallets.css`.
- `src/shared/ui/account-sidebar.tsx`, `account-sidebar.css` (novos).
- `src/features/checkout/checkout-page.tsx`, `checkout-presentation.tsx`, `checkout-presentation.css` (apresentação nova).
- `src/shared/layout/marketplace-layout.tsx`.
- `src/shared/contracts/marketplace.ts`, `src/shared/api/marketplace-hooks.ts`, `src/mocks/marketplace-handlers.ts`.
- SVGs locais com prefixos `account-`/`checkout-`.
- Novos `tests/account-checkout-account.spec.ts`, `checkout-network-fixes.spec.ts`, `network-domain-fixes.spec.ts`.
- Adaptações dos testes existentes de conta/checkout/jornada/autenticação/privacidade/sessão/tempo real aos rótulos solicitados, Biografia expansível e navegação/sidebar. Os testes continuam verificando os efeitos e erros; a antiga possibilidade de escolher uma rede incompatível foi substituída por asserts que comprovam que ela não é oferecida, complementados por rejeições REST diretas.
- `docs/rest-contracts.md`, este relatório e README.

Testes existentes adaptados: `account-phase3.spec.ts`, `checkout-phase4.spec.ts`, `purchase-journey-phase4.spec.ts`, `auth-visual-social.spec.ts`, `privacy-phase3.spec.ts`, `realtime-phase4.spec.ts`, `session.spec.ts` e `cart-visual-checkout.spec.ts`. Os 21 SVGs desta rodada são 13 de conta e oito de checkout.

## Validação

A base encontrada tinha **161 testes**, incluindo todos os testes da Fase 4; foram adicionados **25**, totalizando **186**. Os novos testes usam Axios no navegador/MSW, APIs de cenário e interações públicas, sem setters internos nem remoção de validações para produzir sucesso.

Cobertura nova: nove casos de conta/visual, onze de checkout/rede/visual e cinco de domínio REST. As regressões antigas mantêm confirmação/recusa/pendência, preço/estoque, timeout/retry/idempotência, expiração, Socket.IO, replay/reconexão e percurso catálogo → detalhe → carrinho → login → checkout → recibo. São geradas capturas de Perfil, Carteiras e Checkout em 390, 768 e 1440px (checkout também em 414px); os testes verificam geometria, assets carregados e ausência de overflow horizontal.

| Comando                                | Resultado final                   |
| -------------------------------------- | --------------------------------- |
| `bun run typecheck`                    | Passou                            |
| `bun run lint`                         | Passou                            |
| `bun run format:check`                 | Passou                            |
| `bun run build`                        | Passou                            |
| `bun run build:demo`                   | Passou                            |
| `bun run test:e2e:preview --workers=4` | **186/186**, 4,8 min, sem retries |
| `bun run test:e2e:dev --workers=2`     | **186/186**, 9,2 min, sem retries |

Todos os comandos finais terminaram com código 0, sequencialmente e sem alterações da aplicação durante os testes. Foram preservados os 161 casos anteriores, inclusive os 79 da Fase 4. Compras Ethereum e Polygon percorreram efetivamente conexão demonstrativa → revisão/aceite → criação REST → confirmação → recibo persistido. O cenário multirrede concluiu dois pedidos explícitos, um por rede, sem perder itens nem duplicar efeitos. As verificações de domínio confirmaram rejeição de combinações incompatíveis pela API, mesmo sem a interface.

Capturas finais em `test-results/` (diretórios por caso), incluindo `account-figma-profile-{390,768,1440}.png`, `account-figma-wallets-{390,768,1440}.png` e `checkout-figma-{390,414,768,1440}.png`. Foram inspecionadas as composições desktop/mobile e os assets locais, corrigindo os desvios identificados. O assert desktop exige provedores com 45px, o mobile exige 65px e cartões com 93px. Relatório HTML: `playwright-report/index.html`. Esses artefatos são ignorados pelo Git, conforme configuração existente; a última suíte regenera o relatório.

Sem pendências funcionais conhecidas neste escopo. Nenhuma dependência foi adicionada. Os limites da simulação e as diferenças deliberadas de UI estão registrados abaixo.

Primeira rodada direcionada: 46/48. O cartão mobile tinha 97px por causa do padding, corrigido para 93px mantendo o assert. O teste novo de metadados assumia incremento unitário, mas o handler existente toca a principal ao redefini-la e ao atualizá-la; o assert agora verifica o incremento efetivo e acrescenta rejeição da versão antiga. A revisão das capturas identificou a navegação duplicada e a especificidade dos estilos legados, corrigidas antes da rodada final.

## Limitações

### Ocorrências intermediárias adicionais

Uma rodada completa de preview terminou 179/183: três testes precisavam abrir a seção mobile antes de conferir o mesmo resumo financeiro, e o nome da carteira foi separado visualmente do badge para preservar seu texto acessível. As verificações de valores, isolamento e persistência foram mantidas. Outra execução completa de preview passou 186/186 antes do ajuste final dos provedores desktop.

Uma rodada direcionada terminou 50/52 com ausência de módulos/tela durante uma sobreposição indevida do build demo e do preview, erro de orquestração. Essa rodada não é considerada aprovada. As validações finais usam builds e servidores estritamente sequenciais.

O novo assert de altura desktop detectou 49,5px no badge WalletConnect; a rodada de desenvolvimento foi interrompida após identificar essa causa, sem tratá-la como aprovada. Badge e padding foram corrigidos mantendo a expectativa de 45px. Os quatro casos de medidas/compra em desenvolvimento passaram depois da correção (390/414/768/1440px, 4/4, sem retries), antes das duas suítes completas finais.

### Limites da demonstração

Tudo continua demonstrativo: sem conexão a extensões, OAuth de carteira, assinatura ou transferência real. As unidades e regras financeiras anteriores não foram convertidas por rede. Não houve inspeção da base IndexedDB privada do usuário nem validação de blockchain. Revisão/testes no Chromium; outros navegadores e leitores de tela não foram auditados nesta rodada.
