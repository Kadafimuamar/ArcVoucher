# ArcVoucher

ArcVoucher is a stablecoin-native global gift card marketplace built on Arc Testnet.

Users can purchase digital vouchers such as:

* Steam
* Epic Games
* Amazon
* Google Play
* Apple
* Netflix
* Spotify

using USDC through Arc App Kit.

---

# Vision

ArcVoucher enables users to spend USDC from multiple blockchains and purchase digital gift cards through a unified checkout experience powered by Arc.

The project is designed around:

* Arc Testnet
* Arc App Kit
* Unified Balance
* Bridge
* Swap
* Send
* Stablecoin-native payments

---

# Core Features

## Marketplace

* Browse gift cards
* View stock
* View price in USDC
* Purchase gift cards

## Payments

* USDC on Arc
* Cross-chain USDC payments
* Unified Balance checkout
* Bridge USDC to Arc
* Swap to USDC

## Onchain State

Store on-chain:

* Products
* Stock
* Orders
* Order status
* Fulfillment proof

Do NOT store on-chain:

* Voucher code plaintext
* Distributor secrets
* API keys
* User private data

## Voucher Fulfillment

Backend generates or retrieves voucher codes.

Only voucher hashes are stored on-chain.

---

# Tech Stack

## Blockchain

* Arc Testnet
* Solidity
* Foundry
* Viem

## Frontend

* Next.js
* TypeScript
* Tailwind
* Wagmi
* Viem
* Arc App Kit

## Backend

* Node.js
* TypeScript

---

# Monorepo Structure

```text
arcvoucher/
  backend/      Node.js TypeScript services for event listening and voucher fulfillment
  contracts/    Foundry workspace for Arc Testnet smart contracts
  docs/         Architecture, workflow, implementation, and App Kit planning docs
  frontend/     Next.js marketplace application
```

---

# Setup

## Prerequisites

* Node.js 20+
* pnpm 9+
* Foundry

## Install Dependencies

```bash
pnpm install
```

## Configure Environment

Copy the example environment files before local development:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Arc Testnet defaults:

* RPC: `https://rpc.testnet.arc.network`
* Chain ID: `5042002`
* Explorer: `https://testnet.arcscan.app`
* Payment asset: USDC

Contract and USDC addresses are intentionally left blank until deployment details are finalized.

## Common Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm contracts:build
pnpm contracts:test
pnpm frontend:dev
pnpm backend:dev
```

## Contracts

The Foundry workspace lives in `contracts/`.

```bash
cd contracts
forge build
forge test
```

## Frontend

The Next.js app lives in `frontend/` and is reserved for Arc App Kit, Wagmi, Viem, Tailwind, and marketplace UI work.

```bash
pnpm frontend:dev
```

## Backend

The Node.js TypeScript backend lives in `backend/` and is reserved for event listening, mock voucher generation, encryption, fulfillment, and refund workflows.

```bash
pnpm backend:dev
```

---

# Arc Documentation Source of Truth

All implementations MUST follow Arc documentation.

Priority:

1. App Kit
2. Send
3. Bridge
4. Swap
5. Unified Balance
6. SDK Reference

Reference Docs:

* App Kit
* Installation
* Adapter Setup
* Server Wallet Setup
* Send
* Bridge
* Swap
* Unified Balance
* Fee Estimation
* Forwarding Service
* Delegate Management
* Supported Blockchains
* SDK Reference

---

# Development Principles

1. App Kit first.
2. USDC first.
3. Arc first.
4. Cross-chain by default.
5. Store public state on-chain.
6. Store secrets off-chain.
7. Unified Balance should be integrated from the beginning.
8. Follow Arc documentation before implementing any feature.

# Links or Reference

1. https://docs.arc.io/app-kit
2. https://docs.arc.io/app-kit/tutorials/installation
3. https://docs.arc.io/app-kit/references/supported-blockchains
4. https://docs.arc.io/app-kit/tutorials/adapter-setups
5. https://docs.arc.io/app-kit/tutorials/server-wallet-setups
6. https://docs.arc.io/app-kit/send
7. https://docs.arc.io/app-kit/quickstarts/send-tokens-same-chain
8. https://docs.arc.io/app-kit/bridge
9. https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains
10. https://docs.arc.io/app-kit/concepts/bridge-fees
11. https://docs.arc.io/app-kit/tutorials/bridge/collect-bridge-fee
12. https://docs.arc.io/app-kit/tutorials/bridge/estimate-costs
13. https://docs.arc.io/app-kit/tutorials/bridge/use-forwarding-service
14. https://docs.arc.io/app-kit/tutorials/bridge/configure-transfer-speed
15. https://docs.arc.io/app-kit/tutorials/bridge/specify-recipient-address
16. https://docs.arc.io/app-kit/references/bridge-error-recovery
17. https://docs.arc.io/app-kit/swap
18. https://docs.arc.io/app-kit/quickstarts/swap-tokens-same-chain
19. https://docs.arc.io/app-kit/concepts/swap-fees
20. https://docs.arc.io/app-kit/tutorials/swap/collect-swap-fee
21. https://docs.arc.io/app-kit/tutorials/swap/estimate-swap-rate
22. https://docs.arc.io/app-kit/tutorials/swap/set-slippage-tolerance-or-stop-limit
23. https://docs.arc.io/app-kit/unified-balance
24. https://docs.arc.io/app-kit/quickstarts/unified-balance-deposit-and-spend
25. https://docs.arc.io/app-kit/quickstarts/unified-balance-delegate-deposit-and-spend
26. https://docs.arc.io/app-kit/concepts/unified-balance-fees
27. https://docs.arc.io/app-kit/tutorials/unified-balance/check-unified-balance
28. https://docs.arc.io/app-kit/tutorials/unified-balance/select-source-blockchains
29. https://docs.arc.io/app-kit/tutorials/unified-balance/estimate-spend-fees
30. https://docs.arc.io/app-kit/tutorials/unified-balance/collect-custom-spend-fees
31. https://docs.arc.io/app-kit/tutorials/unified-balance/manage-delegates
32. https://docs.arc.io/app-kit/tutorials/unified-balance/use-forwarding-service
33. https://docs.arc.io/app-kit/tutorials/unified-balance/remove-funds-trustlessly
34. https://docs.arc.io/app-kit/quickstarts/swap-tokens-crosschain
35. https://docs.arc.io/app-kit/references/sdk-reference
