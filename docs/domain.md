# Mock domain

The REST contracts live in `src/shared/contracts/marketplace.ts` and `docs/rest-contracts.md`. All business fixtures and rules stay under `src/mocks`. Components do not own mock responses.

## Persistence and isolation

The repository stores one structured domain record in IndexedDB database `kurio-mock-domain-v2`. Request operations read a fresh draft and write only after success. Validation failures roll back changes. Configured failure consumption and timeout-after-create explicitly persist before returning an error. A local serial queue plus the Web Locks API protects read/modify/write operations across browser tabs. IndexedDB and Web Locks require a supported browser in a secure context; localhost is supported. This is browser-local demonstration storage, not a remote backend.

Ana (`ana@kurio.demo`) and Bruno (`bruno@kurio.demo`) start with separate profiles, wallets, empty carts and favorites. Both demonstration passwords are `Kurio123!`. Persisted credentials contain randomly salted PBKDF2-SHA256 hashes with 100,000 iterations, never plaintext passwords. Session tokens and expiry are persisted in the mock repository. Authorization is `Bearer`; visitors send `X-Guest-Id`. Login and registration merge the guest cart into the account cart, limit quantities to available inventory and consume the guest cart, preventing duplicate merges.

## Catalog and money

There are 36 NFTs, nine categories and three networks. The first eight artworks/names/prices come from the Figma reference; further entries provide pagination and filter coverage while reusing local original artwork assets. Gallery entries use the same NFT artwork. List filters combine with AND; price ranges include bounds, malformed/reversed ranges return 422. Facets show global seed counts. New means created on or after 2026-10-01; trending means at least 100 reviews.

ETH amounts are decimal strings at REST boundaries and BigInt wei internally (`money.ts`). Fees are 250 basis points on the discounted subtotal. Discounts and fees round down to whole wei. `KURIO10` discounts 10% with a 0.1 ETH minimum; `EXPIRED` verifies expiry validation. Quotes capture cart, NFT and edition versions, current stock, prices and a TTL. Orders reject expired or stale quotes and incompatible wallet networks.

Orders copy immutable financial snapshots; confirmed receipts copy those snapshots rather than rebuilding from the catalog. Idempotency keys are scoped to users, survive refresh, compare normalized quote/wallet payloads, and recover the original order even after its quote expires or its cart changes. Reusing the key with a different payload returns 409. Only confirmation consumes stock and purchased cart quantities, after rechecking availability; pending and declined orders retain them. Later additions remain in the cart. Mutable resources expose version and updatedAt; the persisted outbox publishes nft.updated/order.updated through MSW/Socket.IO.

## Deterministic scenarios

`POST /api/__mock/reset` reseeds all domain data and scenarios. It bypasses configured delay/failure rules. `GET` or `PATCH /api/__mock/scenario` reads or updates:

- `latencyMs`: artificial request delay, default 120.
- `failures`: `{path, method?, status, remaining}` entries. Paths match exactly or use a terminal `*` prefix wildcard. The first matching entry consumes one remaining failure persistently. Supported statuses: 401, 403, 409, 422, 503.
- `orderOutcome`: pending, confirmed, declined or timeout-after-create.
- `sessionTtlMs` and `quoteTtlMs`: expiry controls; zero allows deterministic expiry tests.

Timeout-after-create persists a confirmed order, stock effects, receipt and idempotency record, releases the repository lock, then delays its response by 12 seconds before returning 503 with TRANSIENT_ERROR and retryable=true. The Axios client times out after 10 seconds, so the scenario produces an observable network timeout after creation. Browser requests with an AbortController can also abort before the delayed response. Retrying the same key immediately recovers the persisted order without waiting for the original response. Since Phase 4, pending-confirmed/pending-declined persist a resolution deadline; subsequent transactions resolve expired deadlines, including after reload. The outbox delivers events and REST remains the recovery authority.

Scenario/reset endpoints exist only while MSW is enabled. Existing diagnostic HTTP and Socket.IO handlers remain first in handler order, followed by the REST domain handler.

## Verification

`tests/domain.spec.ts` exercises APIs through browser fetch and MSW: user isolation, guest merge, exact financial totals, timeout recovery, idempotency payload conflicts and refresh, stock limits, stale quote, expired coupon/session, version conflicts, consumed transient failures, cross-tab concurrent creation, transactional rollback, registration/profile/avatar/password, wallet creation and pending/declined outcomes. Catalog/UI tests separately verify Axios integration. Run the complete Playwright suite in development and demo production preview as described in README.
