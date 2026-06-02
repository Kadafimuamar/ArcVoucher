import "dotenv/config";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type StorageDiagnostics = {
  directory: string;
  directoryExistedAtStartup: boolean;
  error?: string;
  path: string;
  writable: boolean;
};

type StoreKind = "intent" | "voucher";

export function resolveDataDir(): string {
  return resolve(process.env.DATA_DIR?.trim() || "data");
}

export function resolveStoreStoragePath(kind: StoreKind): string {
  const sharedDataDir = process.env.DATA_DIR?.trim();
  const storeDataDir = kind === "intent" ? process.env.INTENT_DATA_DIR?.trim() : process.env.VOUCHER_DATA_DIR?.trim();
  const directory = resolve(sharedDataDir || storeDataDir || "data");
  const fileName = kind === "intent" ? "intents.json" : "vouchers.json";

  return resolve(directory, fileName);
}

export async function prepareStoragePath(label: string, storagePath: string): Promise<StorageDiagnostics> {
  const directory = dirname(storagePath);
  const directoryExistedAtStartup = await directoryExists(directory);

  await mkdir(directory, { recursive: true });

  const writable = await canWriteToDirectory(directory);
  const diagnostics: StorageDiagnostics = {
    directory,
    directoryExistedAtStartup,
    path: storagePath,
    writable
  };

  console.log(`[${label}] Storage path ${storagePath}`);
  console.log(`[${label}] Storage directory ${directory} existed=${directoryExistedAtStartup} writable=${writable}`);

  return diagnostics;
}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    const info = await stat(directory);
    return info.isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function canWriteToDirectory(directory: string): Promise<boolean> {
  const probePath = resolve(directory, `.arcvoucher-write-test-${process.pid}-${Date.now()}`);

  try {
    await writeFile(probePath, "ok", "utf8");
    await unlink(probePath);
    return true;
  } catch (error) {
    console.warn(`[storage] Directory ${directory} is not writable`, error);
    return false;
  }
}
