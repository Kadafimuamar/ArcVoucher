import { ProductDetailView } from "@/components/ProductDetailView";
import { productIds } from "@/lib/products";

export function generateStaticParams() {
  return productIds.map((id) => ({ id: String(id) }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailView productId={Number(id)} />;
}
