# ArcVoucher v0.2.1 Unified Balance Real Spend Design

## Scope

This document compares architectures for connecting Arc App Kit `unifiedBalance.spend(...)` to `ArcVoucherStore.buyProduct(productId)`.

No implementation is included here.

Current constraint:

- `ArcVoucherStore.buyProduct(productId)` is payable.
- It requires `msg.value == product.price`.
- It records `buyer = msg.sender`.
- Arc native currency is USDC in this contract context.

Relevant App Kit behavior from the Arc docs:

- Unified Balance creates a chain-agnostic USDC balance that can be spent on a destination chain.
- `kit.unifiedBalance.spend(...)` spends/mints USDC to a destination chain recipient address.
- Spend source selection can be automatic or explicit with `from.allocations`.
- `kit.unifiedBalance.estimateSpend(...)` uses the same spend parameters and returns itemized fees.
- Forwarding Service can submit the destination mint and can be used without a destination adapter by passing `recipientAddress` and `useForwarder: true`.
- Forwarding Service fees are deducted from the destination minted amount.
- Delegates are chain-specific; an authorized delegate can spend with `sourceAccount` set to the user's address.

References:

- https://docs.arc.io/app-kit/unified-balance
- https://docs.arc.io/app-kit/tutorials/unified-balance/select-source-blockchains
- https://docs.arc.io/app-kit/tutorials/unified-balance/estimate-spend-fees
- https://docs.arc.io/app-kit/tutorials/unified-balance/use-forwarding-service
- https://docs.arc.io/app-kit/tutorials/unified-balance/manage-delegates
- https://docs.arc.io/app-kit/references/sdk-reference

## Core Problem

Unified Balance spend is a funds-delivery primitive. It delivers USDC on Arc to a recipient address.

ArcVoucher purchase is a contract-call primitive. It creates an order only when `buyProduct(productId)` is called with exact native USDC `msg.value`.

Therefore, a Unified Balance spend to a wallet or contract address does not, by itself, create an `ArcVoucherStore` order. A second action must connect received Arc USDC to `buyProduct`, and that action must preserve the original buyer identity.

## Option A: PaymentReceiver Contract

### Summary

Deploy a new `PaymentReceiver` contract as the Arc recipient for Unified Balance spends. The receiver accepts Arc USDC from App Kit, then settles a validated checkout intent by calling the existing `ArcVoucherStore.buyProduct(productId)`.

This keeps `ArcVoucherStore.sol` unchanged, but the store order's `buyer` becomes the `PaymentReceiver`, not the original wallet. Original buyer attribution must live in `PaymentReceiver` events/mappings and backend records.

### Transaction Flow

1. Buyer selects Unified Balance checkout.
2. Frontend or backend creates a checkout intent:
   - `intentId`
   - `buyer`
   - `productId`
   - `price`
   - `deadline`
   - `receiverAddress`
3. Frontend calls `kit.unifiedBalance.estimateSpend(...)`.
4. Frontend calls `kit.unifiedBalance.spend(...)` with:
   - destination chain: `Arc_Testnet`
   - recipient: `PaymentReceiver`
   - amount sufficient for the product price after applicable fees
5. Backend verifies the spend result / destination receipt and intent.
6. Backend or buyer calls `PaymentReceiver.settle(intentId, productId, buyer, spendTxHash)`.
7. `PaymentReceiver` calls:
   - `ArcVoucherStore.buyProduct{value: product.price}(productId)`
8. `ArcVoucherStore` emits `OrderPaid(orderId, buyer = PaymentReceiver, productId, amountPaid)`.
9. `PaymentReceiver` stores:
   - `storeOrderId => originalBuyer`
   - `storeOrderId => intentId`
   - `storeOrderId => spendTxHash`
10. `PaymentReceiver` emits a receiver-level event such as:
    - `UnifiedBalanceOrderSettled(intentId, storeOrderId, originalBuyer, productId, spendTxHash)`
11. Backend listens to both:
    - `ArcVoucherStore.OrderPaid`
    - `PaymentReceiver.UnifiedBalanceOrderSettled`
12. Backend fulfills the store order, but voucher reveal authorization uses the original buyer from `PaymentReceiver`.

### Contract Changes Needed

No changes to `ArcVoucherStore.sol`.

New contract required:

- `PaymentReceiver.sol`

Likely responsibilities:

- Receive Arc native USDC.
- Track checkout intents.
- Call `ArcVoucherStore.buyProduct{value: price}(productId)`.
- Store original buyer mapping for each store order.
- Emit settlement events.
- Support refund forwarding when `ArcVoucherStore.refundOrder(orderId)` sends funds back to `PaymentReceiver`.

Potential functions:

