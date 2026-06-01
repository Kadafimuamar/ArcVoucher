import type { UnifiedBalanceStep } from "@/lib/appkit/unifiedBalanceCheckoutUi";

type UnifiedBalanceStepperProps = {
  steps: UnifiedBalanceStep[];
};

type PublicStepState = "pending" | "processing" | "done" | "failed";

export function UnifiedBalanceStepper({ steps }: UnifiedBalanceStepperProps) {
  const publicSteps = buildPublicSteps(steps);

  return (
    <ol className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]" aria-label="Unified Balance checkout progress">
      {publicSteps.map((step, index) => (
        <li className="flex min-w-0 items-center gap-2" key={step.label}>
          {index > 0 ? <span className="text-zinc-300 dark:text-zinc-600">&gt;</span> : null}
          <span className={`flex min-w-0 items-center gap-2 font-semibold ${getStepTone(step.state)}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs">{index + 1}</span>
            <span className="truncate">{step.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function buildPublicSteps(steps: UnifiedBalanceStep[]): { label: string; state: PublicStepState }[] {
  const deposit = steps.find((step) => step.id === "deposit")?.state ?? "pending";
  const payStates = steps.filter((step) => step.id === "spend" || step.id === "receiver" || step.id === "store_order").map((step) => step.state);
  const voucher = steps.find((step) => step.id === "voucher")?.state ?? "pending";
  const pay = collapsePayState(payStates, voucher);

  return [
    { label: "Deposit", state: deposit },
    { label: "Pay", state: pay },
    { label: "Voucher", state: voucher }
  ];
}

function collapsePayState(states: PublicStepState[], voucher: PublicStepState): PublicStepState {
  if (states.includes("failed")) {
    return "failed";
  }
  if (voucher === "done" || states.every((state) => state === "done")) {
    return "done";
  }
  if (states.includes("processing")) {
    return "processing";
  }
  if (states.some((state) => state === "done")) {
    return "processing";
  }

  return "pending";
}

function getStepTone(state: PublicStepState) {
  const tones = {
    done: "text-emerald-700 dark:text-emerald-200 [&>span:first-child]:border-emerald-300 [&>span:first-child]:bg-emerald-50 dark:[&>span:first-child]:bg-emerald-300/10",
    failed: "text-red-700 dark:text-red-200 [&>span:first-child]:border-red-300 [&>span:first-child]:bg-red-50 dark:[&>span:first-child]:bg-red-300/10",
    pending: "text-zinc-500 dark:text-zinc-400 [&>span:first-child]:border-zinc-300 [&>span:first-child]:bg-white dark:[&>span:first-child]:border-white/10 dark:[&>span:first-child]:bg-zinc-900",
    processing: "text-sky-700 dark:text-sky-200 [&>span:first-child]:border-sky-300 [&>span:first-child]:bg-sky-50 dark:[&>span:first-child]:bg-sky-300/10"
  };

  return tones[state];
}
