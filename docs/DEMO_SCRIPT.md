# ArcVoucher Demo Script

## Introduction

ArcVoucher demonstrates how Arc Unified Balance can be used to purchase digital gift cards with USDC across supported chains.

Instead of bridging assets manually, users can deposit USDC from a supported chain into Unified Balance and spend it directly inside the marketplace.

---

## Problem

Buying digital goods across chains is still fragmented.

Users often need to:

- Bridge assets manually
- Switch networks multiple times
- Manage balances on different chains
- Wait for transfers before completing purchases

This creates unnecessary friction for simple purchases.

---

## Solution

ArcVoucher combines:

- Arc Testnet
- Arc Unified Balance
- USDC payments
- On-chain order tracking
- Secure voucher reveal

Users can spend USDC from supported chains through a single Unified Balance experience.

---

# Demo Flow

## Step 1 — Open Marketplace

Navigate to:

```
Marketplace
```

Available gift cards include:

- Steam
- Epic Games
- Apple
- Netflix
- Amazon
- Google Play

Each product has:

- Fixed USDC pricing
- Available stock
- Voucher delivery

---

## Step 2 — Connect Wallet

Connect a wallet supported by Arc AppKit.

The wallet address becomes:

- Buyer identity
- Order owner
- Voucher owner

Only the purchasing wallet can reveal the voucher.

---

## Step 3 — Select Product

Choose a gift card.

Example:

```
Apple Gift Card $15
```

Price:

```
15 USDC
```

---

## Step 4 — Unified Balance Payment

Select:

```
Unified Balance
```

Choose a source chain.

Example:

```
Ethereum Sepolia
```

Arc Unified Balance displays:

- Available balance
- Supported chain
- Required amount

---

## Step 5 — Complete Payment

Click:

```
Pay with Unified Balance
```

Arc processes:

1. Balance verification
2. Spend transaction
3. Payment confirmation
4. Order creation
5. Voucher fulfillment

No manual bridging is required.

---

## Step 6 — Order History

Navigate to:

```
Orders
```

The purchase appears immediately.

Example:

```
Apple Gift Card $15
Status: Voucher Ready
Payment Method: Unified Balance
```

---

## Step 7 — Secure Voucher Reveal

Open the order.

ArcVoucher verifies:

- Buyer wallet
- Order ownership
- Voucher entitlement

The voucher can then be revealed.

Example:

```
APPLE-ARC-DEMO-11
```

Only the purchasing wallet can access the voucher.

---

# Architecture

Frontend

- Next.js
- Arc AppKit
- Viem

Backend

- Node.js
- TypeScript

Smart Contracts

- ArcVoucherStore
- On-chain inventory
- On-chain order fulfillment

Payments

- Direct Arc Payment
- Arc Unified Balance

---

# What This Demonstrates

ArcVoucher proves that Arc Unified Balance can be used for:

- Digital commerce
- Cross-chain USDC spending
- Voucher marketplaces
- On-chain order tracking
- Secure digital delivery

without requiring users to manually bridge assets between chains.

---

# Current Status

Version:

```
v0.2.13-public-demo
```

Features:

- Direct Arc payments
- Unified Balance payments
- Order history
- Voucher fulfillment
- Secure voucher reveal
- Public testnet deployment

Future Work:

- PostgreSQL persistence
- Real voucher inventory
- Voucher stock management
- Merchant dashboard
- Analytics