- `settle(bytes32 intentId, address buyer, uint256 productId, bytes32 spendRef)`
- `releaseRefund(uint256 storeOrderId)`
- `originalBuyerOf(uint256 storeOrderId)`

### Frontend Changes Needed

- Add Unified Balance execution after current preparation:
  - estimate spend
  - display fees
  - call `kit.unifiedBalance.spend(...)`
- Create or request a checkout intent before spend.
- Use `PaymentReceiver` as the spend recipient.
- Show the spend tx / transfer result.
- Poll backend or `PaymentReceiver` settlement status.
- Update `/orders` to include receiver-settled orders, because `ArcVoucherStore.OrderPaid.buyer` will be the receiver, not the connected wallet.

### Backend Changes Needed

- Add checkout-intent API.
- Verify spend destination, amount, product, buyer signature, and expiry.
- Call or authorize `PaymentReceiver.settle(...)`.
- Listen to `PaymentReceiver.UnifiedBalanceOrderSettled`.
- Map `storeOrderId` to original buyer for voucher reveal.
- Handle refund forwarding:
  - detect store refund to `PaymentReceiver`
  - trigger `PaymentReceiver.releaseRefund(storeOrderId)` or equivalent

### Security Risks

- Receiver custody risk: funds sit in `PaymentReceiver` between spend and settlement.
- Intent replay risk unless intents are nonce-based and single-use.
- Product price changes between estimate and settlement must be handled.
- Stock race: stock can sell out after spend but before settlement.
- Forwarding Service fee can reduce destination amount; receiver may receive less than product price unless spend amount accounts for it.
- Refund complexity: the store refunds `PaymentReceiver`, not the original buyer.
- Backend verification mistakes could map a spend to the wrong buyer or product.

### Can Voucher Order Be Tied to Original Buyer?

Yes, but not from `ArcVoucherStore.OrderPaid` alone.

The original buyer must be tied through `PaymentReceiver` state/events and backend records.

### Compatibility With Current MVP

High.

This option keeps the deployed `ArcVoucherStore` unchanged and preserves direct checkout. It requires a new receiver contract and frontend/backend event logic.

### Recommended For Testnet?

Recommended if the goal is to keep the current deployed store and prove real Unified Balance spend without redeploying `ArcVoucherStore`.

For testnet, this is the least disruptive path, but it should be treated as an integration bridge, not the final clean protocol design.

## Option B: Add `buyProductFor(address buyer, uint256 productId)` to `ArcVoucherStore`

### Summary

Add a payable purchase function that lets a payer create an order for a specified buyer.

This directly fixes the identity problem. A router, receiver, relayer, or backend wallet can pay `msg.value`, while the store records `orders[orderId].buyer = buyer`.

### Transaction Flow

There are two likely variants.

#### Variant B1: Receiver + `buyProductFor`

1. Buyer creates a signed checkout intent.
2. Frontend calls `kit.unifiedBalance.spend(...)` to a `PaymentReceiver` or router contract.
3. Receiver verifies intent and funds.
4. Receiver calls:
   - `ArcVoucherStore.buyProductFor{value: product.price}(buyer, productId)`
5. Store emits:
   - `OrderPaid(orderId, buyer, productId, amountPaid)`
6. Existing backend listener fulfills normally.
7. Existing `/orders` and voucher reveal work normally because the store buyer is the original wallet.

#### Variant B2: Backend Merchant Wallet + `buyProductFor`

1. Buyer signs a checkout intent.
2. Frontend calls `kit.unifiedBalance.spend(...)` to a backend merchant wallet on Arc.
3. Backend verifies receipt and intent.
4. Backend calls:
   - `ArcVoucherStore.buyProductFor{value: product.price}(buyer, productId)`
5. Store order is attributed to buyer.

### Contract Changes Needed

`ArcVoucherStore.sol` must change and be redeployed unless a proxy exists.

Recommended function shape:

```solidity
function buyProductFor(address buyer, uint256 productId) external payable returns (uint256 orderId)
```

Better long-term shape:

```solidity
function buyProductFor(
    address buyer,
    uint256 productId,
    uint256 deadline,
    bytes calldata buyerSignature
) external payable returns (uint256 orderId)
```

Internal refactor:

- `buyProduct(productId)` calls `_buyProduct(msg.sender, productId)`.
- `buyProductFor(...)` calls `_buyProduct(buyer, productId)`.

Additional events should include payer:

```solidity
event OrderPaidFor(
    uint256 indexed orderId,
    address indexed buyer,
    address indexed payer,
    uint256 productId,
    uint256 amountPaid
);
```

Access model options:

- Public `buyProductFor`: anyone can pay for anyone.
- Allowlisted payer/router: only trusted receiver/backend can call.
- Signature-gated: buyer must authorize product, price, deadline, and payer.

Signature-gated is safest.

