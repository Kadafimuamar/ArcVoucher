"use client";

import Image from "next/image";
import Link from "next/link";
import { EmptyState, StateNotice } from "@/components/ReadState";
import { WalletConnect } from "@/components/WalletConnect";
import { formatUsdc } from "@/lib/format";
import { getBrandVisualFromProductName } from "@/lib/products/brandVisuals";
import { useUnifiedOrders, type UnifiedOrder, type UnifiedOrderSource, type UnifiedOrderStatus } from "@/lib/unifiedOrders";

export function OrdersView() {
  const { error, isConnected, isError, isLoading, orders, refetch } = useUnifiedOrders();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-200">Orders</p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950 sm:text-5xl dark:text-white">Order history</h1>
          <p className="mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
            Direct Arc and Unified Balance gift card purchases appear together here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="min-h-11 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
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
        <StateNotice title="Could not load orders" message={error?.message ?? "ArcVoucher order history is not available. Try refreshing shortly."} />
      ) : null}

      {isConnected && !isLoading && !isError && orders.length === 0 ? (
        <EmptyState title="No orders yet" message="Your gift card purchases will appear here after checkout." />
      ) : null}

      {isConnected && !isLoading && !isError && orders.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
          <div className="hidden border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500 dark:border-white/10 dark:text-zinc-400 md:grid md:grid-cols-[1.5fr_170px_130px_130px_120px] md:gap-4">
            <span>Product</span>
            <span>Payment Method</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {orders.map((order) => {
            const orderHref = getOrderHref(order);
            const visual = getBrandVisualFromProductName(order.productName);

            return (
              <article
                className="grid gap-3 border-b border-zinc-100 px-4 py-4 last:border-b-0 dark:border-white/5 md:grid-cols-[1.5fr_170px_130px_130px_120px] md:items-center md:gap-4"
                key={`${order.source}:${order.orderId}`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-16 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white p-1.5 dark:border-white/10">
                    <Image alt={`${visual.name} logo`} className="max-h-8 max-w-full object-contain" height={64} src={visual.logoPath} width={180} />
                  </div>
                  <div>
                    <Link className="font-semibold text-zinc-950 underline-offset-4 hover:underline dark:text-white" href={orderHref}>
                      {order.productName}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">Product #{order.productId}</p>
                  </div>
                </div>
                <SourceBadge source={order.source} />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">{formatUsdc(BigInt(order.amount))}</span>
                <UnifiedStatusBadge status={order.status} />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{formatCreatedAt(order.createdAt)}</span>
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
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="grid animate-pulse gap-4 border-b border-zinc-100 px-4 py-4 last:border-b-0 dark:border-white/5 md:grid-cols-[1.5fr_170px_130px_130px_120px]" key={index}>
          {Array.from({ length: 5 }).map((__, cellIndex) => (
            <div className="h-5 rounded bg-zinc-100 dark:bg-white/[0.06]" key={cellIndex} />
          ))}
        </div>
      ))}
    </section>
  );
}

function SourceBadge({ source }: { source: UnifiedOrderSource }) {
  const label = source === "direct" ? "Direct Arc" : "Unified Balance";
  const tone =
    source === "direct"
      ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/30 dark:bg-sky-300/10 dark:text-sky-100"
      : "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-300/30 dark:bg-violet-300/10 dark:text-violet-100";

  return <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function UnifiedStatusBadge({ status }: { status: UnifiedOrderStatus }) {
  const tone = {
    cancelled: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-200",
    failed: "border-red-200 bg-red-50 text-red-800 dark:border-red-300/30 dark:bg-red-300/10 dark:text-red-100",
    fulfilled: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100",
    paid: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/30 dark:bg-sky-300/10 dark:text-sky-100",
    refunded: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-200"
  }[status];

  return <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{getStatusLabel(status)}</span>;
}

function getOrderHref(order: UnifiedOrder) {
  return order.source === "unified-balance" ? `/orders/unified/${order.orderId.replace(/^intent:/, "")}` : `/orders/${order.orderId}`;
}

function getStatusLabel(status: UnifiedOrderStatus) {
  const labels: Record<UnifiedOrderStatus, string> = {
    cancelled: "Cancelled",
    failed: "Failed",
    fulfilled: "Voucher Ready",
    paid: "Preparing",
    refunded: "Refunded"
  };

  return labels[status];
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
    month: "short",
    year: "numeric"
  }).format(timestamp);
}
