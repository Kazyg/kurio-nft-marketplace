import { Link } from '@tanstack/react-router'
import type { FinancialSnapshot, Order } from '@/shared/contracts/marketplace'
import { useOrder, useOrders } from '@/shared/api/order-hooks'
import { NetworkError } from '@/shared/ui/network-feedback'
import { Button } from '@/shared/ui/button'
import { nftImageProps } from '@/shared/lib/nft-image'
import '../checkout/checkout.css'

export function FinancialSummary({
  snapshot,
}: {
  snapshot: FinancialSnapshot
}) {
  return (
    <div className="purchase-financial">
      <ul>
        {snapshot.lines.map((line) => (
          <li key={`${line.nftId}:${line.editionId}`}>
            <img
              {...nftImageProps(line.image, '72px')}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span>
              {line.name}
              <small>
                {line.editionLabel} × {line.quantity}
              </small>
              <small>{line.unitPriceEth} ETH / edição</small>
            </span>
            <b>{line.totalEth} ETH</b>
          </li>
        ))}
      </ul>
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{snapshot.subtotalEth} ETH</dd>
        </div>
        <div>
          <dt>Desconto{snapshot.coupon ? ` · ${snapshot.coupon.code}` : ''}</dt>
          <dd>{snapshot.discountEth} ETH</dd>
        </div>
        <div>
          <dt>Taxa de rede</dt>
          <dd>{snapshot.feeEth} ETH</dd>
        </div>
        <div className="purchase-total">
          <dt>Total</dt>
          <dd data-testid="purchase-total">{snapshot.totalEth} ETH</dd>
        </div>
      </dl>
    </div>
  )
}
export function OrderStatus({ order }: { order: Order }) {
  return (
    <div
      className={`purchase-status ${order.status}`}
      role={order.status === 'declined' ? 'alert' : 'status'}
    >
      {order.status === 'confirmed' && (
        <div className="receipt-thank-you" aria-hidden="true">
          <img src="/assets/figma/confirmation-thank-you.svg" alt="" />
        </div>
      )}
      <h2>
        {order.status === 'confirmed'
          ? 'Pedido confirmado'
          : order.status === 'declined'
            ? 'Pedido recusado'
            : 'Pedido pendente'}
      </h2>
      <p>
        {order.status === 'pending'
          ? 'Seu pedido está sendo processado. Você pode atualizar esta página: a compra será recuperada sem duplicação.'
          : order.status === 'declined'
            ? order.attempts.at(-1)?.reason ||
              'O pagamento foi recusado. Seus itens foram preservados no carrinho.'
            : 'Seu pedido foi confirmado.'}
      </p>
    </div>
  )
}
export function OrderReceipt({ order }: { order: Order }) {
  return (
    <div className="purchase-receipt">
      <OrderStatus order={order} />
      <dl className="purchase-metadata">
        <div>
          <dt>Pedido</dt>
          <dd title={order.id}>{order.id}</dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>{new Date(order.createdAt).toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Carteira</dt>
          <dd title={`${order.wallet.label} · ${order.wallet.address}`}>
            {order.wallet.label} · {order.wallet.address}
          </dd>
        </div>
        <div>
          <dt>Rede</dt>
          <dd>{order.network}</dd>
        </div>
        {order.status === 'confirmed' && (
          <div>
            <dt>ID da transação</dt>
            <dd title={order.transactionReference}>
              {order.transactionReference}
            </dd>
          </div>
        )}
      </dl>
      <FinancialSummary snapshot={order.receipt?.snapshot || order.snapshot} />
    </div>
  )
}
export function OrderConfirmationReceipt({ order }: { order: Order }) {
  const snapshot = order.receipt?.snapshot || order.snapshot
  return (
    <div className="purchase-receipt receipt-modal-content">
      <header className="receipt-confirmation-header">
        <div className="receipt-thank-you" aria-hidden="true">
          <img src="/assets/figma/confirmation-thank-you.svg" alt="" />
        </div>
        <h2 className="sr-only">Pedido confirmado</h2>
        <p>Seus NFTs agora estão na sua carteira.</p>
      </header>
      <dl className="receipt-confirmation-metadata">
        <div>
          <dt>ID da transação</dt>
          <dd title={order.transactionReference}>
            {order.transactionReference}
          </dd>
        </div>
        <div>
          <dt>Data</dt>
          <dd>{new Date(order.createdAt).toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{snapshot.totalEth} ETH</dd>
        </div>
        <div>
          <dt>Carteira</dt>
          <dd title={`${order.wallet.label} · ${order.wallet.address}`}>
            {order.wallet.label} · {order.wallet.address}
          </dd>
        </div>
      </dl>
      <section
        className="receipt-confirmation-details"
        aria-label="Detalhes da transação"
      >
        <h3>Detalhes da transação</h3>
        <p className="receipt-order-reference">Pedido {order.id}</p>
        <table>
          <thead>
            <tr>
              <th>NFT</th>
              <th>Edições</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.lines.map((line) => (
              <tr key={`${line.nftId}:${line.editionId}`}>
                <td>
                  <img {...nftImageProps(line.image, '70px')} alt="" />
                  <span>
                    {line.name}
                    <small>{line.editionLabel}</small>
                  </span>
                </td>
                <td>{line.quantity}</td>
                <td>{line.totalEth} ETH</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="receipt-confirmation-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{snapshot.subtotalEth} ETH</dd>
          </div>
          <div>
            <dt>
              Desconto{snapshot.coupon ? ` · ${snapshot.coupon.code}` : ''}
            </dt>
            <dd>{snapshot.discountEth} ETH</dd>
          </div>
          <div>
            <dt>Taxa de rede</dt>
            <dd>{snapshot.feeEth} ETH</dd>
          </div>
          <div>
            <dt>Total final</dt>
            <dd data-testid="purchase-total">{snapshot.totalEth} ETH</dd>
          </div>
        </dl>
        <Button asChild>
          <Link to="/orders/$orderId" params={{ orderId: order.id }}>
            Consultar transação simulada
          </Link>
        </Button>
      </section>
    </div>
  )
}
export function OrdersPage() {
  const orders = useOrders()
  return (
    <>
      <div className="purchase-heading">
        <span>CONTA DO COLECIONADOR</span>
        <h1>Meus pedidos</h1>
        <p>Acompanhe suas compras e seus recibos.</p>
      </div>
      {orders.isPending ? (
        <p role="status">Carregando pedidos…</p>
      ) : orders.isError ? (
        <NetworkError
          title="Não foi possível carregar os pedidos"
          error={orders.error}
          retry={() => void orders.refetch()}
        />
      ) : !orders.data.length ? (
        <div className="purchase-panel">
          <h2>Você ainda não tem pedidos</h2>
          <Button asChild>
            <Link to="/">Explorar NFTs</Link>
          </Button>
        </div>
      ) : (
        <div className="purchase-order-list">
          {orders.data.map((order) => (
            <article className="purchase-panel" key={order.id}>
              <OrderStatus order={order} />
              <p>{order.id}</p>
              <p>
                {new Date(order.createdAt).toLocaleString('pt-BR')} ·{' '}
                {order.snapshot.totalEth} ETH
              </p>
              <Button asChild variant="outline">
                <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                  Ver pedido
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
export function OrderPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)
  return (
    <section className="purchase-page">
      <div className="purchase-heading">
        <span>CONTA DO COLECIONADOR</span>
        <h1>Detalhes do pedido</h1>
      </div>
      {order.isPending ? (
        <p role="status">Carregando pedido…</p>
      ) : order.isError ? (
        <NetworkError
          title="Não foi possível carregar o pedido"
          error={order.error}
          retry={() => void order.refetch()}
        />
      ) : (
        <div className="purchase-panel">
          <OrderReceipt order={order.data} />
        </div>
      )}
      <Link to="/orders">← Meus pedidos</Link>
    </section>
  )
}
