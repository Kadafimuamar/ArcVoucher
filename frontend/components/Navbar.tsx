import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";

const links = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/orders", label: "Orders" },
  { href: "/admin", label: "Admin" }
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
      <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-300 text-sm font-black text-zinc-950">
              AV
            </span>
            <span className="text-base font-semibold text-white">ArcVoucher</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                className="text-sm font-medium text-zinc-300 transition hover:text-white"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <WalletConnect />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto md:hidden">
          {links.map((link) => (
            <Link
              className="rounded-full border border-white/10 px-3 py-2 text-sm font-medium text-zinc-300"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
