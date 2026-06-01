import { CheckoutView } from "@/components/CheckoutView";
import { productIds } from "@/lib/products";

export function generateStaticParams() {
  return productIds.map((id) => ({ id: String(id) }));
}

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutView productId={Number(id)} />;
}
