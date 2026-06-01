import type { OrderStatus } from "@/lib/orders";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = {
    Paid: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    Fulfilled: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    Refunded: "border-zinc-500/40 bg-zinc-500/10 text-zinc-200"
  }[status];

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

