export const supportedWalletOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

export const walletAuthorizationMessage = "Please reconnect your wallet and authorize this site.";

export function isSupportedWalletOrigin(origin: string) {
  return supportedWalletOrigins.some((supportedOrigin) => origin === supportedOrigin);
}

export function isWalletAuthorizationError(error: unknown) {
  const message = getErrorText(error).toLowerCase();

  return (
    message.includes("has not been authorized") ||
    message.includes("not been authorized yet") ||
    (message.includes("source") && message.includes("authorized"))
  );
}

export function isReceiptTimeoutError(error: unknown) {
  const message = getErrorText(error).toLowerCase();

  return message.includes("timed out") || message.includes("timeout");
}

export function getErrorText(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return [error.message, getErrorText(error.cause)].filter(Boolean).join(" ");
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.shortMessage, record.details, record.reason, record.cause]
      .map((value) => getErrorText(value))
      .filter(Boolean)
      .join(" ");
  }

  return String(error);
}
