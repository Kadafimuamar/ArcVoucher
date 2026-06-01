import Link from "next/link";
import { WalletConnect } from "@/components/WalletConnect";

const links = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/orders", label: "Orders" },
  { href: "/admin", label: "Contracts" }
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90">
      <nav className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500 text-sm font-black text-white shadow-sm shadow-emerald-500/20 dark:bg-emerald-300 dark:text-zinc-950">
              AV
            </span>
            <span className="text-base font-semibold text-zinc-950 dark:text-white">ArcVoucher</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                className="text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
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
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300"
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
