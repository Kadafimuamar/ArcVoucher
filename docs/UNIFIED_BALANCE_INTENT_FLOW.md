# ArcVoucher v0.2.4 Unified Balance Intent Flow

## Scope

This document designs and records the v0.2.4 backend intent mapping flow for App Kit Unified Balance spend after confirming that `@circle-fin/app-kit@1.7.0` cannot send calldata with `unifiedBalance.spend()`.

Current deployed contracts:

- `ArcVoucherStore`: `0x7fe4C334670BE2fe5Fe840809E45ddB1b23b436c`
- `ArcVoucherPaymentReceiver`: `0xBcB39b7c36B22B1Da4DfF828Cd392233c84893f6`

## Relevant Finding

`unifiedBalance.spend()` is a funds-delivery API. It can deliver USDC/native value to a destination chain recipient address, but it does not expose calldata, ABI, function args, memo, metadata, or a reference field.

Therefore it cannot directly call:

```solidity
receiveUnifiedPayment(address buyer, uint256 productId, bytes32 referenceId)
```

The only receiver entry point that may be reached by a raw spend is:

```solidity
receive() external payable
```

## What Happens With The Current Receiver

Current `ArcVoucherPaymentReceiver.receive()` does this:

```solidity
receive() external payable {
    _recordPayment(msg.sender, 0, bytes32(0), msg.value);
}
```

If Unified Balance spend sends native Arc USDC directly to the receiver:

1. A `UnifiedPayment` record is created.
2. `buyer` is set to `msg.sender`.
3. `productId` is set to `0`.
4. `referenceId` is set to zero.
5. `amount` is set to `msg.value`.
6. `status` is `Received`.

The critical ambiguity is `msg.sender`. For a direct wallet transfer it may be the wallet, but for App Kit / Gateway / Forwarding Service delivery it may be a minter, relayer, forwarder, Gateway contract, or another infrastructure address. It is not safe to assume it is the original ArcVoucher buyer.

## Does The Current Receiver Store Enough Data?

No.

The raw payment record does not contain:

- original buyer
- product id
- checkout reference id
- frontend spend result
- transfer id
- source chains
- expected amount
- expiry/deadline
- buyer authorization

It also cannot settle through the existing settlement function:

```solidity
function settleToStore(uint256 paymentId) external onlyOperator returns (uint256 storeOrderId)
```

because `settleToStore` rejects raw payments where `productId == 0` or `buyer == address(0)`:

```solidity
if (payment.productId == 0 || payment.buyer == address(0)) {
    revert InvalidPaymentMetadata();
}
```

## Can Backend Attach Metadata After Raw Payment Arrives?

Not with the current contract.

The backend can store an off-chain mapping from a raw payment to a buyer/product, but there is no receiver function to attach that metadata on-chain. There is also no safe withdrawal function that lets the backend move a raw payment into `ArcVoucherStore.buyProduct(productId)`.

The current refund path is also unsafe for raw App Kit spends:

```solidity
refundUnifiedPayment(paymentId)
```

It sends funds to `payment.buyer`. For raw receiver payments, `payment.buyer` is `msg.sender` from `receive()`, which may be Gateway/forwarder infrastructure rather than the real buyer.

Conclusion:

- Current receiver is suitable for explicit payable calls to `receiveUnifiedPayment(...)`.
- It is not suitable for raw `unifiedBalance.spend()` delivery.
- Sending real Unified Balance funds to the current receiver risks trapping funds or refunding the wrong address.

## Backend Intent Mapping Requirements

A real intent flow needs two records:

1. A checkout intent with buyer/product metadata.
2. A raw on-chain payment record produced by `receive()`.

The backend must then match them and instruct the receiver to attach and settle.

Minimum intent fields:

- `intentId`
- `buyer`
- `productId`
- `expectedAmount`
- `referenceId`
- `receiver`
- `deadline`
- `status`
- `createdAt`
- optional `buyerSignature`

Minimum raw payment fields:

- `rawPaymentId`
- `payer`
- `amount`
- `createdAt`
- optional `txHash`

Minimum matched fields:

- `intentId`
- `rawPaymentId`
- `amountAttached`
- `matchedBy`
- `settledStoreOrderId`
- `settlementTxHash`

Backend matching should use:

- receiver address
- amount
- time window
- frontend `spendResult.txHash`
- frontend `spendResult.transferId` when Forwarding Service is used
- destination chain
- buyer session/address
- product price at intent creation

Matching by amount and time alone is not enough.

## v0.2.4 Receiver Redesign

Deploy a new `IntentPaymentReceiver` rather than modifying the existing deployed receiver.

The v0.2.4 implementation contract is:

```text
contracts/src/ArcVoucherIntentPaymentReceiver.sol
```

### Data Model

