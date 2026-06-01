import type { OrderStatus } from "@/lib/orders";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = {
    Paid: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-300/30 dark:bg-sky-300/10 dark:text-sky-100",
    Fulfilled: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100",
    Refunded: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-500/40 dark:bg-zinc-500/10 dark:text-zinc-200"
  }[status];

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status === "Fulfilled" ? "Voucher Ready" : status}</span>;
}
