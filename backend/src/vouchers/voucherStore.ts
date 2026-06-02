import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { prepareStoragePath, resolveStoreStoragePath, type StorageDiagnostics } from "../storage/dataDirectory.js";
import type { StoredVoucher } from "./types.js";

const storagePath = resolveStoreStoragePath("voucher");

export class VoucherStore {
  private vouchers = new Map<string, StoredVoucher>();
  private storageDiagnostics: StorageDiagnostics | null = null;

  async load(): Promise<void> {
    this.storageDiagnostics = await prepareStoragePath("voucherStore", storagePath);
    await mkdir(dirname(storagePath), { recursive: true });

    try {
      const raw = await readFile(storagePath, "utf8");
      const records = JSON.parse(raw) as StoredVoucher[];
      this.vouchers = new Map(records.map((record) => [record.orderId, record]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      await this.persist();
    }
  }

  get(orderId: string): StoredVoucher | undefined {
    return this.vouchers.get(orderId);
  }

  has(orderId: string): boolean {
    return this.vouchers.has(orderId);
  }

  list(): StoredVoucher[] {
    return [...this.vouchers.values()].sort(compareVoucherIds);
  }

  getStoragePath(): string {
    return storagePath;
  }

  isWritable(): boolean {
    return Boolean(this.storageDiagnostics?.writable);
  }

  getStorageDiagnostics(): StorageDiagnostics | null {
    return this.storageDiagnostics;
  }

  async upsert(voucher: StoredVoucher): Promise<void> {
    this.vouchers.set(voucher.orderId, voucher);
    await this.persist();
  }

  private async persist(): Promise<void> {
    const records = this.list();
    await writeFile(storagePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

export const voucherStore = new VoucherStore();

function compareVoucherIds(a: StoredVoucher, b: StoredVoucher) {
  const numericA = getSortableOrderId(a.orderId);
  const numericB = getSortableOrderId(b.orderId);

  if (numericA !== undefined && numericB !== undefined) {
    return Number(numericA - numericB);
  }

  return a.orderId.localeCompare(b.orderId);
}

function getSortableOrderId(orderId: string) {
  if (/^\d+$/.test(orderId)) {
    return BigInt(orderId);
  }

  const intentMatch = orderId.match(/^intent:(\d+)$/);
  return intentMatch ? BigInt(intentMatch[1]) : undefined;
}
