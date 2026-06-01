"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { WalletConnect } from "@/components/WalletConnect";
import { arcTestnet } from "@/lib/chains/arc";
import { useArcVoucherProduct } from "@/lib/contracts/productReads";
import { formatUsdc, shortAddress } from "@/lib/format";
import { useIntentStatus, useIntentVoucherReveal } from "@/lib/intents";

export function UnifiedOrderDetailView({ intentId }: { intentId: string }) {
  const { address, isConnected } = useAccount();
  const [revealRequested, setRevealRequested] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const intentQuery = useIntentStatus(intentId);
  const intent = intentQuery.data?.intent;
  const productId = intent ? Number(intent.productId) : 0;
  const { product } = useArcVoucherProduct(productId);
  const voucherQuery = useIntentVoucherReveal({
    buyer: address,
    enabled: Boolean(isConnected && intent && isIntentFulfilled(intent.status) && revealRequested),
    intentId
  });

  function handleRefresh() {
    void intentQuery.refetch();
    if (revealRequested) {
      void voucherQuery.refetch();
    }
  }

  async function handleCopyVoucher(code: string) {
    await navigator.clipboard?.writeText(code);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  if (intentQuery.isLoading) {
    return <LoadingProductDetail />;
  }

  if (intentQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <StateNotice title="Could not load Unified Balance order" message={intentQuery.error?.message ?? "Order details are not available. Try refreshing shortly."} />
      </main>
    );
  }

  if (!intent) {
    return (
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Unified Balance order not found" message={`Order #${intentId} is not available.`} />
      </main>
    );
  }

  const productName = product?.name ?? `Product #${intent.productId}`;
  const paymentTxUrl = intent.spendTxHash ? `${arcTestnet.blockExplorers.default.url}/tx/${intent.spendTxHash}` : undefined;
  const fulfilled = isIntentFulfilled(intent.status);
  const reveal = voucherQuery.data;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-violet-700 dark:text-violet-200">Unified Balance Order</p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950 sm:text-5xl dark:text-white">{productName}</h1>
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
              <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-white">{formatUsdc(BigInt(intent.spendAmount ?? intent.expectedAmount))}</p>
            </div>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 dark:border-violet-300/30 dark:bg-violet-300/10 dark:text-violet-100">
              Unified Balance
            </span>
          </div>

          <dl className="grid gap-4 py-5 sm:grid-cols-2">
            <DetailItem label="Product" value={productName} />
            <DetailItem label="Payment Method" value="Unified Balance" />
            <DetailItem label="Purchase Date" value={formatDate(intent.createdAt)} />
            <DetailItem label="Status" value={getIntentStatusLabel(intent.status)} />
          </dl>

          <details className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-white">Payment details</summary>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <DetailItem label="Order number" value={`#${intent.intentId}`} compact />
              <DetailItem label="Product ID" value={`#${intent.productId}`} compact />
              <DetailItem label="Buyer" value={shortAddress(intent.buyer)} compact />
              <DetailItem label="Voucher ID" value={intent.voucherId ?? "Pending"} compact />
              <DetailItem label="Updated" value={formatDate(intent.updatedAt)} compact />
            </dl>
            {paymentTxUrl && intent.spendTxHash ? (
              <a
                className="mt-4 block rounded-md border border-zinc-200 bg-white p-3 text-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/[0.04]"
                href={paymentTxUrl}
                rel="noreferrer"
                target="_blank"
              >
                <span className="block font-semibold text-zinc-950 dark:text-white">Payment transaction</span>
                <span className="mt-2 block break-all text-xs text-zinc-500 dark:text-zinc-400">{intent.spendTxHash}</span>
                <span className="mt-3 inline-flex text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-200">
                  View on ArcScan
                </span>
              </a>
            ) : null}
          </details>
        </section>

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

            {isConnected && !fulfilled ? <StateNotice title="Voucher pending" message="Your voucher is being prepared. This usually takes under a minute." /> : null}

            {isConnected && fulfilled && !revealRequested ? (
              <button
                className="min-h-11 w-full rounded-md bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 dark:bg-emerald-300 dark:text-zinc-950 dark:hover:bg-emerald-200"
                type="button"
                onClick={() => setRevealRequested(true)}
              >
                Reveal Voucher
              </button>
            ) : null}

            {isConnected && fulfilled && revealRequested && voucherQuery.isLoading ? (
              <div className="animate-pulse rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-white/[0.06]" />
                <div className="mt-4 h-10 rounded bg-zinc-200 dark:bg-white/[0.06]" />
              </div>
            ) : null}

            {isConnected && fulfilled && reveal?.status === "ready" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-300/25 dark:bg-emerald-300/10">
                <p className="text-sm font-semibold text-zinc-950 dark:text-white">{productName}</p>
                <p className="mt-4 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-200">Voucher Code</p>
                <code className="mt-2 block break-all rounded-md bg-white px-3 py-4 text-base font-semibold text-zinc-950 shadow-sm dark:bg-zinc-950/70 dark:text-white">
                  {reveal.voucher.voucherCode}
                </code>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800 dark:bg-emerald-300 dark:text-zinc-950"
                    type="button"
                    onClick={() => void handleCopyVoucher(reveal.voucher.voucherCode)}
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

            {isConnected && fulfilled && revealRequested && reveal && reveal.status !== "ready" ? (
              <StateNotice title={reveal.status === "forbidden" ? "Wrong wallet" : "Voucher pending"} message={reveal.message} />
            ) : null}
          </div>
        </section>
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

function isIntentFulfilled(status: string) {
  return status === "voucher_fulfilled";
}

function getIntentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: "Cancelled",
    created: "Payment pending",
    failed: "Failed",
    paid: "Preparing Voucher",
    refunded: "Refunded",
    voucher_fulfilled: "Voucher Ready"
  };

  return labels[status] ?? status;
}

function formatDate(value: string) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(timestamp);
}
