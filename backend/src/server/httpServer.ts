import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { config } from "../clients/viem.js";
import { intentStore } from "../intents/intentStore.js";
import {
  confirmSpendForIntent,
  createIntent,
  getIntentSpendDebug,
  normalizeAddress,
  normalizeBytes32,
  normalizePositiveBigInt,
  repairIntentVoucher,
  retryConfirmSpendForIntent,
  syncIntentFromChain
} from "../services/intentLifecycle.js";
import {
  DirectVoucherRepairError,
  directOrderHasVoucherHash,
  getDirectOrderStatusName,
  getIntentVoucherId,
  readDirectStoreOrder,
  repairDirectVoucherFromChain
} from "../services/fulfillment.js";
import { getUnifiedOrderHistory } from "../services/orderHistory.js";
import { voucherStore } from "../vouchers/voucherStore.js";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  config.frontendOrigin,
  ...config.corsAllowedOrigins
]);

export function startHttpServer(): void {
  const server = createServer(async (request, response) => {
    if (!request.url || !request.method) {
      sendJson(response, 400, { error: "Bad request" }, request.headers.origin);
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders(request.headers.origin));
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: "arcvoucher-backend",
        contract: config.contractAddress,
        gateway: config.gatewayAddress,
        intentReceiver: config.intentReceiverAddress,
        nativeUsdc: config.nativeUsdcAddress,
        rpcUrl: config.arcRpcUrl
      }, request.headers.origin);
      return;
    }

    if (request.method === "POST" && url.pathname === "/intents") {
      try {
        const body = await readJsonBody(request);
        const intent = await createIntent(parseCreateIntentBody(body));
        sendJson(response, 201, intent, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/orders") {
      try {
        const buyer = url.searchParams.get("buyer");

        if (!buyer) {
          sendJson(response, 400, { error: "buyer query parameter is required" }, request.headers.origin);
          return;
        }

        const orders = await getUnifiedOrderHistory(normalizeAddress(buyer));
        sendJson(response, 200, orders, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentConfirmSpendMatch = url.pathname.match(/^\/intents\/(\d+)\/confirm-spend$/);
    if (request.method === "POST" && intentConfirmSpendMatch) {
      try {
        const body = await readJsonBody(request);
        const result = await confirmSpendForIntent(intentConfirmSpendMatch[1], parseConfirmSpendBody(body));
        sendJson(response, 200, {
          intent: result.intent,
          voucherStatus: result.voucher?.status ?? null,
          voucherTxHash: result.voucher?.txHash ?? null
        }, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentRetryConfirmSpendMatch = url.pathname.match(/^\/intents\/(\d+)\/retry-confirm-spend$/);
    if (request.method === "POST" && intentRetryConfirmSpendMatch) {
      try {
        const body = await readJsonBody(request);
        const result = await retryConfirmSpendForIntent(intentRetryConfirmSpendMatch[1], parseRetryConfirmSpendBody(body));
        sendJson(response, 200, {
          intent: result.intent,
          voucherStatus: result.voucher?.status ?? null,
          voucherTxHash: result.voucher?.txHash ?? null
        }, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentDebugSpendMatch = url.pathname.match(/^\/intents\/(\d+)\/debug-spend$/);
    if (request.method === "GET" && intentDebugSpendMatch) {
      try {
        const debug = await getIntentSpendDebug(intentDebugSpendMatch[1]);
        sendJson(response, 200, debug, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentVoucherMatch = url.pathname.match(/^\/intents\/(\d+)\/voucher$/);
    if (request.method === "GET" && intentVoucherMatch) {
      try {
        const intent = intentStore.getIntent(intentVoucherMatch[1]);
        const buyer = url.searchParams.get("buyer");

        if (!buyer) {
          sendJson(response, 400, { error: "buyer query parameter is required" }, request.headers.origin);
          return;
        }

        const normalizedBuyer = normalizeAddress(buyer);

        if (!intent) {
          sendJson(response, 404, { error: "Intent not found" }, request.headers.origin);
          return;
        }

        if (normalizedBuyer.toLowerCase() !== intent.buyer.toLowerCase()) {
          sendJson(response, 403, { error: "Forbidden" }, request.headers.origin);
          return;
        }

        const voucherId = getIntentVoucherId(intent.intentId);
        const voucher = voucherStore.get(voucherId);
        if (!voucher) {
          console.warn(
            `[api] Unified Balance voucher missing orderId=${voucherId} intentId=${intent.intentId} buyer=${intent.buyer} status=${intent.status}`
          );
          sendJson(response, 404, { error: "Voucher not found" }, request.headers.origin);
          return;
        }

        sendJson(response, 200, voucher, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentRepairVoucherMatch = url.pathname.match(/^\/intents\/(\d+)\/repair-voucher$/);
    if (request.method === "POST" && intentRepairVoucherMatch) {
      try {
        const result = await repairIntentVoucher(intentRepairVoucherMatch[1]);
        sendJson(response, 200, {
          intent: result.intent,
          voucher: result.voucher
        }, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentReferenceMatch = url.pathname.match(/^\/intents\/reference\/(0x[a-fA-F0-9]{64})$/);
    if (request.method === "GET" && intentReferenceMatch) {
      try {
        const referenceId = normalizeBytes32(intentReferenceMatch[1]);
        const intent = intentStore.getIntentByReference(referenceId);

        if (!intent) {
          sendJson(response, 404, { error: "Intent not found" }, request.headers.origin);
          return;
        }

        sendJson(response, 200, intent, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const intentMatch = url.pathname.match(/^\/intents\/(\d+)$/);
    if (request.method === "GET" && intentMatch) {
      const localIntent = intentStore.getIntent(intentMatch[1]);

      if (!localIntent) {
        sendJson(response, 404, { error: "Intent not found" }, request.headers.origin);
        return;
      }

      let onChainIntent = null;
      if (!isLocalUnifiedBalanceStatus(localIntent.status)) {
        try {
          onChainIntent = await syncIntentFromChain(normalizePositiveBigInt(intentMatch[1], "intentId"));
        } catch (error) {
          console.warn("[api] Could not sync on-chain intent status", error);
        }
      }

      const latestIntent = onChainIntent ?? localIntent;
      const voucher = voucherStore.get(getIntentVoucherId(latestIntent.intentId)) ??
        (latestIntent.storeOrderId ? voucherStore.get(latestIntent.storeOrderId) : undefined);
      sendJson(response, 200, {
        intent: latestIntent,
        localIntent,
        onChainIntent,
        rawPaymentId: latestIntent.rawPaymentId ?? null,
        settlementTxHash: latestIntent.settleTxHash ?? null,
        voucherError: voucher?.error ?? null,
        voucherStatus: voucher?.status ?? null,
        voucherTxHash: voucher?.txHash ?? null
      }, request.headers.origin);
      return;
    }

    const debugVoucherMatch = url.pathname.match(/^\/debug\/voucher\/(\d+)$/);
    if (request.method === "GET" && debugVoucherMatch) {
      try {
        const orderId = BigInt(debugVoucherMatch[1]);
        const orderIdKey = orderId.toString();
        const buyer = url.searchParams.get("buyer");
        const requestBuyer = buyer ? normalizeAddress(buyer) : null;
        const order = await readDirectStoreOrder(orderId);
        const isExistingOrder = order.id !== BigInt(0);

        sendJson(response, 200, {
          buyerMatches: Boolean(requestBuyer && order.buyer.toLowerCase() === requestBuyer.toLowerCase()),
          existsInVoucherStore: voucherStore.has(orderIdKey),
          onChainBuyer: isExistingOrder ? order.buyer : null,
          onChainStatus: isExistingOrder ? getDirectOrderStatusName(order.status) : "Missing",
          orderIdKeyUsed: orderIdKey,
          requestBuyer,
          storagePath: voucherStore.getStoragePath(),
          voucherHashExists: isExistingOrder ? directOrderHasVoucherHash(order) : false
        }, request.headers.origin);
      } catch (error) {
        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    const voucherMatch = url.pathname.match(/^\/voucher\/(\d+)$/);
    if (request.method === "GET" && voucherMatch) {
      const orderId = voucherMatch[1];
      const buyer = url.searchParams.get("buyer");

      if (!buyer) {
        sendJson(response, 400, { error: "buyer query parameter is required" }, request.headers.origin);
        return;
      }

      try {
        const normalizedBuyer = normalizeAddress(buyer);
        const voucher = voucherStore.get(BigInt(orderId).toString()) ?? await repairDirectVoucherFromChain(orderId, normalizedBuyer);

        if (normalizedBuyer.toLowerCase() !== voucher.buyer.toLowerCase()) {
          sendJson(response, 403, { error: "Forbidden" }, request.headers.origin);
          return;
        }

        sendJson(response, 200, voucher, request.headers.origin);
      } catch (error) {
        if (error instanceof DirectVoucherRepairError) {
          sendJson(response, error.statusCode, { error: error.message }, request.headers.origin);
          return;
        }

        sendJson(response, 400, { error: getErrorMessage(error) }, request.headers.origin);
      }
      return;
    }

    sendJson(response, 404, { error: "Not found" }, request.headers.origin);
  });

  server.listen(config.port, () => {
    console.log(`[api] Listening on http://127.0.0.1:${config.port}`);
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown, origin?: string): void {
  response.writeHead(status, {
    ...corsHeaders(origin),
    "content-type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function corsHeaders(origin?: string) {
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : config.frontendOrigin;

  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": allowOrigin,
    "vary": "Origin"
  };
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function parseCreateIntentBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  return {
    buyer: requireString(record.buyer, "buyer"),
    expectedAmount: requireStringOrNumber(record.expectedAmount, "expectedAmount"),
    productId: requireStringOrNumber(record.productId, "productId"),
    referenceId: requireString(record.referenceId, "referenceId")
  };
}

function parseConfirmSpendBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  return {
    buyer: requireString(record.buyer, "buyer"),
    expectedAmount: requireStringOrNumber(record.expectedAmount, "expectedAmount"),
    recipient: requireString(record.recipient, "recipient"),
    spendTxHash: requireString(record.spendTxHash, "spendTxHash")
  };
}

function parseRetryConfirmSpendBody(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  return {
    spendTxHash: requireString(record.spendTxHash, "spendTxHash")
  };
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function requireStringOrNumber(value: unknown, fieldName: string) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isLocalUnifiedBalanceStatus(status: string) {
  return status === "paid" || status === "voucher_fulfilled" || status === "failed";
}
