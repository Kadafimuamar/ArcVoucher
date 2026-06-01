"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { EmptyState, LoadingProductDetail, StateNotice } from "@/components/ReadState";
import { WalletConnect } from "@/components/WalletConnect";
import { arcTestnet } from "@/lib/chains/arc";
import { useArcVoucherOrder } from "@/lib/contracts/orderReads";
import { formatUsdc, shortAddress } from "@/lib/format";
import { useVoucherReveal } from "@/lib/vouchers";

export function OrderDetailView({ orderId }: { orderId: number }) {
  const { address, isConnected } = useAccount();
  const { error, isError, isLoading, order, refetch } = useArcVoucherOrder(orderId);
  const voucherQuery = useVoucherReveal({
    buyer: address,
    enabled: Boolean(order && order.status === "Fulfilled" && isConnected),
    orderId
  });

  function handleRefresh() {
    void refetch();

    if (order?.status === "Fulfilled" && isConnected) {
      void voucherQuery.refetch();
    }
  }

  if (isLoading) {
    return <LoadingProductDetail />;
  }

  if (isError) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <StateNotice title="Could not load order" message={error?.message ?? "Arc Testnet order read failed. Try refreshing shortly."} />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <EmptyState title="Order not found" message={`Order #${orderId} is not available from the contract.`} />
      </main>
    );
  }

  const paymentTxUrl = order.txHash ? `${arcTestnet.blockExplorers.default.url}/tx/${order.txHash}` : undefined;
  const fulfillmentTxUrl = order.fulfilledTxHash ? `${arcTestnet.blockExplorers.default.url}/tx/${order.fulfilledTxHash}` : undefined;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-200">Order #{order.id}</p>
          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">{order.productName}</h1>
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
              <p className="mt-2 text-2xl font-semibold text-emerald-200">{formatUsdc(order.amountPaid)}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <dl className="grid gap-4 py-5 sm:grid-cols-2">
            <DetailItem label="Order ID" value={`#${order.id}`} />
            <DetailItem label="Product ID" value={`#${order.productId}`} />
            <DetailItem label="Created" value={order.createdAt} />
            <DetailItem label="Buyer" value={shortAddress(order.buyer)} />
            <DetailItem label="Voucher hash" value={order.voucherHash === zeroHash ? "Not set" : shortAddress(order.voucherHash)} />
            <DetailItem label="Contract status" value={order.status} />
          </dl>

          <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
            {paymentTxUrl && order.txHash ? (
              <TransactionLink label="Payment transaction" txHash={order.txHash} url={paymentTxUrl} />
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">Payment transaction hash is not available yet.</p>
            )}
            {fulfillmentTxUrl && order.fulfilledTxHash ? (
              <TransactionLink label="Fulfillment transaction" txHash={order.fulfilledTxHash} url={fulfillmentTxUrl} />
            ) : (
              <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">Fulfillment transaction appears after the voucher is issued.</p>
            )}
          </div>
        </section>

        <VoucherPanel isConnected={isConnected} orderStatus={order.status} query={voucherQuery} />
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

function TransactionLink({ label, txHash, url }: { label: string; txHash: string; url: string }) {
  return (
    <a
      className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm transition hover:border-white/20 hover:bg-white/[0.05]"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      <span className="block font-semibold text-white">{label}</span>
      <span className="mt-2 block break-all text-xs text-zinc-400">{txHash}</span>
      <span className="mt-3 inline-flex text-xs font-semibold text-emerald-200 underline-offset-4 hover:underline">View on ArcScan</span>
    </a>
  );
}

function VoucherPanel({
  isConnected,
  orderStatus,
  query
}: {
  isConnected: boolean;
  orderStatus: "Paid" | "Fulfilled" | "Refunded";
  query: ReturnType<typeof useVoucherReveal>;
}) {
  const reveal = query.data;

  return (
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

        {isConnected && orderStatus === "Paid" ? (
          <StateNotice title="Voucher pending" message="Voucher is still processing." />
        ) : null}

        {isConnected && orderStatus === "Refunded" ? (
          <StateNotice title="Voucher unavailable" message="This order was refunded." />
        ) : null}

        {isConnected && orderStatus === "Fulfilled" && query.isLoading ? (
          <div className="animate-pulse rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="h-4 w-32 rounded bg-white/[0.06]" />
            <div className="mt-4 h-10 rounded bg-white/[0.06]" />
          </div>
        ) : null}

        {isConnected && orderStatus === "Fulfilled" && reveal?.status === "ready" ? (
          <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4">
            <p className="text-sm font-semibold text-emerald-100">Voucher code</p>
            <code className="mt-3 block break-all rounded-md bg-zinc-950/70 px-3 py-4 text-base font-semibold text-white">
              {reveal.voucher.voucherCode}
            </code>
          </div>
        ) : null}

        {isConnected && orderStatus === "Fulfilled" && reveal && reveal.status !== "ready" ? (
          <StateNotice title={reveal.status === "forbidden" ? "Wrong wallet" : "Voucher pending"} message={reveal.message} />
        ) : null}
      </div>
    </section>
  );
}

const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