### Frontend Changes Needed

- Use Unified Balance spend to fund the payer/router.
- Include buyer signature in checkout intent.
- Wait for the payer/router/backend to call `buyProductFor`.
- Order history can remain mostly unchanged because `OrderPaid.buyer` is the real buyer.

### Backend Changes Needed

If using receiver:

- Less backend custody.
- Backend can remain mostly event-driven.
- May still verify intents and assist settlement.

If using backend merchant wallet:

- Backend must verify incoming spend.
- Backend must submit `buyProductFor`.
- Backend must guard against duplicate spends and duplicate order creation.

### Security Risks

- Requires store redeploy and migration from the current deployed contract.
- Public `buyProductFor` can allow forced purchases for another address unless signature-gated.
- Backend or receiver must not create orders for stale prices or sold-out products after the user spends.
- If backend receives funds, backend custody and operational key risk increase.
- If Forwarding Service is used, minted destination amount can be less than the displayed spend amount; price coverage must be validated before calling `buyProductFor`.

### Can Voucher Order Be Tied to Original Buyer?

Yes, cleanly.

The store order can directly record the original buyer. This preserves the existing order history and voucher reveal model.

### Compatibility With Current MVP

Medium.

The application model remains compatible, but the deployed `ArcVoucherStore` must be changed and redeployed. Direct checkout can remain unchanged.

### Recommended For Testnet?

Recommended only if a testnet redeploy is acceptable.

This is the cleanest long-term model because on-chain order state remains truthful and buyer-attributed. For v0.2.1, it is more invasive than Option A because it changes the core store contract.

## Option C: Backend-Assisted Fulfillment After Spend Transfer

### Summary

Use Unified Balance spend to transfer Arc USDC to a backend-controlled merchant wallet. The backend then fulfills the voucher off-chain or calls the current store as itself.

This can be implemented with the current deployed store and no new contract, but it weakens the on-chain order model.

### Transaction Flow

Possible flow C1, off-chain order:

1. Buyer creates backend checkout intent.
2. Frontend calls `kit.unifiedBalance.spend(...)` to backend merchant wallet.
3. Backend verifies spend.
4. Backend generates and stores voucher.
5. Backend serves voucher to buyer.
6. No `ArcVoucherStore.OrderPaid` exists.

Possible flow C2, backend buys through current store:

1. Buyer creates backend checkout intent.
2. Frontend calls `kit.unifiedBalance.spend(...)` to backend merchant wallet.
3. Backend verifies spend.
4. Backend calls:
   - `ArcVoucherStore.buyProduct{value: product.price}(productId)`
5. Store order buyer is backend wallet.
6. Backend maps store order to original buyer off-chain.
7. Backend fulfills store order.

### Contract Changes Needed

None.

### Frontend Changes Needed

- Add backend checkout-intent flow.
- Call `kit.unifiedBalance.spend(...)` to backend merchant wallet.
- Poll backend fulfillment/order status.
- `/orders` must include backend-mapped orders because store buyer will not equal the connected wallet.

### Backend Changes Needed

- Merchant wallet custody.
- Checkout intent creation and verification.
- Spend receipt verification.
- Stock and product validation.
- Duplicate spend/order protection.
- Voucher generation and reveal authorization.
- Optional call to current `buyProduct`.
- Manual refund path if anything fails after spend.

### Security Risks

- Highest trust requirement.
- Backend can misattribute orders.
- Backend can fail after receiving funds.
- Backend custody risk.
- On-chain order buyer is backend, not user.
- Refunds are manual or backend-mediated.
- Stock can sell out between spend and backend purchase.
- If no store order is created, product/stock/order state is not on-chain, which conflicts with ArcVoucher's core architecture.

### Can Voucher Order Be Tied to Original Buyer?

Only off-chain.

If backend calls the current store, the on-chain buyer is the backend wallet. The original buyer must be tracked in backend storage.

### Compatibility With Current MVP

High from an implementation standpoint, but low from a protocol-quality standpoint.

It requires no store redeploy and no new contract, but it bypasses or weakens the on-chain order model.

### Recommended For Testnet?

Not recommended except as a temporary demo fallback.

This option is useful for validating App Kit spend mechanics quickly, but it should not be the primary v0.2.1 architecture if ArcVoucher wants on-chain product, stock, and order truth.

## Comparison Matrix

| Criterion | Option A: PaymentReceiver | Option B: `buyProductFor` | Option C: Backend-assisted |
| --- | --- | --- | --- |
| Changes `ArcVoucherStore` | No | Yes | No |
| Requires new contract | Yes | Optional but likely | No |
| Preserves direct checkout | Yes | Yes | Yes |
| Store order buyer is original buyer | No | Yes | No |
| Original buyer recoverable | Yes, via receiver events | Yes, directly on-chain | Yes, off-chain only |
| Existing `/orders` works unchanged | No | Mostly yes | No |
| Refund complexity | High | Low to medium | High |
| Backend custody | Low to medium | Low with receiver, medium with backend wallet | High |
| Testnet speed | Medium | Medium if redeploy OK | Fast |
| Long-term protocol quality | Medium | High | Low |

