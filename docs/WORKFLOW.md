# WORKFLOW.md

# ArcVoucher Workflow

## Buyer Flow

Open Marketplace

↓

Connect Wallet

↓

Check Unified Balance

↓

Select Voucher

↓

Check Onchain Stock

↓

Pay With USDC

↓

Order Created Onchain

↓

Backend Detects Event

↓

Voucher Generated

↓

Order Fulfilled

↓

Voucher Revealed

---

# Payment Logic

## Case A

User already has USDC on Arc.

Frontend

↓

Send Payment

↓

Contract buyProduct()

---

## Case B

User has USDC on another chain.

Frontend

↓

Bridge USDC

↓

Arc

↓

buyProduct()

---

## Case C

User has supported stablecoin.

Frontend

↓

Swap

↓

USDC

↓

buyProduct()

---

## Case D

User has USDC across chains.

Frontend

↓

Unified Balance

↓

Spend

↓

buyProduct()

---

# Stock Workflow

Admin Add Product

↓

Admin Add Stock

↓

Stock Available

↓

Buyer Purchase

↓

Stock Reduced

↓

Order Created

---

# Fulfillment Workflow

OrderPaid Event

↓

Backend Listener

↓

Generate Voucher

↓

Encrypt Voucher

↓

Hash Voucher

↓

fulfillOrder()

↓

Voucher Delivered

---

# Refund Workflow

OrderPaid

↓

Fulfillment Failed

↓

refundOrder()

↓

USDC Returned

---

# Smart Contract Build Order

1. Product Storage
2. Stock Storage
3. Order Storage
4. Buy Product
5. Fulfillment
6. Refund
7. Revenue Withdraw

---

# Frontend Build Order

1. Wallet Connect
2. Product List
3. Product Detail
4. Checkout
5. Order History
6. Voucher Reveal
7. Unified Balance
8. Bridge
9. Swap

---

# Backend Build Order

1. Event Listener
2. Mock Voucher Generator
3. Voucher Encryption
4. Fulfillment Service
5. Refund Service
6. Distributor Integration

---

# Milestone 1

Smart Contract MVP

* Product
* Stock
* Orders

---

# Milestone 2

Marketplace UI

* Product Cards
* Stock Display
* Checkout

---

# Milestone 3

USDC Payments

* Send
* Escrow

---

# Milestone 4

Voucher Fulfillment

* Mock Voucher
* Voucher Delivery

---

# Milestone 5

App Kit Integration

* Bridge
* Swap
* Unified Balance

---

# Milestone 6

Cross-Chain Checkout

User can spend USDC from multiple chains through a single ArcVoucher checkout flow.

---

# Codex Rules

Before implementing:

1. Read docs folder first.
2. Follow Arc documentation.
3. Do not invent APIs.
4. Use App Kit patterns.
5. Keep business logic modular.
6. Prefer on-chain state when possible.
7. Never store voucher plaintext on-chain.
