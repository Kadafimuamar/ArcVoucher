import type { UnifiedBalanceStep } from "@/lib/appkit/unifiedBalanceCheckoutUi";

type UnifiedBalanceStepperProps = {
  steps: UnifiedBalanceStep[];
};

export function UnifiedBalanceStepper({ steps }: UnifiedBalanceStepperProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div className={`rounded-lg border px-3 py-2 ${getStepTone(step.state)}`} key={step.id}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase opacity-70">Step {index + 1}</span>
            <span className="text-xs font-semibold">{getStepStatusLabel(step.state)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

function getStepStatusLabel(state: UnifiedBalanceStep["state"]) {
  const labels = {
    done: "Done",
    failed: "Failed",
    pending: "Pending",
    processing: "Processing"
  };

  return labels[state];
}

function getStepTone(state: UnifiedBalanceStep["state"]) {
  const tones = {
    done: "border-emerald-500/25 bg-emerald-50 text-emerald-900 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100",
    failed: "border-red-500/25 bg-red-50 text-red-900 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-100",
    pending: "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400",
    processing: "border-sky-500/25 bg-sky-50 text-sky-900 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100"
  };

  return tones[state];
}
