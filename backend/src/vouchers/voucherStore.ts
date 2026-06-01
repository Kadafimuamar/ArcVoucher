import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { StoredVoucher } from "./types.js";

const storagePath = resolve(process.cwd(), "data", "vouchers.json");

export class VoucherStore {
  private vouchers = new Map<string, StoredVoucher>();

  async load(): Promise<void> {
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

  async upsert(voucher: StoredVoucher): Promise<void> {
    this.vouchers.set(voucher.orderId, voucher);
    await this.persist();
  }

  private async persist(): Promise<void> {
    const records = [...this.vouchers.values()].sort((a, b) => Number(BigInt(a.orderId) - BigInt(b.orderId)));
    await writeFile(storagePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  }
}

export const voucherStore = new VoucherStore();

