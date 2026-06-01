"use client";

import Link from "next/link";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { EmptyState, StateNotice } from "@/components/ReadState";
import { WalletConnect } from "@/components/WalletConnect";
import { arcTestnet } from "@/lib/chains/arc";
import { useArcVoucherOrders } from "@/lib/contracts/orderReads";
import { formatUsdc, shortAddress } from "@/lib/format";

export function OrdersView() {
  const { error, isConnected, isError, isLoading, orders, refetch } = useArcVoucherOrders();

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-200">Orders</p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">Order history</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04]"
            type="button"
            onClick={() => void refetch()}
          >
            Refresh
          </button>
          <WalletConnect />
        </div>
      </section>

      {!isConnected ? (
        <EmptyState title="Connect wallet" message="Connect the wallet you used at checkout to view ArcVoucher purchases." />
      ) : null}

      {isConnected && isLoading ? <OrdersLoading /> : null}

      {isConnected && isError ? (
        <StateNotice title="Could not load orders" message={error?.message ?? "Arc Testnet event reads failed. Try refreshing shortly."} />
      ) : null}

      {isConnected && !isLoading && !isError && orders.length === 0 ? (
        <EmptyState title="No orders yet" message="Purchases made from this wallet will appear here after the OrderPaid event is indexed." />
      ) : null}

      {isConnected && !isLoading && !isError && orders.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="hidden border-b border-white/10 px-4 py-3 text-sm font-semibold text-zinc-400 md:grid md:grid-cols-[80px_1.2fr_100px_130px_110px_120px_90px] md:gap-4">
            <span>ID</span>
            <span>Product</span>
            <span>Product ID</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Created</span>
            <span>Tx</span>
          </div>
          {orders.map((order) => {
            const explorerTxUrl = order.txHash ? `${arcTestnet.blockExplorers.default.url}/tx/${order.txHash}` : undefined;

            return (
              <article
                className="grid gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[80px_1.2fr_100px_130px_110px_120px_90px] md:items-center md:gap-4"
                key={order.id}
              >
                <Link className="text-sm font-semibold text-emerald-200 hover:underline" href={`/orders/${order.id}`}>
                  #{order.id}
                </Link>
                <div>
                  <Link className="font-medium text-white hover:underline" href={`/orders/${order.id}`}>
                    {order.productName}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500 md:hidden">Product #{order.productId}</p>
                </div>
                <span className="hidden text-sm text-zinc-300 md:block">#{order.productId}</span>
                <span className="text-sm text-zinc-300">{formatUsdc(order.amountPaid)}</span>
                <OrderStatusBadge status={order.status} />
                <span className="text-sm text-zinc-400">{order.createdAt}</span>
                {explorerTxUrl && order.txHash ? (
                  <a className="text-sm font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline" href={explorerTxUrl} rel="noreferrer" target="_blank">
                    {shortAddress(order.txHash)}
                  </a>
                ) : (
                  <span className="text-sm text-zinc-500">Pending</span>
                )}
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

function OrdersLoading() {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="grid animate-pulse gap-4 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[80px_1.2fr_100px_130px_110px_120px_90px]" key={index}>
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <div className="h-5 rounded bg-white/[0.06]" key={cellIndex} />
          ))}
        </div>
      ))}
    </section>
  );
}
