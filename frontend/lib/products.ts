import { parseEther } from "viem";

export type Product = {
  id: number;
  brand: string;
  name: string;
  price: bigint;
  totalStock: number;
  soldStock: number;
  availableStock: number;
  active: boolean;
  accent: string;
  surface: string;
};

export type ProductStockState = "Available" | "Low Stock" | "Out of Stock" | "Inactive";

export const productIds = [1, 2, 3, 4, 5, 6, 7] as const;

const productVisuals: Record<number, Pick<Product, "accent" | "surface">> = {
  1: {
    accent: "from-sky-400 to-cyan-300",
    surface: "bg-sky-500/10"
  },
  2: {
    accent: "from-zinc-100 to-zinc-400",
    surface: "bg-zinc-400/10"
  },
  3: {
    accent: "from-amber-300 to-orange-400",
    surface: "bg-amber-400/10"
  },
  4: {
    accent: "from-emerald-300 to-blue-400",
    surface: "bg-emerald-400/10"
  },
  5: {
    accent: "from-fuchsia-300 to-rose-300",
    surface: "bg-fuchsia-400/10"
  },
  6: {
    accent: "from-red-400 to-rose-500",
    surface: "bg-red-500/10"
  },
  7: {
    accent: "from-lime-300 to-emerald-400",
    surface: "bg-lime-400/10"
  }
};

export const demoProducts: Product[] = [
  {
    id: 1,
    brand: "Steam",
    name: "Steam Gift Card $10",
    price: parseEther("10"),
    totalStock: 10,
    soldStock: 0,
    availableStock: 10,
    active: true,
    ...productVisuals[1]
  },
  {
    id: 2,
    brand: "Epic Games",
    name: "Epic Games Gift Card $10",
    price: parseEther("10"),
    totalStock: 8,
    soldStock: 0,
    availableStock: 8,
    active: true,
    ...productVisuals[2]
  },
  {
    id: 3,
    brand: "Amazon",
    name: "Amazon Gift Card $25",
    price: parseEther("25"),
    totalStock: 5,
    soldStock: 0,
    availableStock: 5,
    active: true,
    ...productVisuals[3]
  },
  {
    id: 4,
    brand: "Google Play",
    name: "Google Play Gift Card $10",
    price: parseEther("10"),
    totalStock: 12,
    soldStock: 0,
    availableStock: 12,
    active: true,
    ...productVisuals[4]
  },
  {
    id: 5,
    brand: "Apple",
    name: "Apple Gift Card $15",
    price: parseEther("15"),
    totalStock: 7,
    soldStock: 0,
    availableStock: 7,
    active: true,
    ...productVisuals[5]
  },
  {
    id: 6,
    brand: "Netflix",
    name: "Netflix Gift Card $15",
    price: parseEther("15"),
    totalStock: 6,
    soldStock: 0,
    availableStock: 6,
    active: true,
    ...productVisuals[6]
  },
  {
    id: 7,
    brand: "Spotify",
    name: "Spotify Gift Card $10",
    price: parseEther("10"),
    totalStock: 9,
    soldStock: 0,
    availableStock: 9,
    active: true,
    ...productVisuals[7]
  }
];

export function getProductById(id: string | number) {
  return demoProducts.find((product) => product.id === Number(id));
}

export function getAvailableStock(product: Product) {
  return product.availableStock;
}

export function getProductStockState(product: Pick<Product, "active" | "availableStock">): ProductStockState {
  if (!product.active) {
    return "Inactive";
  }
  if (product.availableStock === 0) {
    return "Out of Stock";
  }
  if (product.availableStock <= 5) {
    return "Low Stock";
  }

  return "Available";
}

export function withProductVisuals(product: Omit<Product, "accent" | "surface">): Product {
  return {
    ...product,
    ...(productVisuals[product.id] ?? {
      accent: "from-emerald-300 to-cyan-300",
      surface: "bg-emerald-400/10"
    })
  };
}
