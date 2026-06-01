# ArcVoucher

Buy digital gift cards using USDC on Arc Testnet.

ArcVoucher is a public demo marketplace that showcases how Arc Unified Balance can be used for real-world digital purchases. Users can purchase gift cards using either direct Arc USDC payments or Arc Unified Balance sourced from multiple supported chains.

---

## Why ArcVoucher?

Most blockchain payments stop at transferring tokens.

ArcVoucher demonstrates a complete purchase flow:

USDC → Payment → Order → Voucher Delivery

Using Arc Unified Balance, users can fund a single balance from supported chains and spend from that balance without managing separate wallets for every network.

---

## Features

### Direct Arc Payment

- Pay directly with USDC on Arc Testnet
- Instant order creation
- Voucher delivery after payment confirmation

### Arc Unified Balance

- Deposit USDC from supported chains
- Spend from a unified balance
- Cross-chain user experience
- Wallet-linked voucher access

### Voucher Marketplace

- Steam Gift Cards
- Google Play Gift Cards
- Demo digital products
- Extensible catalog architecture

### Order History

- Direct Arc purchases
- Unified Balance purchases
- Unified order tracking
- Voucher retrieval

---

## Supported Payment Methods

### Direct Arc USDC

User pays directly on Arc Testnet.

Flow:

Wallet
→ Arc Testnet
→ ArcVoucher
→ Voucher

---

### Arc Unified Balance

User deposits USDC into Unified Balance and spends from a single balance.

Flow:

Source Chain
→ Unified Balance
→ Arc Payment
→ Voucher

---

## Supported Chains

Arc Unified Balance currently supports:

- Arc Testnet
- Arbitrum Sepolia
- Avalanche Fuji
- Base Sepolia
- Ethereum Sepolia
- HyperEVM Testnet
- Optimism Sepolia
- Polygon Amoy
- Sei Testnet
- Sonic Testnet
- Unichain Sepolia
- World Chain Sepolia

Availability depends on Arc Unified Balance support.

---

# User Workflow

## Option 1 — Direct Arc Payment

### Step 1

Connect your wallet.

### Step 2

Open Marketplace.

### Step 3

Select a gift card.

Example:

- Steam Gift Card $10
- Google Play Gift Card $10

### Step 4

Choose:

Direct Arc Payment

### Step 5

Confirm payment.

### Step 6

Wait for payment confirmation.

### Step 7

Open Orders.

### Step 8

Reveal your voucher code.

---

## Option 2 — Arc Unified Balance

### Step 1

Connect your wallet.

### Step 2

Open Marketplace.

### Step 3

Select a gift card.

### Step 4

Choose:

Unified Balance

### Step 5

Select a source chain.

Example:

- Arbitrum Sepolia
- Base Sepolia
- Ethereum Sepolia

### Step 6

Deposit USDC into Unified Balance.

### Step 7

Wait for Unified Balance to update.

Usually a few minutes.

### Step 8

Pay with Unified Balance.

### Step 9

Wait for payment verification.

### Step 10

Open Orders.

### Step 11

Reveal your voucher code.

---

# Voucher Security

Voucher codes are linked to the purchasing wallet.

Benefits:

- Wallet-based ownership
- Controlled voucher access
- Purchase verification
- Order tracking

---

# Architecture

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- Node.js
- Express
- Event-driven payment processing

## Smart Contracts

### ArcVoucherStore

Handles:

- Product catalog
- Inventory
- Direct Arc purchases

### ArcVoucherIntentPaymentReceiver

Supports Unified Balance purchase workflows.

---

# Contracts

## ArcVoucherStore

```txt
0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c
```

## ArcVoucherIntentPaymentReceiver

```txt
0xcE74549774a6fe45A2a6A6D04daBaeF29dFe1971
```

---

# Demo Status

Current status:

✅ Direct Arc Payment

✅ Arc Unified Balance Deposit

✅ Arc Unified Balance Spend

✅ Voucher Delivery

✅ Unified Order History

✅ Wallet-Based Voucher Reveal

✅ Public Testnet Demo

---

# Local Development

## Frontend

```bash
cd frontend

npm install

npm run dev
```

## Backend

```bash
cd backend

npm install

npm run dev
```

---

# Vision

ArcVoucher demonstrates how Arc Unified Balance can power real digital commerce.

Instead of simply moving tokens between wallets, users can spend USDC from a unified balance to purchase digital goods across supported ecosystems.

This project serves as a public testnet showcase of practical Unified Balance usage within the Arc ecosystem.
