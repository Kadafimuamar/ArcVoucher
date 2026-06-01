import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Hex } from "viem";
import type { IntentStoreFile, StoredIntent, StoredRawPayment } from "./types.js";

const storagePath = resolve(process.cwd(), "data", "intents.json");

export class IntentStore {
  private intents = new Map<string, StoredIntent>();
  private rawPayments = new Map<string, StoredRawPayment>();

  async load(): Promise<void> {
    await mkdir(dirname(storagePath), { recursive: true });

    try {
      const raw = await readFile(storagePath, "utf8");
      const records = JSON.parse(raw) as IntentStoreFile;
      this.intents = new Map((records.intents ?? []).map((record) => [record.intentId, record]));
      this.rawPayments = new Map((records.rawPayments ?? []).map((record) => [record.rawPaymentId, record]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      await this.persist();
    }
  }

  getIntent(intentId: string): StoredIntent | undefined {
    return this.intents.get(intentId);
  }

  getIntentByReference(referenceId: Hex): StoredIntent | undefined {
    const normalizedReference = referenceId.toLowerCase();
    return [...this.intents.values()].find((intent) => intent.referenceId.toLowerCase() === normalizedReference);
  }

  getIntentBySpendTxHash(spendTxHash: Hex): StoredIntent | undefined {
    const normalizedHash = spendTxHash.toLowerCase();
    return [...this.intents.values()].find((intent) => intent.spendTxHash?.toLowerCase() === normalizedHash);
  }

  listIntentsByBuyer(buyer: string): StoredIntent[] {
    const normalizedBuyer = buyer.toLowerCase();
    return [...this.intents.values()]
      .filter((intent) => intent.buyer.toLowerCase() === normalizedBuyer)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRawPayment(rawPaymentId: string): StoredRawPayment | undefined {
    return this.rawPayments.get(rawPaymentId);
  }

  findCreatedIntentsByAmount(expectedAmount: string, now = new Date()): StoredIntent[] {
    return [...this.intents.values()]
      .filter((intent) => {
        if (intent.status !== "created" || intent.rawPaymentId) {
          return false;
        }

        if (intent.expectedAmount !== expectedAmount) {
          return false;
        }

        return new Date(intent.expiresAt).getTime() > now.getTime();
      })
      .sort((a, b) => {
        const createdAtDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return createdAtDiff !== 0 ? createdAtDiff : Number(BigInt(b.intentId) - BigInt(a.intentId));
      });
  }

  async upsertIntent(intent: StoredIntent): Promise<void> {
    this.intents.set(intent.intentId, intent);
    await this.persist();
  }

  async patchIntent(intentId: string, patch: Partial<StoredIntent>): Promise<StoredIntent> {
    const existing = this.intents.get(intentId);

    if (!existing) {
      throw new Error(`Intent ${intentId} not found`);
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await this.upsertIntent(updated);
    return updated;
  }

  async upsertRawPayment(rawPayment: StoredRawPayment): Promise<void> {
    this.rawPayments.set(rawPayment.rawPaymentId, rawPayment);
    await this.persist();
  }

  async patchRawPayment(rawPaymentId: string, patch: Partial<StoredRawPayment>): Promise<StoredRawPayment> {
    const existing = this.rawPayments.get(rawPaymentId);

    if (!existing) {
      throw new Error(`Raw payment ${rawPaymentId} not found`);
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    await this.upsertRawPayment(updated);
    return updated;
  }

  private async persist(): Promise<void> {
    const records: IntentStoreFile = {
      intents: [...this.intents.values()].sort((a, b) => Number(BigInt(a.intentId) - BigInt(b.intentId))),
      rawPayments: [...this.rawPayments.values()].sort((a, b) => Number(BigInt(a.rawPaymentId) - BigInt(b.rawPaymentId)))
    };

    await writeFile(storagePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

export const intentStore = new IntentStore();
