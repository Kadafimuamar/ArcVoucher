export type BrandVisual = {
  brandColor: string;
  cardAccentColor: string;
  gradientBackground: string;
  logoPath: string;
  name: string;
  textColor: string;
};

const fallbackVisual: BrandVisual = {
  brandColor: "#059669",
  cardAccentColor: "#22d3ee",
  gradientBackground: "linear-gradient(135deg, #064e3b 0%, #0891b2 58%, #0f172a 100%)",
  logoPath: "/arcvoucher-mark.svg",
  name: "ArcVoucher",
  textColor: "#ffffff"
};

export const brandVisuals: Record<string, BrandVisual> = {
  amazon: {
    brandColor: "#ff9900",
    cardAccentColor: "#232f3e",
    gradientBackground: "linear-gradient(135deg, #fff7ed 0%, #ff9900 62%, #232f3e 100%)",
    logoPath: "/brands/amazon.svg",
    name: "Amazon",
    textColor: "#111827"
  },
  apple: {
    brandColor: "#111111",
    cardAccentColor: "#a1a1aa",
    gradientBackground: "linear-gradient(135deg, #ffffff 0%, #e5e7eb 56%, #111827 100%)",
    logoPath: "/brands/apple.svg",
    name: "Apple",
    textColor: "#111827"
  },
  "epic games": {
    brandColor: "#111111",
    cardAccentColor: "#ffffff",
    gradientBackground: "linear-gradient(135deg, #111111 0%, #27272a 54%, #52525b 100%)",
    logoPath: "/brands/epic-games.svg",
    name: "Epic Games",
    textColor: "#ffffff"
  },
  "google play": {
    brandColor: "#00a0ff",
    cardAccentColor: "#00d95f",
    gradientBackground: "linear-gradient(135deg, #eff6ff 0%, #38bdf8 38%, #22c55e 72%, #f97316 100%)",
    logoPath: "/brands/google-play.svg",
    name: "Google Play",
    textColor: "#111827"
  },
  netflix: {
    brandColor: "#e50914",
    cardAccentColor: "#000000",
    gradientBackground: "linear-gradient(135deg, #09090b 0%, #991b1b 56%, #e50914 100%)",
    logoPath: "/brands/netflix.svg",
    name: "Netflix",
    textColor: "#ffffff"
  },
  spotify: {
    brandColor: "#1db954",
    cardAccentColor: "#191414",
    gradientBackground: "linear-gradient(135deg, #1db954 0%, #16a34a 54%, #191414 100%)",
    logoPath: "/brands/spotify.svg",
    name: "Spotify",
    textColor: "#07140c"
  },
  steam: {
    brandColor: "#1b2838",
    cardAccentColor: "#66c0f4",
    gradientBackground: "linear-gradient(135deg, #171a21 0%, #2a475e 58%, #66c0f4 100%)",
    logoPath: "/brands/steam.svg",
    name: "Steam",
    textColor: "#ffffff"
  }
};

export function getBrandVisual(brand: string | undefined): BrandVisual {
  if (!brand) {
    return fallbackVisual;
  }

  return brandVisuals[normalizeBrandKey(brand)] ?? fallbackVisual;
}

export function getBrandVisualFromProductName(productName: string | undefined): BrandVisual {
  const normalizedProductName = productName?.toLowerCase() ?? "";
  const matchedKey = Object.keys(brandVisuals).find((brand) => normalizedProductName.includes(brand));

  return matchedKey ? brandVisuals[matchedKey] : fallbackVisual;
}

function normalizeBrandKey(brand: string) {
  return brand.trim().toLowerCase();
}
