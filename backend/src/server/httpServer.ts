import { createServer, type ServerResponse } from "node:http";
import { config } from "../clients/viem.js";
import { voucherStore } from "../vouchers/voucherStore.js";

const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);

export function startHttpServer(): void {
  const server = createServer((request, response) => {
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
        rpcUrl: config.arcRpcUrl
      }, request.headers.origin);
      return;
    }

    const voucherMatch = url.pathname.match(/^\/voucher\/(\d+)$/);
    if (request.method === "GET" && voucherMatch) {
      const orderId = voucherMatch[1];
      const buyer = url.searchParams.get("buyer");
      const voucher = voucherStore.get(orderId);

      if (!buyer) {
        sendJson(response, 400, { error: "buyer query parameter is required" }, request.headers.origin);
        return;
      }

      if (!voucher) {
        sendJson(response, 404, { error: "Voucher not found" }, request.headers.origin);
        return;
      }

      if (buyer.toLowerCase() !== voucher.buyer.toLowerCase()) {
        sendJson(response, 403, { error: "Forbidden" }, request.headers.origin);
        return;
      }

      sendJson(response, 200, voucher, request.headers.origin);
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
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "http://127.0.0.1:3000";

  return {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-origin": allowOrigin,
    "vary": "Origin"
  };
}
