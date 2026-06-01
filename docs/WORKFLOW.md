# ArcVoucher Workflow

## Buyer Flow

1. Open marketplace.
2. Connect wallet.
3. Select voucher.
4. Check on-chain stock.
5. Choose payment method.
6. Complete checkout.
7. Wait for voucher fulfillment.
8. Reveal voucher from the purchasing wallet.

## Payment Logic

### Case A: Direct Arc Payment

Use when the buyer already has Arc native USDC.

1. Frontend calls `ArcVoucherStore.buyProduct(productId)`.
2. Buyer sends `msg.value == product.price`.
3. `ArcVoucherStore` creates an on-chain order.
4. Backend detects `OrderPaid`.
5. Backend generates the mock voucher.
6. Backend stores voucher plaintext off-chain.
7. Backend stores voucher hash on-chain with `fulfillOrder`.

### Case B: Bridge Then Direct Payment

Use when the buyer has USDC on another chain but wants to complete the standard on-chain Arc checkout.

1. Buyer bridges USDC to Arc.
2. Buyer uses Direct Arc Payment.
3. `ArcVoucherStore.buyProduct(productId)` creates the order.

### Case C: Swap Then Direct Payment

Use when the buyer has another supported asset.

1. Buyer swaps to USDC.
2. Buyer moves or receives USDC on Arc.
3. Buyer uses Direct Arc Payment.

### Case D: Unified Balance Payment

`unifiedBalance.spend()` does not execute recipient contract code. It delivers funds through Gateway/Forwarding flow and returns spend evidence.

ArcVoucher v0.2.x uses backend intent verification:

1. Frontend creates a backend intent with buyer, product, expected amount, and reference id.
2. Frontend executes `unifiedBalance.spend()`.
3. Frontend sends spend evidence to `POST /intents/:id/confirm-spend`.
4. Backend verifies the Arc transaction receipt, recipient, amount, buyer, expiry, and tx reuse.
5. Backend marks the intent as paid.
6. Backend generates and stores the mock voucher under the original buyer address.
7. Frontend polls `GET /intents/:id` until the voucher is ready.
8. Frontend can reveal through `GET /intents/:id/voucher?buyer=0x...`.

Do not wait for `ArcVoucherIntentPaymentReceiver.receive()` or `RawPaymentReceived` for Unified Balance checkout.

## Stock Workflow

1. Admin adds product.
2. Admin adds stock.
3. Product becomes available.
4. Buyer purchases.
5. Stock decreases.
6. Order or verified intent is created.

## Fulfillment Workflow

### Direct Arc Orders

1. `OrderPaid` event is detected.
2. Backend generates voucher.
3. Backend hashes voucher.
4. Backend calls `fulfillOrder(orderId, voucherHash)`.
5. Buyer reveals voucher from backend if wallet matches order buyer.

### Unified Balance v0.2.x Intents

1. Spend evidence is confirmed.
2. Backend generates voucher.
3. Backend hashes voucher locally.
4. Backend stores voucher under `intent:{intentId}`.
5. Buyer reveals voucher if wallet matches intent buyer.

Voucher plaintext is never stored on-chain.

## Refund Workflow

### Direct Arc Orders

1. `OrderPaid` is detected.
2. Fulfillment fails.
3. Backend or owner calls `refundOrder(orderId)`.
4. Arc native USDC is returned through the store contract.

### Unified Balance v0.2.x Intents

Unified Balance v0.2.x uses backend-verified payment plus off-chain voucher fulfillment. Refund handling is manual for testnet until v0.3 introduces buyer-preserving on-chain settlement.

## Smart Contract Build Order

1. Product storage.
2. Stock storage.
3. Order storage.
4. Buy product.
5. Fulfillment.
6. Refund.
7. Revenue withdrawal.
8. Buyer-preserving v0.3 settlement.

## Frontend Build Order

1. Wallet connect.
2. Product list.
3. Product detail.
4. Direct checkout.
5. Order history.
6. Voucher reveal.
7. Unified Balance deposit.
8. Unified Balance spend evidence confirmation.
9. Bridge.
10. Swap.

## Backend Build Order

1. Direct order event listener.
2. Mock voucher generator.
3. Voucher storage.
4. Direct order fulfillment service.
5. Unified Balance intent storage.
6. Unified Balance spend verification.
7. Unified Balance intent voucher reveal.
8. Refund service.
9. Distributor integration.

## Milestones

### Milestone 1: Smart Contract MVP

- Product state.
- Stock state.
- Order state.

### Milestone 2: Marketplace UI

- Product cards.
- Stock display.
- Checkout.

### Milestone 3: USDC Payments

- Direct Arc native USDC payment.
- Unified Balance spend evidence verification.

### Milestone 4: Voucher Fulfillment

- Mock voucher.
- Voucher hash on-chain for direct orders.
- Off-chain voucher reveal.

### Milestone 5: App Kit Integration

- Unified Balance.
- Bridge.
- Swap.

### Milestone 6: Cross-Chain Checkout

Users can spend USDC from multiple chains through Unified Balance, and ArcVoucher verifies payment evidence before preparing the voucher.

## Codex Rules

Before implementing:

1. Read docs first.
2. Follow Arc documentation.
3. Do not invent APIs.
4. Use App Kit patterns.
5. Keep business logic modular.
6. Prefer on-chain state when possible.
7. Never store voucher plaintext on-chain.
8. Do not use receiver events as Unified Balance spend callbacks.
