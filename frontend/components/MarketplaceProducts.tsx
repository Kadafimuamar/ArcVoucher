"use client";

import { EmptyState, LoadingProducts, StateNotice } from "@/components/ReadState";
import { ProductGrid } from "@/components/ProductGrid";
import { useArcVoucherProducts } from "@/lib/contracts/productReads";

export function MarketplaceProducts({ limit }: { limit?: number }) {
  const { products, isFallback, isLoading } = useArcVoucherProducts();
  const visibleProducts = typeof limit === "number" ? products.slice(0, limit) : products;

  if (isLoading) {
    return <LoadingProducts />;
  }

  return (
    <div className="space-y-4">
      {isFallback ? (
        <StateNotice
          title="Using mock fallback"
          message="ArcVoucherStore reads failed, so the seeded demo catalog is shown until the RPC responds."
        />
      ) : null}

      {visibleProducts.length > 0 ? (
        <ProductGrid products={visibleProducts} />
      ) : (
        <EmptyState title="No products found" message="Product IDs 1 through 7 returned no active catalog records." />
      )}
    </div>
  );
}