```solidity
enum IntentStatus {
    Created,
    PaymentAttached,
    Settled,
    Refunded,
    Cancelled
}

struct Intent {
    uint256 id;
    address buyer;
    uint256 productId;
    uint256 expectedAmount;
    bytes32 referenceId;
    IntentStatus status;
    uint256 rawPaymentId;
    uint256 createdAt;
}

struct RawPayment {
    uint256 id;
    address sender;
    uint256 amount;
    bool attached;
    uint256 createdAt;
}
```

### Functions

```solidity
function createIntent(
    address buyer,
    uint256 productId,
    uint256 expectedAmount,
    bytes32 referenceId
) external onlyOperator returns (uint256 intentId);

receive() external payable;

function attachPayment(
    uint256 intentId,
    uint256 rawPaymentId
) external onlyOperator;

function settleIntent(
    uint256 intentId
) external onlyOperator returns (uint256 storeOrderId);

function refundIntent(
    uint256 intentId
) external onlyOperator;

function cancelIntent(
    uint256 intentId
) external onlyOperator;
```

Optional hardening:

```solidity
function originalBuyerOfStoreOrder(uint256 storeOrderId) external view returns (address);
```

### Events

```solidity
event IntentCreated(
    uint256 indexed intentId,
    address indexed buyer,
    uint256 indexed productId,
    uint256 expectedAmount,
    bytes32 referenceId
);

event RawPaymentReceived(
    uint256 indexed rawPaymentId,
    address indexed payer,
    uint256 amount
);

event PaymentAttached(
    uint256 indexed intentId,
    uint256 indexed rawPaymentId,
    address indexed buyer,
    uint256 amount
);

event IntentSettled(
    uint256 indexed intentId,
    uint256 indexed storeOrderId,
    address indexed buyer,
    uint256 productId,
    uint256 amount
);

event IntentRefunded(
    uint256 indexed intentId,
    address indexed buyer,
    uint256 amount
);

event IntentCancelled(
    uint256 indexed intentId,
    address indexed buyer
);
```

### Flow

1. Frontend asks backend to create a Unified Balance checkout intent.
2. Backend verifies:
   - buyer address
   - product exists and active
   - available stock
   - current product price
   - expected receiver address
3. Backend calls `createIntent(...)`.
4. Frontend calls `kit.unifiedBalance.spend(...)` with:
   - `amount`: product price plus any required destination-fee buffer if needed
   - `to.chain`: `Arc_Testnet`
   - `to.recipientAddress`: `IntentPaymentReceiver`
5. Receiver `receive()` records a raw payment.
6. Frontend sends `spendResult` to backend.
7. Backend verifies destination and matching evidence.
8. Backend calls `attachPayment(intentId, rawPaymentId)`.
9. Backend calls `settleIntent(intentId)`.
10. Receiver calls:
    - `ArcVoucherStore.buyProduct{value: product.price}(productId)`
11. Store order buyer is still the receiver contract.
12. Receiver stores `storeOrderId` on the intent and emits `IntentSettled`.
13. Backend fulfills the store order and authorizes voucher reveal using intent buyer, not store order buyer.

### Amount Handling

`ArcVoucherStore.buyProduct(productId)` requires exact `msg.value == product.price`.

The v0.2.4 receiver handles:

- `amountReceived == expectedAmount`: settle normally.
- `amountReceived != expectedAmount`: reject attachment.

If Forwarding Service is used, the destination amount may be reduced by forwarding fees. The intent flow must verify the actual received amount before settlement.

### Refund Handling

Before settlement:

- `refundIntent(intentId)` should return attached funds to `intent.buyer`, not to raw `payer`.

After settlement:

- `ArcVoucherStore.refundOrder(storeOrderId)` refunds the store buyer.
- For receiver-settled orders, the store buyer is the receiver contract.
- The receiver should distinguish refunds from `ArcVoucherStore` from ordinary raw payments.
- A production-ready receiver should include a separate `releaseStoreRefund(storeOrderId)` or store-refund accounting path.

Important: a generic `receive()` that records every inbound payment as a raw checkout payment can misclassify store refunds. The redesigned receiver should special-case `msg.sender == address(store)`.

## Option Comparison

### Option 1: Keep Current Receiver And Use Backend Off-Chain Matching Only

Summary:

Use the existing receiver as a raw destination and let backend match spends to checkout intents off-chain.

Benefits:

- No new contract deployment.
- Fastest to test a raw `unifiedBalance.spend()` delivery to a contract address.

Problems:

- Raw receiver records have no buyer/product/reference.
- `settleToStore` cannot settle raw records because `productId == 0`.
- Backend cannot attach metadata on-chain.
- Funds can be stuck in the receiver.
- Refund may go to Gateway/forwarder infrastructure rather than the buyer.
- Voucher reveal would rely entirely on backend records.
- No clean on-chain audit trail tying raw spend to product checkout.

Compatibility:

- Poor for real checkout.
- Acceptable only for a tiny smoke test with throwaway funds.

Recommendation:

- Do not use for customer-facing testnet checkout.

### Option 2: Deploy New `IntentPaymentReceiver`

Summary:

