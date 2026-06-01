import { OrderDetailView } from "@/components/OrderDetailView";

export default async function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderDetailView orderId={Number(orderId)} />;
}
