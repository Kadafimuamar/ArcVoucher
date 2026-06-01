import type { Address, Hex } from "viem";
import type { UnifiedBalanceSpendEvidence, UnifiedBalanceSpendPreparation } from "@/lib/appkit/types";
import { shortAddress } from "@/lib/format";
import type { IntentStatusResponse, StoredIntent } from "@/lib/intents";

type UnifiedBalanceAdvancedDetailsProps = {
  backendError?: string;
  intent?: StoredIntent;
  intentStatus?: IntentStatusResponse;
  preparation?: UnifiedBalanceSpendPreparation;
  receiverAddress: Address;
  selectedChainIds: string[];
  spendEvidence?: UnifiedBalanceSpendEvidence;
};

export function UnifiedBalanceAdvancedDetails({
  backendError,
  intent,
  intentStatus,
  preparation,
  receiverAddress,
  selectedChainIds,
  spendEvidence
}: UnifiedBalanceAdvancedDetailsProps) {
  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-900 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 dark:text-white">
      <summary className="cursor-pointer text-sm font-semibold">Advanced details</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DetailItem label="Intent ID" value={intent?.intentId ? `#${intent.intentId}` : "Not created"} />
        <DetailItem label="Reference ID" value={intent?.referenceId ?? preparation?.referenceId ?? "Not generated"} />
        <DetailItem label="Recipient" value={shortAddress(receiverAddress)} />
        <DetailItem label="Spend tx" value={spendEvidence?.txHash ?? "Not submitted"} />
        <DetailItem label="Transfer ID" value={spendEvidence?.transferId ?? "Not available"} />
        <DetailItem label="Payment status" value={intent?.spendTxHash ? "Verified" : "Pending"} />
        <DetailItem label="Verification method" value={intent?.verificationMethod ?? "Pending"} />
        <DetailItem label="Voucher ID" value={intent?.voucherId ?? "Pending"} />
        <DetailItem label="Legacy raw payment ID" value={intent?.rawPaymentId ? `#${intent.rawPaymentId}` : "Not used"} />
        <DetailItem label="Legacy attach tx" value={intent?.attachTxHash ?? "Not used"} />
        <DetailItem label="Legacy settle tx" value={intent?.settleTxHash ?? intentStatus?.settlementTxHash ?? "Not used"} />
        <DetailItem label="Selected chains" value={selectedChainIds.length ? selectedChainIds.join(", ") : "None"} />
        <DetailItem label="Backend errors" value={backendError ?? intentStatus?.voucherError ?? "None"} />
      </div>
    </details>
  );
}

function DetailItem({ label, value }: { label: string; value: string | Hex }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}
