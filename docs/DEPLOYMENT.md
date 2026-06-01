# ArcVoucher Deployment

ArcVoucher has two deployable apps:

- Frontend: Next.js app in `frontend/`
- Backend: Node.js TypeScript service in `backend/`

Deploy the backend first, then deploy the frontend with the backend URL.

## Production URLs

Replace these placeholders during deployment:

- Frontend: `https://your-vercel-project.vercel.app`
- Backend: `https://your-arcvoucher-backend.example.com`

## Required Frontend Env Vars

Set these in Vercel Project Settings -> Environment Variables:

```txt
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_ARC_VOUCHER_STORE_ADDRESS=0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c
NEXT_PUBLIC_ARC_VOUCHER_PAYMENT_RECEIVER_ADDRESS=0xBcB39b7c36B22B1Da4DfF828Cd392233c84893f6
NEXT_PUBLIC_ARC_VOUCHER_INTENT_PAYMENT_RECEIVER_ADDRESS=0xcE74549774a6fe45A2a6A6D04daBaeF29dFe1971
NEXT_PUBLIC_ARCVOUCHER_BACKEND_URL=https://your-arcvoucher-backend.example.com
NEXT_PUBLIC_ORDER_HISTORY_LOOKBACK_BLOCKS=250000
NEXT_PUBLIC_ARC_VOUCHER_START_BLOCK=
```

`NEXT_PUBLIC_ARC_VOUCHER_START_BLOCK` is optional. Set it to the deployment block for faster event reads when known.

## Required Backend Env Vars

Set these in Railway or Render:

```txt
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_VOUCHER_STORE_ADDRESS=0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c
ARC_VOUCHER_INTENT_PAYMENT_RECEIVER_ADDRESS=0xcE74549774a6fe45A2a6A6D04daBaeF29dFe1971
FULFILLER_PRIVATE_KEY=
PORT=4000
FRONTEND_ORIGIN=https://your-vercel-project.vercel.app
CORS_ALLOWED_ORIGINS=https://your-vercel-project.vercel.app
ORDER_HISTORY_LOOKBACK_BLOCKS=250000
ARC_VOUCHER_START_BLOCK=
ARC_GATEWAY_ADDRESS=0x0022222abe238cc2c7bb1f21003f0a260052475b
ARC_NATIVE_USDC_ADDRESS=0xfffffffffffffffffffffffffffffffffffffffe
```

`FULFILLER_PRIVATE_KEY` must be the deployer or owner wallet private key for the MVP. Do not commit it.

`FRONTEND_ORIGIN` is the primary deployed frontend URL. `CORS_ALLOWED_ORIGINS` is a comma-separated allowlist for additional production, preview, or custom-domain origins.

## Backend Health Check

The backend exposes:

```txt
GET /health
```

Expected response shape:

```json
{
  "ok": true,
  "service": "arcvoucher-backend",
  "contract": "0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c",
  "gateway": "0x0022222abe238cc2c7bb1f21003f0a260052475b",
  "intentReceiver": "0xcE74549774a6fe45A2a6A6D04daBaeF29dFe1971",
  "nativeUsdc": "0xfffffffffffffffffffffffffffffffffffffffe",
  "rpcUrl": "https://rpc.testnet.arc.network"
}
```

Test after deployment:

```bash
curl https://your-arcvoucher-backend.example.com/health
```

## Deploy Backend To Railway

1. Create a Railway project from the repository.
2. Set the service root directory to `backend`.
3. Set environment variables from `backend/.env.production.example`.
4. Set build command:

```bash
npm install && npm run build
```

5. Set start command:

```bash
npm run start
```

6. Deploy and open `/health`.

Railway usually provides `PORT`; keep `PORT=4000` only if manually configuring a fixed port.

## Deploy Backend To Render

1. Create a Render Web Service from the repository.
2. Set root directory to `backend`.
3. Set environment variables from `backend/.env.production.example`.
4. Set build command:

```bash
npm install && npm run build
```

5. Set start command:

```bash
npm run start
```

6. Health check path:

```txt
/health
```

7. Deploy and confirm `/health` returns `ok: true`.

## Deploy Frontend To Vercel

1. Create a Vercel project from the repository.
2. Set root directory to `frontend`.
3. Set framework preset to Next.js.
4. Set environment variables from `frontend/.env.production.example`.
5. Build command:

```bash
npm run build
```

6. Install command:

```bash
npm install
```

7. Output directory: leave default for Next.js.
8. Deploy.

After Vercel gives you the frontend URL, update backend env:

```txt
FRONTEND_ORIGIN=https://your-vercel-project.vercel.app
CORS_ALLOWED_ORIGINS=https://your-vercel-project.vercel.app
```

Redeploy or restart the backend after changing CORS env vars.

## Deployment Order

1. Deploy backend to Railway or Render.
2. Verify `GET /health`.
3. Copy the backend public URL.
4. Deploy frontend to Vercel with `NEXT_PUBLIC_ARCVOUCHER_BACKEND_URL` set to the backend URL.
5. Copy the Vercel URL.
6. Update backend `FRONTEND_ORIGIN` and `CORS_ALLOWED_ORIGINS`.
7. Restart or redeploy backend.
8. Run the post-deploy checklist.

## Post-Deploy Test Checklist

1. Open frontend home page.
2. Open `/marketplace` and confirm products load.
3. Open `/product/1` and confirm product data loads.
4. Open `/checkout/1`.
5. Connect wallet.
6. Confirm Arc Testnet is selectable.
7. Test direct checkout with a small seeded product if funds are available.
8. Test Unified Balance balance read.
9. Test Unified Balance deposit if balance is empty.
10. Test Unified Balance spend after balance updates.
11. Open `/orders` and confirm direct and Unified Balance orders appear.
12. Open the order detail page and reveal the voucher with the purchasing wallet.
13. Open backend `/health` and confirm `ok: true`.
14. Confirm browser console has no CORS errors.

## Notes

- Do not expose `FULFILLER_PRIVATE_KEY` in frontend env vars.
- All frontend env vars that start with `NEXT_PUBLIC_` are visible in the browser.
- Keep backend storage persistent if the platform supports it. The MVP stores intent and voucher data locally, so ephemeral filesystems may lose demo history after redeploys.
- For Vercel preview deployments, add each preview origin to `CORS_ALLOWED_ORIGINS` or use a stable custom domain for public testing.
