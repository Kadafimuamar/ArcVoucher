# ARCHITECTURE.md

# ArcVoucher Architecture

## System Overview

ArcVoucher consists of:

1. Frontend
2. Arc App Kit
3. Arc Smart Contracts
4. Backend Services
5. Voucher Provider Layer

---

## High Level Architecture

User

↓

Frontend (Next.js)

↓

Arc App Kit

↓

Arc Smart Contract

↓

Backend Services

↓

Voucher Provider

---

# Frontend Layer

Responsibilities:

* Wallet connection
* Marketplace UI
* Product browsing
* Checkout
* Unified Balance UX
* Order history
* Voucher reveal

Technologies:

* Next.js
* TypeScript
* Wagmi
* Viem
* Arc App Kit

---

# App Kit Layer

Capabilities:

## Send

Same-chain USDC payment.

## Bridge

Cross-chain USDC transfer.

## Swap

Swap supported assets into USDC.

## Unified Balance

Aggregate USDC across chains.

---

# Smart Contract Layer

Contract:

ArcVoucherStore.sol

Responsibilities:

* Product storage
* Stock management
* Order creation
* Payment verification
* Escrow
* Refund
* Fulfillment proof

---

# Product Model

Product

* id
* brand
* name
* priceUSDC
* totalStock
* soldStock
* active

---

# Order Model

Order

* id
* buyer
* productId
* amountPaid
* status
* voucherHash
* createdAt

---

# Stock Logic

availableStock

=

totalStock - soldStock

---

# Backend Layer

Responsibilities:

* Listen OrderPaid events
* Generate mock voucher
* Integrate distributor APIs later
* Encrypt voucher
* Fulfill orders
* Refund failed orders

---

# Security Model

Store Onchain:

* products
* stock
* orders
* order status
* voucher hash

Store Offchain:

* voucher code plaintext
* API credentials
* distributor secrets

---

# Future Integrations

* Reloadly
* Tillo
* Tremendous
* Blackhawk

---

# Network

Arc Testnet

RPC:
https://rpc.testnet.arc.network

Chain ID:
5042002

Currency:
USDC

Explorer:
https://testnet.arcscan.app

---

# Core Design Principle

Blockchain stores truth.

Backend stores secrets.

App Kit handles liquidity movement.
