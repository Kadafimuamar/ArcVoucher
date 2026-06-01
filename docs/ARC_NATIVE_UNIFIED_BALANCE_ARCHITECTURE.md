# Arc Native Unified Balance Architecture

## Scope

This document records the ArcVoucher architecture decision after testing App Kit Unified Balance spend behavior on Arc Testnet.

Observed transaction:

- Gateway contract: `0x0022222abe238cc2c7bb1f21003f0a260052475b`
- Intended recipient: `ArcVoucherIntentPaymentReceiver`
- Result: the recipient address was credited through Gateway/Arc infrastructure, but the recipient contract `receive()` was not called.

No contracts are changed by this document.

## Sources Reviewed

- [Unified Balance overview](https://docs.arc.io/app-kit/unified-balance)
- [Deposit and spend a Unified Balance](https://docs.arc.io/app-kit/quickstarts/unified-balance-deposit-and-spend)
- [Use a delegate to deposit and spend a Unified Balance](https://docs.arc.io/app-kit/quickstarts/unified-balance-delegate-deposit-and-spend)
- [Use Forwarding Service](https://docs.arc.io/app-kit/tutorials/unified-balance/use-forwarding-service)
- [SDK Reference](https://docs.arc.io/app-kit/references/sdk-reference)
- Local installed types for `@circle-fin/app-kit@1.7.0`

## Confirmed Unified Balance Behavior

`unifiedBalance.spend()` is a Gateway-backed USDC delivery operation. It spends from one or more Unified Balance source accounts and mints or credits USDC on the destination chain to a `recipientAddress`.

The SDK reference describes `spend` as spending or minting USDC on a destination chain. Its result includes:

- `recipientAddress`
- `destinationChain`
- `txHash`
- `explorerUrl`
- `fees`
- `transferId` when `useForwarder` is enabled
- `steps`

The installed `SpendParams`, `SpendDestination`, `ForwarderSpendDestination`, and `SpendConfig` types do not expose fields for:

- calldata
- ABI
- function name
- function arguments
- memo
- metadata
- reference id

Therefore, Unified Balance spend should be treated as value delivery, not as an application callback or arbitrary contract execution primitive.

## Forwarding Service Behavior

Forwarding Service can be enabled with:

```ts
to: {
  chain: "Arc_Testnet",
  recipientAddress,
  useForwarder: true,
}
```

Arc docs describe Forwarding Service as fetching attestations from source blockchains and submitting the mint on the destination blockchain. It is useful when the application does not have access to a wallet on the destination chain or wants Circle's relayer to handle destination mint submission.

Forwarding Service does not add a contract-call hook in the App Kit Unified Balance spend API. It still targets a `recipientAddress`. The result may include a `transferId`, which can be used to query transfer status, but that transfer id is evidence of the Gateway transfer, not ArcVoucher order metadata.

Forwarding Service fees may be deducted from the amount minted on the destination chain. ArcVoucher must account for this before treating a spend as exact product payment.

## Delegate Spend Behavior

Delegate deposit and spend lets a backend or delegate wallet deposit into or spend from a user's Unified Balance after the user authorizes the delegate.

This changes who signs and initiates the spend. It does not change the destination execution model. A delegated spend still delivers USDC to a recipient address and does not carry ArcVoucher calldata or metadata through `unifiedBalance.spend()`.

Delegate flows may be useful later for smoother merchant-managed checkout, but they do not solve the need to trigger ArcVoucher order logic after a spend.

## Direct Answers

### 1. What is the Arc-recommended way to trigger application logic after a Unified Balance spend?

The Arc-native pattern is to treat Unified Balance spend as the payment rail, then trigger application logic separately after verifying the spend result.

For ArcVoucher, this means:

1. Create an off-chain checkout intent before spend.
2. Call `unifiedBalance.spend()` to deliver USDC to the configured ArcVoucher settlement address.
3. Capture `SpendResult` fields such as `txHash`, `transferId`, `recipientAddress`, `destinationChain`, `fees`, and `steps`.
4. Backend verifies that the spend completed, arrived at the expected recipient, used the expected destination chain, matches the expected amount after fees, and has not been reused.
5. Backend performs ArcVoucher application logic in a separate step.

If application logic must happen on-chain, it must be a separate transaction after spend verification.

### 2. Can Forwarding Service execute a contract call after spend?

No, not through the installed App Kit Unified Balance API.

Forwarding Service can submit the destination mint and deliver funds to a recipient address. It does not expose a post-spend contract-call field, calldata field, or callback field for the recipient contract.

The tested behavior confirms this: the Gateway spend went to Gateway infrastructure, and the recipient contract's `receive()` was not executed.

### 3. Can spend carry metadata or reference information?

No, not in the installed `@circle-fin/app-kit@1.7.0` Unified Balance spend API.

There is no `metadata`, `memo`, `referenceId`, or calldata field in the spend parameter types. ArcVoucher must carry intent metadata outside the spend call, then bind it to the spend result with backend verification.

The safest binding keys are:

- backend `intentId`
- backend `referenceId`
- wallet address/session
- expected product id
- expected amount
- expected recipient address
- expected destination chain
- spend `txHash`
- spend `transferId` when Forwarding Service is used
- timestamp and expiry window

### 4. Should ArcVoucher use off-chain intent verification, Forwarding Service, or another Arc-native pattern?

ArcVoucher should use off-chain intent verification for v0.2.x.

Forwarding Service can be used as a transport option for destination mint execution, but it should not be treated as the application trigger. It does not replace off-chain intent verification.

For the long-term ArcVoucher model, the best Arc-native pattern is:

- Unified Balance spend delivers USDC to a configured ArcVoucher settlement or treasury address.
- Backend verifies the spend result and transfer evidence.
- Backend executes application settlement separately.
- v0.3 should introduce `ArcVoucherStoreV2.buyProductFor(address buyer, uint256 productId)` or a signature-gated equivalent so the store can preserve the original buyer when a receiver/backend settles payment.

## Recommended ArcVoucher Flow

### v0.2.x Testnet Flow

1. Frontend requests a checkout intent from backend:
   - `buyer`
   - `productId`
   - `expectedAmount`
   - `referenceId`
   - `recipientAddress`
   - `expiresAt`
2. Backend stores the intent as `Created`.
3. Frontend calls `kit.unifiedBalance.spend()`:
   - token: `USDC`
   - amount: product price as a decimal string
   - destination chain: `Arc_Testnet`
   - recipient: ArcVoucher settlement address
   - optional `useForwarder: true` only after fee behavior is handled
4. Frontend sends the full spend result to backend.
5. Backend verifies:
   - spend success
   - destination chain is Arc Testnet
   - recipient address is the configured ArcVoucher settlement address
   - spend amount and destination amount are acceptable
   - `txHash` or `transferId` has not been used before
   - spend happened inside the intent expiry window
   - buyer/session matches the intent
6. Backend marks the intent as paid.
7. Backend fulfills the mock voucher directly for the verified intent in v0.2.x.
8. Voucher reveal is authorized against the original intent buyer.

The v0.2.x implementation uses:

- `POST /intents`
- `POST /intents/:id/confirm-spend`
- `GET /intents/:id`
- `GET /intents/:id/voucher?buyer=0x...`

`confirm-spend` verifies the Arc Testnet transaction receipt and native USDC credit evidence before marking the intent paid.

### v0.3 Target Flow

1. Deploy `ArcVoucherStoreV2` with buyer-preserving settlement:

```solidity
function buyProductFor(address buyer, uint256 productId)
    external
    payable
    returns (uint256 orderId);
```

2. Restrict `buyProductFor` to a trusted payment receiver/backend operator, or require a buyer signature.
3. After verified Unified Balance spend, backend or receiver settles into `buyProductFor`.
4. Store order records the original buyer directly.

## Current Intent Receiver Implication

`ArcVoucherIntentPaymentReceiver.receive()` is not a reliable Unified Balance spend trigger.

It remains useful for ordinary native transfers that execute recipient code, but Unified Balance Gateway spend does not necessarily perform an EVM call into the recipient contract. Therefore:

- `RawPaymentReceived` should not be the primary signal for Unified Balance spend.
- backend should not wait for `RawPaymentReceived` before verifying spend success.
- intent matching must be based on spend result and Gateway/Arc evidence, not receiver `receive()` events.

For intent `5`, the break point is the assumption that Gateway spend calls the recipient contract. It does not.

## v0.2.x Backend Verification

ArcVoucher v0.2.x now treats `unifiedBalance.spend()` output as payment evidence.

Backend verification checks:

1. The intent exists and has not expired.
2. The request buyer matches `intent.buyer`.
3. The request amount matches `intent.expectedAmount`.
4. The request recipient matches the configured ArcVoucher settlement address.
5. The spend transaction hash has not already been used by another intent.
6. The Arc Testnet receipt status is successful.
7. The transaction was sent to the Arc Gateway contract.
8. The transaction sender matches the intent buyer for the current wallet-signed testnet flow.
9. The receipt contains a native USDC `Transfer` credit from the zero address to the configured recipient for the exact expected amount.

After verification:

1. The backend marks the intent as `paid`.
2. The backend generates the mock voucher.
3. The backend stores the voucher under the original intent buyer.
4. The backend marks the intent as `voucher_fulfilled`.

This is intentionally off-chain voucher fulfillment for v0.2.x. It avoids pretending the receiver contract observed a payment event that Gateway spend does not emit.

## What Not To Do

- Do not assume `msg.sender` on the recipient contract is the buyer.
- Do not assume `msg.value` is delivered through a recipient contract call.
- Do not wait for `RawPaymentReceived` as proof of a Unified Balance spend.
- Do not call `attachPayment` or `settleIntent` from `RawPaymentReceived` for Unified Balance spend.
- Do not use Forwarding Service as if it were a post-spend callback system.
- Do not encode product or buyer metadata into `spend()` parameters; the API does not expose a metadata field.
- Do not treat `transferId` as order metadata. It is payment evidence only.

## Decision

ArcVoucher should adopt this architecture:

1. Keep direct Arc checkout as the default and simplest on-chain path.
2. For Unified Balance, use backend-created checkout intents and backend-verified spend results.
3. Use Forwarding Service only when it improves delivery reliability or removes the need for a destination wallet, while still verifying the spend off-chain.
4. Do not rely on recipient contract `receive()` for Unified Balance spend detection.
5. Move v0.3 toward a buyer-preserving `ArcVoucherStoreV2` settlement function.

This is the correct Arc-native path because it follows App Kit's actual Unified Balance model: Unified Balance moves USDC; the application triggers its own order logic after verifying that movement.
