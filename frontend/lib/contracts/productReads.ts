"use client";

import { useReadContracts } from "wagmi";
import { arcVoucherStoreAbi, arcVoucherStoreAddress } from "@/lib/contracts/arcVoucherStore";
import { demoProducts, productIds, withProductVisuals, type Product } from "@/lib/products";

type ProductTuple = readonly [
  id: bigint,
  brand: string,
  name: string,
  price: bigint,
  totalStock: bigint,
  soldStock: bigint,
  active: boolean
];

type ContractReadResult =
  | {
      status: "success";
      result: unknown;
    }
  | {
      status: "failure";
      error: Error;
    };

type ProductReadState = {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  isFallback: boolean;
  error: Error | null;
  refetch: () => void;
};

const productReadContracts = productIds.flatMap((productId) => [
  {
    address: arcVoucherStoreAddress,
    abi: arcVoucherStoreAbi,
    functionName: "products",
    args: [BigInt(productId)]
  },
  {
    address: arcVoucherStoreAddress,
    abi: arcVoucherStoreAbi,
    functionName: "availableStock",
    args: [BigInt(productId)]
  }
] as const);

export function useArcVoucherProducts(): ProductReadState {
  const { data, error, isError, isLoading, refetch } = useReadContracts({
    contracts: productReadContracts,
    query: {
      refetchInterval: 15_000
    }
  });

  const { products, hasFailure } = mapProductResults(data as ContractReadResult[] | undefined);
  const shouldFallback = isError || hasFailure;

  return {
    products: shouldFallback ? demoProducts : products,
    isLoading,
    isError: shouldFallback,
    isFallback: shouldFallback,
    error: error ?? null,
    refetch: () => {
      void refetch();
    }
  };
}

export function useArcVoucherProduct(productId: number): ProductReadState & { product: Product | undefined } {
  const normalizedProductId = Number.isSafeInteger(productId) && productId > 0 ? productId : 0;
  const { data, error, isError, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: arcVoucherStoreAddress,
        abi: arcVoucherStoreAbi,
        functionName: "products",
        args: [BigInt(normalizedProductId)]
      },
      {
        address: arcVoucherStoreAddress,
        abi: arcVoucherStoreAbi,
        functionName: "availableStock",
        args: [BigInt(normalizedProductId)]
      }
    ],
    query: {
      enabled: normalizedProductId > 0,
      refetchInterval: 15_000
    }
  });

  const { product, hasFailure } = mapSingleProductResult(data as ContractReadResult[] | undefined);
  const fallbackProduct = demoProducts.find((item) => item.id === normalizedProductId);
  const shouldFallback = isError || hasFailure;

  return {
    product: shouldFallback ? fallbackProduct : product,
    products: shouldFallback && fallbackProduct ? [fallbackProduct] : product ? [product] : [],
    isLoading,
    isError: shouldFallback,
    isFallback: shouldFallback,
    error: error ?? null,
    refetch: () => {
      void refetch();
    }
  };
}

function mapProductResults(data: ContractReadResult[] | undefined): {
  products: Product[];
  hasFailure: boolean;
} {
  if (!data) {
    return { products: [], hasFailure: false };
  }

  let hasFailure = false;
  const products = productIds
    .map((_, index) => {
      const productResult = data[index * 2];
      const availableStockResult = data[index * 2 + 1];

      if (productResult?.status !== "success" || availableStockResult?.status !== "success") {
        hasFailure = true;
        return undefined;
      }

      return mapProductTuple(productResult.result as ProductTuple, availableStockResult.result as bigint);
    })
    .filter((product): product is Product => Boolean(product));

  return { products, hasFailure };
}

function mapSingleProductResult(data: ContractReadResult[] | undefined): {
  product: Product | undefined;
  hasFailure: boolean;
} {
  if (!data) {
    return { product: undefined, hasFailure: false };
  }

  const productResult = data[0];
  const availableStockResult = data[1];

  if (productResult?.status !== "success" || availableStockResult?.status !== "success") {
    return { product: undefined, hasFailure: true };
  }

  return {
    product: mapProductTuple(productResult.result as ProductTuple, availableStockResult.result as bigint),
    hasFailure: false
  };
}

function mapProductTuple(product: ProductTuple, availableStock: bigint): Product | undefined {
  const [id, brand, name, price, totalStock, soldStock, active] = product;

  if (id === BigInt(0)) {
    return undefined;
  }

  return withProductVisuals({
    id: Number(id),
    brand,
    name,
    price,
    totalStock: Number(totalStock),
    soldStock: Number(soldStock),
    availableStock: Number(availableStock),
    active
  });
}
