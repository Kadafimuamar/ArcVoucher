import Image from "next/image";
import { getBrandVisual, getBrandVisualFromProductName } from "@/lib/products/brandVisuals";

type BrandedGiftCardProps = {
  brand?: string;
  className?: string;
  name: string;
  priceLabel?: string;
  voucherCode?: string;
};

export function BrandedGiftCard({ brand, className = "", name, priceLabel, voucherCode }: BrandedGiftCardProps) {
  const visual = brand ? getBrandVisual(brand) : getBrandVisualFromProductName(name);

  return (
    <div
      className={`relative overflow-hidden rounded-xl p-5 shadow-xl shadow-black/15 ${className}`}
      style={{
        background: visual.gradientBackground,
        color: visual.textColor
      }}
    >
      <div className="absolute inset-y-0 right-16 w-px bg-white/25" />
      <div className="absolute inset-y-0 right-20 w-px bg-black/10" />
      <div className="absolute inset-x-5 bottom-16 h-px bg-white/25" />
      <div className="relative flex min-h-48 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <Image alt={`${visual.name} logo`} className="h-10 w-auto max-w-32 object-contain" height={64} src={visual.logoPath} width={180} />
          </div>
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-black text-zinc-950 shadow-sm">USDC</span>
        </div>

        <div className="mt-8">
          <p className="text-xs font-black uppercase opacity-80">Digital Gift Card</p>
          <h3 className="mt-2 max-w-sm text-2xl font-black leading-tight">{name}</h3>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase opacity-75">Instant delivery</p>
            <p className="mt-1 text-sm font-semibold opacity-90">Reveal after payment confirmation</p>
          </div>
          {priceLabel ? <p className="text-right text-2xl font-black">{priceLabel}</p> : null}
        </div>

        {voucherCode ? (
          <div className="mt-5 rounded-lg border border-white/30 bg-white/95 p-3 text-zinc-950 shadow-sm">
            <p className="text-xs font-black uppercase text-zinc-500">Voucher Code</p>
            <code className="mt-2 block break-all text-base font-black tracking-wide">{voucherCode}</code>
          </div>
        ) : null}
      </div>
    </div>
  );
}
