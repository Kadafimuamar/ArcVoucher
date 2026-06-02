"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { BrandedGiftCard } from "@/components/BrandedGiftCard";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { WalletConnect } from "@/components/WalletConnect";
import { arcTestnet } from "@/lib/chains/arc";
import { useArcVoucherOrder } from "@/lib/contracts/orderReads";
import { formatUsdc, shortAddress } from "@/lib/format";
import { useVoucherReveal } from "@/lib/vouchers";

export function OrderDetailView({ orderId }: { orderId: number }) {
  const { address, isConnected } = useAccount();
  const [revealRequested, setRevealRequested] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const { error, isError, isLoading, order, refetch } = useArcVoucherOrder(orderId);
  const voucherQuery = useVoucherReveal({
    buyer: address,
    enabled: Boolean(order && order.status === "Fulfilled" && isConnected && revealRequested),
    orderId
  });

  function handleRefresh() {
    void refetch();

    if (order?.status === "Fulfilled" && isConnected && revealRequested) {
      void voucherQuery.refetch();
    }
  }

  async function handleCopyVoucher(code: string) {
    await navigator.clipboard?.writeText(code);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  if (isLoading) {
    return <LoadingProductDetail />;
  }

  if (isError) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <StateNotice title="Could not load order" message={error?.message ?? "Arc Testnet order read failed. Try refreshing shortly."} />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Order not found" message={`Order #${orderId} is not available from the contract.`} />
      </main>
    );
  }

  const paymentTxUrl = order.txHash ? `${arcTestnet.blockExplorers.default.url}/tx/${order.txHash}` : undefined;
  const fulfillmentTxUrl = order.fulfilledTxHash ? `${arcTestnet.blockExplorers.default.url}/tx/${order.fulfilledTxHash}` : undefined;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700 dark:text-emerald-200">Direct Arc Order</p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950 sm:text-5xl dark:text-white">{order.productName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="min-h-11 rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
            type="button"
            onClick={handleRefresh}
          >
            Refresh
          </button>
          <WalletConnect />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Amount</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{formatUsdc(order.amountPaid)}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <dl className="grid gap-4 py-5 sm:grid-cols-2">
            <DetailItem label="Product" value={order.productName} />
            <DetailItem label="Payment Method" value="Direct Arc" />
            <DetailItem label="Purchase Date" value={order.createdAt} />
            <DetailItem label="Status" value={order.status === "Fulfilled" ? "Voucher Ready" : order.status} />
          </dl>

          <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-white">Payment details</summary>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <DetailItem label="Order ID" value={`#${order.id}`} compact />
              <DetailItem label="Product ID" value={`#${order.productId}`} compact />
              <DetailItem label="Buyer" value={shortAddress(order.buyer)} compact />
              <DetailItem label="Voucher hash" value={order.voucherHash === zeroHash ? "Not set" : shortAddress(order.voucherHash)} compact />
            </dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {paymentTxUrl && order.txHash ? (
                <TransactionLink label="Payment transaction" txHash={order.txHash} url={paymentTxUrl} />
              ) : (
                <p className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-400">
                  Payment transaction hash is not available yet.
                </p>
              )}
              {fulfillmentTxUrl && order.fulfilledTxHash ? (
                <TransactionLink label="Fulfillment transaction" txHash={order.fulfilledTxHash} url={fulfillmentTxUrl} />
              ) : (
                <p className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-400">
                  Fulfillment transaction appears after the voucher is issued.
                </p>
              )}
            </div>
          </details>
        </section>

        <VoucherPanel
          copyState={copyState}
          isConnected={isConnected}
          orderStatus={order.status}
          productName={order.productName}
          query={voucherQuery}
          revealRequested={revealRequested}
          onCopyVoucher={handleCopyVoucher}
          onReveal={() => setRevealRequested(true)}
        />
      </div>

      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/[0.04]"
        href="/orders"
      >
        Back to orders
      </Link>
    </main>
  );
}

function DetailItem({ compact = false, label, value }: { compact?: boolean; label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`mt-1 break-all font-semibold text-zinc-950 dark:text-white ${compact ? "text-sm" : "text-base"}`}>{value}</dd>
    </div>
  );
}

function TransactionLink({ label, txHash, url }: { label: string; txHash: string; url: string }) {
  return (
    <a
      className="rounded-md border border-zinc-200 bg-white p-3 text-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/[0.04]"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="block font-semibold text-zinc-950 dark:text-white">{label}</span>
      <span className="mt-2 block break-all text-xs text-zinc-500 dark:text-zinc-400">{txHash}</span>
      <span className="mt-3 inline-flex text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">View on ArcScan</span>
    </a>
  );
}

function VoucherPanel({
  copyState,
  isConnected,
  orderStatus,
  productName,
  query,
  revealRequested,
  onCopyVoucher,
  onReveal
}: {
  copyState: "idle" | "copied";
  isConnected: boolean;
  orderStatus: "Paid" | "Fulfilled" | "Refunded";
  productName: string;
  query: ReturnType<typeof useVoucherReveal>;
  revealRequested: boolean;
  onCopyVoucher: (code: string) => Promise<void>;
  onReveal: () => void;
}) {
  const reveal = query.data;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/70 dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-black/30">
      <div className="border-b border-zinc-200 pb-5 dark:border-white/10">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Voucher</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">Secure reveal</h2>
      </div>

      <div className="space-y-4 pt-5">
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect the purchasing wallet to reveal this voucher.</p>
            <WalletConnect />
          </div>
        ) : null}

        {isConnected && orderStatus === "Paid" ? <StateNotice title="Voucher pending" message="Your voucher is being prepared. This usually takes under a minute." /> : null}

        {isConnected && orderStatus === "Refunded" ? <StateNotice title="Voucher unavailable" message="This order was refunded." /> : null}

        {isConnected && orderStatus === "Fulfilled" && !revealRequested ? (
          <button
            className="min-h-11 w-full rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
            type="button"
            onClick={onReveal}
          >
            Reveal Voucher
          </button>
        ) : null}

        {isConnected && orderStatus === "Fulfilled" && revealRequested && query.isLoading ? (
          <div className="animate-pulse rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-white/[0.06]" />
            <div className="mt-4 h-10 rounded bg-zinc-200 dark:bg-white/[0.06]" />
          </div>
        ) : null}

        {isConnected && orderStatus === "Fulfilled" && reveal?.status === "ready" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-300/25 dark:bg-emerald-300/10">
            <BrandedGiftCard className="shadow-none" name={productName} voucherCode={reveal.voucher.voucherCode} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800 dark:bg-emerald-300 dark:text-zinc-950"
                type="button"
                onClick={() => void onCopyVoucher(reveal.voucher.voucherCode)}
              >
                {copyState === "copied" ? "Copied" : "Copy"}
              </button>
              <Link
                className="flex min-h-11 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:bg-white dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.04]"
                href="/orders"
              >
                Back to Orders
              </Link>
            </div>
          </div>
        ) : null}

        {isConnected && orderStatus === "Fulfilled" && revealRequested && reveal && reveal.status !== "ready" ? (
          <StateNotice title={reveal.status === "forbidden" ? "Wrong wallet" : "Voucher pending"} message={reveal.message} />
        ) : null}
      </div>
    </section>
  );
}

const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