Deploy a new receiver designed for raw spend delivery, with on-chain intents, raw payments, attachment, settlement, and refund paths.

Benefits:

- Keeps deployed `ArcVoucherStore` unchanged.
- Keeps direct checkout unchanged.
- Supports App Kit's actual recipient-address spend model.
- Preserves buyer/product/reference in on-chain receiver state.
- Gives backend a deterministic settlement function after it verifies the spend.
- Allows safer buyer refunds for unsettled payments.

Problems:

- Store order buyer is still the receiver contract.
- Backend matching remains trusted unless each intent receives a unique deposit address.
- Stock can sell out between intent creation and settlement.
- Product price can change between intent creation and settlement unless expected amount is enforced.
- Store refunds still need special receiver handling.

Compatibility:

- Best fit for v0.2.4 without changing `ArcVoucherStore`.
- Requires frontend/backend integration and a new deployment.

Recommendation:

- Safest testnet path.

### Option 3: Move Directly To v0.3 `ArcVoucherStoreV2` With `buyProductFor`

Summary:

Deploy a new store with a buyer-preserving payment function:

```solidity
function buyProductFor(address buyer, uint256 productId)
  external
  payable
  returns (uint256 orderId);
```

Benefits:

- Store order can record original buyer.
- Existing `/orders` and voucher reveal become simpler.
- Better long-term on-chain truth model.

Problems:

- Requires store redeploy and migration/reseed.
- Does not by itself solve `unifiedBalance.spend()` lacking calldata.
- Still needs either:
  - a receiver/router funded by raw spend, or
  - backend merchant wallet settlement.
- Public `buyProductFor` can create unwanted orders unless signature-gated or allowlisted.

Compatibility:

- Best long-term architecture.
- More disruptive than v0.2.4.

Recommendation:

- Plan for v0.3, but do not block v0.2.4 testnet validation on it.

## Recommended Safest Testnet Path

Deploy a new `IntentPaymentReceiver` for v0.2.4.

Rationale:

- It matches the confirmed App Kit behavior: recipient-address delivery with no calldata.
- It avoids sending more funds into the current receiver, which cannot attach metadata or settle raw payments.
- It preserves direct checkout and the deployed store.
- It creates an on-chain record of buyer/product/reference before settlement.
- It gives backend a clean place to attach verified raw payments and settle or refund.

Recommended implementation order:

1. Implement `IntentPaymentReceiver`.
2. Add Foundry tests for:
   - create intent
   - reject invalid intent
   - raw receive
   - attach raw payment to intent
   - reject double attach
   - reject underpayment settlement
   - settle intent to store
   - refund unsettled intent to buyer
   - special-case store refunds
3. Add backend intent persistence.
4. Add backend receiver event listener.
5. Add backend spend-result verification endpoint.
6. Add frontend real `unifiedBalance.spend()` behind a clear testnet warning.
7. Merge direct store orders and receiver intent orders in `/orders`.

## v0.2.4 Implementation Note

`ArcVoucherIntentPaymentReceiver` has been added as a new contract without modifying `ArcVoucherStore.sol` or removing `ArcVoucherPaymentReceiver.sol`.

Implemented behavior:

* owner/backend operator can create intents
* raw `receive()` stores sender, amount, attached flag, and timestamp
* owner/backend operator can attach an exact-value raw payment to a created intent
* owner/backend operator can settle an attached intent into `ArcVoucherStore.buyProduct(productId)`
* owner/backend operator can refund an attached intent to the original buyer
* owner/backend operator can cancel a created intent before payment attachment
* reference ids can be looked up with `findIntentByReferenceId(bytes32)`

Known limitation:

* `ArcVoucherStore` still records the receiver as buyer for settled Unified Balance intents.
* The original buyer is preserved in receiver intent state and receiver events.
* Backend order history and voucher reveal must use receiver intent state for Unified Balance orders.

## Open Design Questions

1. Should `createIntent` be backend-only or buyer-callable?
   - Backend-only is simpler for testnet.
   - Buyer-callable needs signature/replay controls but improves transparency.
2. Should each intent get a unique receiver address?
   - This is the strongest matching model.
   - It requires a factory/minimal proxy pattern.
3. Should the receiver allow overpayment?
   - If yes, excess must be refundable to buyer.
   - If no, Forwarding Service fee behavior may cause fragile failures.
4. Should the backend settle immediately or wait for stock revalidation?
   - It should always revalidate product status and available stock before settlement.
5. How should store refunds be released to original buyers?
   - v0.2.4 needs at least a documented manual path.
   - A production receiver needs explicit store-refund accounting.

## Final Recommendation

For v0.2.4, do not use the currently deployed `ArcVoucherPaymentReceiver` for real Unified Balance spend payments.

Deploy a new `IntentPaymentReceiver` that supports raw spend delivery and backend-verified intent attachment. Treat this as the safe testnet bridge. Then move to v0.3 `ArcVoucherStoreV2.buyProductFor(...)` for the cleaner long-term model where the store itself records the original buyer.
