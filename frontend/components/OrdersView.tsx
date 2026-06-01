"use client";

import Link from "next/link";
import { EmptyState, StateNotice } from "@/components/ReadState";
import { WalletConnect } from "@/components/WalletConnect";
import { arcTestnet } from "@/lib/chains/arc";
import { formatUsdc, shortAddress } from "@/lib/format";
import { useUnifiedOrders, type UnifiedOrder, type UnifiedOrderSource, type UnifiedOrderStatus } from "@/lib/unifiedOrders";

export function OrdersView() {
  const { error, isConnected, isError, isLoading, orders, refetch } = useUnifiedOrders();

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
        <EmptyState title="No orders yet" message="Direct Arc and Unified Balance purchases made from this wallet will appear here." />
      ) : null}

      {isConnected && !isLoading && !isError && orders.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="hidden border-b border-white/10 px-4 py-3 text-sm font-semibold text-zinc-400 md:grid md:grid-cols-[110px_1.2fr_130px_120px_120px_120px_90px] md:gap-4">
            <span>ID</span>
            <span>Product</span>
            <span>Method</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Created</span>
            <span>Tx</span>
          </div>
          {orders.map((order) => {
            const explorerTxUrl = order.txHash ? `${arcTestnet.blockExplorers.default.url}/tx/${order.txHash}` : undefined;
            const orderHref = getOrderHref(order);

            return (
              <article
                className="grid gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[110px_1.2fr_130px_120px_120px_120px_90px] md:items-center md:gap-4"
                key={`${order.source}:${order.orderId}`}
              >
                <Link className="text-sm font-semibold text-emerald-200 hover:underline" href={orderHref}>
                  {formatOrderId(order)}
                </Link>
                <div>
                  <Link className="font-medium text-white hover:underline" href={orderHref}>
                    {order.productName}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500 md:hidden">Product #{order.productId}</p>
                </div>
                <SourceBadge source={order.source} />
                <span className="text-sm text-zinc-300">{formatUsdc(BigInt(order.amount))}</span>
                <UnifiedStatusBadge status={order.status} />
                <span className="text-sm text-zinc-400">{formatCreatedAt(order.createdAt)}</span>
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
        <div className="grid animate-pulse gap-4 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[110px_1.2fr_130px_120px_120px_120px_90px]" key={index}>
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <div className="h-5 rounded bg-white/[0.06]" key={cellIndex} />
          ))}
        </div>
      ))}
    </section>
  );
}

function SourceBadge({ source }: { source: UnifiedOrderSource }) {
  const label = source === "direct" ? "Direct Arc" : "Unified Balance";
  const tone = source === "direct" ? "border-sky-300/30 bg-sky-300/10 text-sky-100" : "border-violet-300/30 bg-violet-300/10 text-violet-100";

  return <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function UnifiedStatusBadge({ status }: { status: UnifiedOrderStatus }) {
  const tone = {
    cancelled: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200",
    failed: "border-red-300/30 bg-red-300/10 text-red-100",
    fulfilled: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    paid: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    refunded: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200"
  }[status];

  return <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold capitalize ${tone}`}>{status.replace("-", " ")}</span>;
}

function getOrderHref(order: UnifiedOrder) {
  return order.source === "unified-balance" ? `/orders/unified/${order.orderId.replace(/^intent:/, "")}` : `/orders/${order.orderId}`;
}

function formatOrderId(order: UnifiedOrder) {
  return order.source === "unified-balance" ? order.orderId : `#${order.orderId}`;
}

function formatCreatedAt(createdAt: string | undefined) {
  if (!createdAt) {
    return "Unknown";
  }

  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(timestamp);
}