## Recommended v0.2.1 Testnet Approach

Use Option A for v0.2.1 testnet if the current deployed `ArcVoucherStore` must remain unchanged.

Rationale:

- It respects the instruction not to change `ArcVoucherStore.sol`.
- It keeps the existing direct checkout intact.
- It lets App Kit Unified Balance spend target a real Arc recipient address.
- It still creates a real `ArcVoucherStore` order and reduces stock on-chain.
- It can be built as an integration layer and replaced later.

Required safeguards for Option A:

- Use signed checkout intents with buyer, productId, price, receiver, chainId, deadline, and nonce.
- Receiver must reject reused or expired intents.
- Receiver/backend must verify exact product price before settlement.
- Receiver/backend must handle sold-out settlement failures with a clear refund path.
- Voucher reveal must authorize against `PaymentReceiver.originalBuyerOf(orderId)`, not only `ArcVoucherStore.orders(orderId).buyer`.
- Frontend order history must merge direct store orders with receiver-settled orders.
- Refund release must be explicitly designed because `ArcVoucherStore` will refund the receiver.

## Recommended Long-Term Approach

Move to Option B when a store redeploy or v0.3 contract migration is acceptable.

The clean version is:

1. Add signature-gated `buyProductFor`.
2. Use a minimal trusted payment router or receiver to bridge Unified Balance spend settlement into the store.
3. Store the original buyer directly in `ArcVoucherStore.orders`.
4. Keep the existing backend listener and voucher reveal flow mostly unchanged.

This produces the best on-chain truth model and simplest voucher authorization.

## Open Questions Before Implementation

1. Does App Kit Unified Balance support contract-call payloads on destination, or only destination mint/transfer to `recipientAddress`?
   - The reviewed docs show recipient-address spend, not arbitrary calldata.
2. For Forwarding Service spends, can the UI reliably calculate a spend amount that guarantees exactly `product.price` arrives at the receiver after forwarding fees?
   - The fee docs say forwarding fees are deducted from the destination minted amount.
3. Should v0.2.1 use Forwarding Service?
   - It simplifies destination submission but complicates exact received amount and tx hash handling.
4. Should Unified Balance checkout reserve stock before spend?
   - Current store has no reservation model. Receiver/backend must handle stock race.
5. Should `PaymentReceiver` settlement be callable by the buyer, backend, or both?
   - Backend-assisted settlement is easier to verify; buyer-callable settlement reduces backend liveness risk but requires more on-chain validation.

## Decision

For v0.2.1 testnet:

- Prefer Option A: `PaymentReceiver` contract with signed checkout intents.
- Keep direct checkout as default.
- Do not bypass `ArcVoucherStore` for voucher issuance.
- Treat Option C only as a manual fallback for App Kit spend testing.
- Plan Option B as the long-term contract model when redeployment is acceptable.

## v0.2.1 Implementation Note

ArcVoucher v0.2.1 implements Option A with `ArcVoucherPaymentReceiver`.

The receiver:

- Accepts native Arc USDC payments through `receiveUnifiedPayment(address buyer, uint256 productId, bytes32 referenceId)`.
- Stores payment records with buyer, product, amount, reference, status, and timestamp.
- Allows owner/backend settlement through `settleToStore(uint256 paymentId)`.
- Allows owner/backend refund through `refundUnifiedPayment(uint256 paymentId)`.
- Emits receiver-level events that preserve the original buyer:
  - `UnifiedPaymentReceived`
  - `UnifiedPaymentSettled`
  - `UnifiedPaymentRefunded`

Critical limitation:

- `ArcVoucherStore.buyProduct(productId)` still records `msg.sender`.
- When the receiver settles, `msg.sender` is the receiver contract.
- Therefore, the `ArcVoucherStore` order buyer is the receiver contract, not the wallet that initiated Unified Balance checkout.
- The original buyer is preserved in `ArcVoucherPaymentReceiver` state and events.

This is acceptable for v0.2.1 testnet/demo because it proves the real Unified Balance spend-to-Arc settlement bridge without modifying the already deployed `ArcVoucherStore`.

v0.3.0 should add a store-level buyer-preserving purchase primitive such as:

```solidity
function buyProductFor(address buyer, uint256 productId) external payable returns (uint256 orderId);
```

The preferred v0.3.0 shape is signature-gated so third-party payers, receivers, or backend delegates cannot create unwanted orders for a buyer.
