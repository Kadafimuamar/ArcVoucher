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

ArcVoucherPaymentReceiver.sol

ArcVoucherIntentPaymentReceiver.sol

Responsibilities:

* Product storage
* Stock management
* Order creation
* Payment verification
* Escrow
* Refund
* Fulfillment proof

## Payment Receiver

ArcVoucherPaymentReceiver is the v0.2.1 integration bridge for Unified Balance spend payments.

Responsibilities:

* Receive native Arc USDC from App Kit Unified Balance flows
* Store pending unified payment records
* Preserve original buyer address in receiver state and events
* Let owner/backend settle a received payment into ArcVoucherStore
* Refund unsettled unified payments

Important limitation:

* ArcVoucherStore.buyProduct(productId) records `msg.sender` as buyer.
* When ArcVoucherPaymentReceiver settles into ArcVoucherStore, the store order buyer is the receiver contract.
* The original wallet buyer is preserved in ArcVoucherPaymentReceiver events and payment records.
* This is acceptable for testnet/demo v0.2.1.
* v0.3.0 should add `buyProductFor(address buyer, uint256 productId)` or equivalent to preserve the original buyer directly in ArcVoucherStore orders.

## Intent Payment Receiver

ArcVoucherIntentPaymentReceiver is the v0.2.4 bridge for real App Kit Unified Balance raw spend delivery.

Responsibilities:

* Create backend-controlled checkout intents with buyer, product, expected amount, and reference id
* Receive raw native Arc USDC payments through `receive()`
* Store raw payment records separately from checkout intents
* Let owner/backend attach an exact-value raw payment to a matching intent
* Settle attached intents into ArcVoucherStore
* Refund attached intents to the original buyer
* Cancel unpaid created intents

Important limitation:

* App Kit `unifiedBalance.spend()` cannot send calldata in the installed SDK version.
* Raw spend delivery can reach `receive()`, but not `receiveUnifiedPayment(...)`.
* ArcVoucherIntentPaymentReceiver preserves the original buyer in intent state and events.
* ArcVoucherStore orders settled by the receiver still record the receiver contract as buyer.
* v0.3.0 should still add `buyProductFor(address buyer, uint256 productId)` or an equivalent signature-gated function.

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
