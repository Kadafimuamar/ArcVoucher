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

  if (intentQuery.isLoading) {
    return <LoadingProductDetail />;
  }

  if (intentQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <StateNotice title="Could not load Unified Balance order" message={intentQuery.error?.message ?? "Backend intent read failed. Try refreshing shortly."} />
      </main>
    );
  }

  if (!intent) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Unified Balance order not found" message={`Intent #${intentId} is not available from the backend.`} />
      </main>
    );
  }

  const productName = product?.name ?? `Product #${intent.productId}`;
  const paymentTxUrl = intent.spendTxHash ? `${arcTestnet.blockExplorers.default.url}/tx/${intent.spendTxHash}` : undefined;
  const fulfilled = isIntentFulfilled(intent.status);
  const reveal = voucherQuery.data;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-violet-200">Unified Balance Order intent:{intent.intentId}</p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">{productName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="min-h-10 rounded-full border border-white/10 px-4 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04]"
            type="button"
            onClick={handleRefresh}
          >
            Refresh
          </button>
          <WalletConnect />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-sm text-zinc-400">Payment</p>
              <p className="mt-2 text-2xl font-semibold text-violet-200">{formatUsdc(BigInt(intent.spendAmount ?? intent.expectedAmount))}</p>
            </div>
            <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-100">
              Unified Balance
            </span>
          </div>

          <dl className="grid gap-4 py-5 sm:grid-cols-2">
            <DetailItem label="Order ID" value={`intent:${intent.intentId}`} />
            <DetailItem label="Product" value={productName} />
            <DetailItem label="Product ID" value={`#${intent.productId}`} />
            <DetailItem label="Payment method" value="Unified Balance" />
            <DetailItem label="Status" value={getIntentStatusLabel(intent.status)} />
            <DetailItem label="Buyer" value={shortAddress(intent.buyer)} />
            <DetailItem label="Created" value={formatDate(intent.createdAt)} />
            <DetailItem label="Verified" value={intent.spendConfirmedAt ? formatDate(intent.spendConfirmedAt) : "Pending"} />
          </dl>

          {paymentTxUrl && intent.spendTxHash ? (
            <a
              className="block rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm transition hover:border-white/20 hover:bg-white/[0.05]"
              href={paymentTxUrl}
              rel="noreferrer"
              target="_blank"
            >
              <span className="block font-semibold text-white">Unified Balance spend transaction</span>
              <span className="mt-2 block break-all text-xs text-zinc-400">{intent.spendTxHash}</span>
              <span className="mt-3 inline-flex text-xs font-semibold text-emerald-200 underline-offset-4 hover:underline">View on ArcScan</span>
            </a>
          ) : (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">Spend transaction hash is not available yet.</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-900/80 p-5 shadow-2xl shadow-black/30">
          <div className="border-b border-white/10 pb-5">
            <p className="text-sm font-medium text-zinc-400">Voucher</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Secure reveal</h2>
          </div>

          <div className="space-y-4 pt-5">
            {!isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-400">Connect the purchasing wallet to reveal this voucher.</p>
                <WalletConnect />
              </div>
            ) : null}

            {isConnected && !fulfilled ? <StateNotice title="Voucher pending" message="Voucher is still processing." /> : null}

            {isConnected && fulfilled && !revealRequested ? (
              <button
                className="min-h-11 w-full rounded-md bg-emerald-300 px-4 text-sm font-black text-zinc-950 transition hover:bg-emerald-200"
                type="button"
                onClick={() => setRevealRequested(true)}
              >
                Reveal Voucher
              </button>
            ) : null}

            {isConnected && fulfilled && revealRequested && voucherQuery.isLoading ? (
              <div className="animate-pulse rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="h-4 w-32 rounded bg-white/[0.06]" />
                <div className="mt-4 h-10 rounded bg-white/[0.06]" />
              </div>
            ) : null}

            {isConnected && fulfilled && reveal?.status === "ready" ? (
              <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
                <p className="text-sm font-semibold text-emerald-100">Voucher code</p>
                <code className="mt-3 block break-all rounded-md bg-zinc-950/70 px-3 py-4 text-base font-semibold text-white">
                  {reveal.voucher.voucherCode}
                </code>
              </div>
            ) : null}

            {isConnected && fulfilled && revealRequested && reveal && reveal.status !== "ready" ? (
              <StateNotice title={reveal.status === "forbidden" ? "Wrong wallet" : "Voucher pending"} message={reveal.message} />
            ) : null}
          </div>
        </section>
      </div>

      <Link
        className="mt-6 inline-flex rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.04]"
        href="/orders"
      >
        Back to orders
      </Link>
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className="mt-1 break-all text-sm font-semibold text-white">{value}</dd>
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
    paid: "Preparing voucher",
    refunded: "Refunded",
    voucher_fulfilled: "Fulfilled"
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
    month: "short"
  }).format(timestamp);
}
