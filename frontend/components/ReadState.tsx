export function LoadingProducts() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="min-h-64 animate-pulse rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/60" key={index}>
          <div className="h-28 rounded-md bg-zinc-100 dark:bg-white/[0.06]" />
          <div className="mt-5 h-4 w-24 rounded bg-zinc-100 dark:bg-white/[0.06]" />
          <div className="mt-3 h-6 w-40 rounded bg-zinc-100 dark:bg-white/[0.06]" />
          <div className="mt-12 h-10 rounded-full bg-zinc-100 dark:bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export function LoadingProductDetail() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <div className="min-h-96 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.05]" />
      <div className="space-y-5">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
        <div className="h-12 w-3/4 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
        <div className="h-24 animate-pulse rounded bg-zinc-100 dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}

export function StateNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-amber-800 dark:text-amber-100/80">{message}</p>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
      <p className="text-lg font-semibold text-zinc-950 dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  );
}
