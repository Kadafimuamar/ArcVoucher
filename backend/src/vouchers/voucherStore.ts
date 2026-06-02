import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { StoredVoucher } from "./types.js";

const storagePath = resolve(process.env.VOUCHER_DATA_DIR ?? "data", "vouchers.json");

export class VoucherStore {
  private vouchers = new Map<string, StoredVoucher>();

  async load(): Promise<void> {
    console.log(`[voucherStore] Using storage path ${storagePath}`);
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
