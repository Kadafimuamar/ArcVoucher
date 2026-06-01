# ArcVoucher v0.2.3 Unified Balance Spend API Investigation

## Scope

This investigation verifies the installed App Kit Unified Balance API from local TypeScript types and compares it with the Arc docs already referenced by the project.

No frontend behavior or smart contracts were changed.

## Installed Packages

Inspected local packages:

- `frontend/node_modules/@circle-fin/app-kit`
  - version: `1.7.0`
  - types: `frontend/node_modules/@circle-fin/app-kit/index.d.ts`
- `frontend/node_modules/@circle-fin/adapter-viem-v2`
  - version: `1.11.2`
  - types: `frontend/node_modules/@circle-fin/adapter-viem-v2/index.d.ts`

## Exact Unified Balance Method Signatures

From `@circle-fin/app-kit/index.d.ts`:

```ts
class AppKitUnifiedBalance {
  spend(params: SpendParams): Promise<SpendResult>;
  estimateSpend(params: SpendParams): Promise<EstimateSpendResult>;
  getBalances(params: GetBalancesParams): Promise<GetBalancesResult>;
  getSupportedChains(token?: SupportedToken, options?: GetSupportedChainsOptions): ChainDefinition[];
}
```

### `SpendParams`

```ts
type SpendParams<
  TFromAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TToAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TChainIdentifier extends UnifiedBalanceChainIdentifier = UnifiedBalanceChainIdentifier
> =
  | SpendParamsWithFrom<TFromAdapterCapabilities, TToAdapterCapabilities, TChainIdentifier>
  | SpendParamsRetry<TFromAdapterCapabilities, TToAdapterCapabilities, TChainIdentifier>;
```

Standard spend:

```ts
interface SpendParamsWithFrom<
  TFromAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TToAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TChainIdentifier extends UnifiedBalanceChainIdentifier = UnifiedBalanceChainIdentifier
> extends SpendParamsBase<TToAdapterCapabilities, TChainIdentifier> {
  from: SpendSource<TFromAdapterCapabilities> | SpendSource<TFromAdapterCapabilities>[];
}
```

Base fields:

```ts
interface SpendParamsBase<
  TToAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TChainIdentifier extends UnifiedBalanceChainIdentifier = UnifiedBalanceChainIdentifier
> {
  to: SpendDestinationUnion<TToAdapterCapabilities, TChainIdentifier>;
  token?: SupportedTokenInput;
  amount: string;
  config?: SpendConfig;
}
```

### `SpendSource`

```ts
type SpendSource<TAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities> = {
  adapter: Adapter<TAdapterCapabilities>;
  allocations?: Allocation | Allocation[];
  sourceAccount?: string;
} & AddressField<ExtractAddressContext<TAdapterCapabilities>>;
```

Important details:

- `allocations` can specify exact source chain amounts.
- `sourceAccount` is the delegate path. The signer can spend from another Gateway account only if authorized as delegate.

### `SpendDestination`

```ts
type SpendDestination<
  TAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TChainIdentifier extends UnifiedBalanceChainIdentifier = UnifiedBalanceChainIdentifier
> = {
  adapter: Adapter<TAdapterCapabilities>;
  chain: TChainIdentifier;
  recipientAddress?: string;
  useForwarder?: boolean;
} & AddressField<ExtractAddressContext<TAdapterCapabilities>>;
```

Forwarder-only destination:

```ts
interface ForwarderSpendDestination<
  TChainIdentifier extends UnifiedBalanceChainIdentifier = UnifiedBalanceChainIdentifier
> {
  chain: TChainIdentifier;
  recipientAddress: string;
  useForwarder: boolean;
}
```

Destination union:

```ts
type SpendDestinationUnion<
  TAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities,
  TChainIdentifier extends UnifiedBalanceChainIdentifier = UnifiedBalanceChainIdentifier
> =
  | SpendDestination<TAdapterCapabilities, TChainIdentifier>
  | ForwarderSpendDestination<TChainIdentifier>;
```

### `SpendConfig`

```ts
interface SpendConfig {
  customFee?: CustomFeeConfig;
  retry?: RetryMintConfig;
}
```

There is no `data`, `calldata`, `abi`, `functionName`, `args`, `memo`, `metadata`, or `reference` field in `SpendParams`, `SpendDestination`, `ForwarderSpendDestination`, or `SpendConfig`.

### `SpendResult`

```ts
interface SpendResult {
  allocations?: AllocationResult[];
  recipientAddress: string;
  destinationChain: Blockchain;
  txHash: string;
  explorerUrl?: string;
  fees?: FeeEntry[];
  transferId?: string;
  expirationBlock?: string;
  steps?: SpendStep[];
}
```

### `EstimateSpendResult`

```ts
interface EstimateSpendResult {
  fees: FeeEntry[];
}
```

### `GetBalancesParams`

```ts
interface GetBalancesParams<TAdapterCapabilities extends AdapterCapabilities = AdapterCapabilities> {
  token?: SupportedTokenInput;
  sources: Sources<TAdapterCapabilities>;
  includePending?: boolean;
  networkType?: NetworkType;
}
```

### `GetBalancesResult`

```ts
interface GetBalancesResult {
  token: SupportedToken;
  totalConfirmedBalance: string;
  totalPendingBalance?: string;
  breakdown: BalanceWithPendingBreakdown[];
}
```

### `GetSupportedChainsOptions`

```ts
interface GetSupportedChainsOptions {
  forwarderSupported?: "source" | "destination";
}
```

## Capability Matrix

| Capability | Supported by `unifiedBalance.spend` types? | Notes |
| --- | --- | --- |
| Destination blockchain | Yes | `to.chain` |
| Destination address | Yes | `to.recipientAddress`; optional with destination adapter, required in forwarder-only destination |
| Token | Yes | `token?: SupportedTokenInput`; docs and types indicate USDC |
| Amount | Yes | top-level `amount: string` |
| Source chain selection | Yes | `from.allocations` |
| Multiple source adapters | Yes | `from` can be an array |
| Delegate spend | Yes | `from.sourceAccount` plus delegate authorization |
| Forwarding Service | Yes | `to.useForwarder: true` |
| Custom fee | Yes | `config.customFee` or custom fee policy |
| Retry mint | Yes | `config.retry` |
| Contract calldata | No | No `data`, `calldata`, `abi`, `functionName`, or `args` fields |
| Native `msg.value` contract call | No direct support | Spend mints/delivers USDC to a recipient address, not an arbitrary contract invocation |
| Metadata, memo, reference ID | No | No field for attaching ArcVoucher `referenceId` |

## Adapter Findings

`@circle-fin/adapter-viem-v2` can prepare normal EVM contract calls outside the Unified Balance spend API:

```ts
interface EvmCallData {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint | undefined;
}

interface EvmPreparedChainRequest {
  execute(overrides?: EvmExecuteOverrides): Promise<string>;
  getCallData?(): EvmCallData;
}

class ViemAdapter {
  prepare(params: EvmPreparedChainRequestParams, ctx: OperationContext): Promise<EvmPreparedChainRequest>;
}
```

This confirms the Viem adapter has a generic contract-call mechanism, but that mechanism is not exposed through `unifiedBalance.spend` as a destination call payload. The spend API accepts a recipient address, not arbitrary EVM call data.

## Arc Docs Cross-Check

Reviewed docs:

- [Unified Balance overview](https://docs.arc.io/app-kit/unified-balance)
- [Deposit and spend a Unified Balance](https://docs.arc.io/app-kit/quickstarts/unified-balance-deposit-and-spend)
- [Use a delegate to deposit and spend a Unified Balance](https://docs.arc.io/app-kit/quickstarts/unified-balance-delegate-deposit-and-spend)
- [Select source blockchains](https://docs.arc.io/app-kit/tutorials/unified-balance/select-source-blockchains)
- [Estimate spend fees](https://docs.arc.io/app-kit/tutorials/unified-balance/estimate-spend-fees)
- [Use Forwarding Service](https://docs.arc.io/app-kit/tutorials/unified-balance/use-forwarding-service)
- [Manage delegates](https://docs.arc.io/app-kit/tutorials/unified-balance/manage-delegates)
- [SDK Reference](https://docs.arc.io/app-kit/references/sdk-reference)

The docs examples consistently use:

```ts
await kit.unifiedBalance.spend({
  amount: "1.00",
  from: { adapter, allocations: [{ amount: "1.00", chain: "Base_Sepolia" }] },
  to: {
    adapter,
    chain: "Arc_Testnet",
    recipientAddress: "0xRecipientAddress",
  },
  token: "USDC",
});
```

The forwarding docs also support omitting the destination adapter:

```ts
await kit.unifiedBalance.spend({
  amount: "1.00",
  from: { adapter, allocations: [{ amount: "1.00", chain: "Base_Sepolia" }] },
  to: {
    chain: "Arc_Testnet",
    recipientAddress: process.env.EVM_RECIPIENT_ADDRESS as string,
    useForwarder: true,
  },
  token: "USDC",
});
```

No reviewed docs page shows a calldata, memo, reference, or arbitrary payable contract-call destination.

## Direct Answer

Can `unifiedBalance.spend` call a payable contract function like this?

```solidity
receiveUnifiedPayment(address buyer, uint256 productId, bytes32 referenceId)
```

Answer: no, not with the installed App Kit `1.7.0` / Unified Balance types.

The spend API can deliver USDC to a destination `recipientAddress` on a destination chain. It does not expose fields to encode and execute arbitrary calldata against that address. Therefore it cannot directly call `receiveUnifiedPayment(address,uint256,bytes32)` with native value and function calldata.

If the recipient is a contract, a spend may deliver value to the contract address depending on Gateway/Arc mint semantics, but the App Kit API does not provide a way to include ArcVoucher metadata. At best, `ArcVoucherPaymentReceiver.receive()` can observe a raw payment without `buyer`, `productId`, or `referenceId` metadata.

## Implication For Current PaymentReceiver

Current receiver function:

```solidity
function receiveUnifiedPayment(address buyer, uint256 productId, bytes32 referenceId)
  external
  payable
  returns (uint256 paymentId)
```

This function is not directly callable by `kit.unifiedBalance.spend` because spend has no calldata field.

Current receiver fallback:

```solidity
receive() external payable
```

This can record raw incoming value if the destination mint/transfer invokes `receive()`, but raw payments are recorded with:

- `buyer = msg.sender`
- `productId = 0`
- `referenceId = 0x00`

That is insufficient for automated settlement into `ArcVoucherStore`.

## Recommended Next Architecture

### A. Backend Intent Mapping

Recommended for v0.2.3/v0.2.4 testing.

Flow:

1. Frontend creates a backend checkout intent:
   - `intentId`
   - `buyer`
   - `productId`
   - `price`
   - `receiver`
   - `deadline`
   - expected destination chain
2. Frontend calls `unifiedBalance.spend` to send USDC to the receiver address.
3. Backend watches the receiver address and Gateway spend result.
4. Backend matches incoming spend by:
   - buyer wallet/session
   - amount
   - destination receiver
   - timestamp window
   - `txHash` or `transferId` when available
5. Backend calls a redesigned receiver settlement or records enough off-chain context to settle/refund safely.

Risk:

- Without on-chain metadata, matching is probabilistic unless the frontend returns a reliable `txHash`/`transferId` to the backend and the backend verifies it.

### B. Forwarding Service

Useful for destination execution reliability, not for metadata.

Findings:

- `to.useForwarder: true` is supported.
- Forwarder-only destination supports `chain`, `recipientAddress`, and `useForwarder`.
- Forwarding fee is included in estimates and deducted from destination minted amount.
- The docs note that without a destination adapter, confirmation comes from Circle Iris API rather than a locally signed transaction.

Limitation:

- Forwarding Service still delivers to `recipientAddress`; it does not add calldata or ArcVoucher reference metadata.

Recommendation:

- Use Forwarding Service only if the product can tolerate amount variance after forwarding fees and backend verification can rely on `transferId`.

### C. v0.3 `buyProductFor`

Recommended long-term.

Reason:

- The clean on-chain model is still a store function that records the original buyer directly.
- A future router/receiver/backend can pay while the store records `buyer`.

Preferred shape:

```solidity
function buyProductFor(address buyer, uint256 productId)
  external
  payable
  returns (uint256 orderId);
```

Better production shape:

```solidity
function buyProductFor(
  address buyer,
  uint256 productId,
  uint256 deadline,
  bytes calldata buyerSignature
) external payable returns (uint256 orderId);
```

This does not solve the no-calldata limitation by itself, but it makes the backend/router settlement step produce correct store buyer attribution.

### D. Receiver Function Redesign

Recommended if keeping Option A without modifying the store.

Because spend cannot call `receiveUnifiedPayment`, redesign receiver around a two-step metadata attachment model:

```solidity
function createIntent(address buyer, uint256 productId, bytes32 referenceId, uint256 expectedAmount)
  external
  returns (uint256 intentId);

receive() external payable;

function attachPayment(uint256 intentId, uint256 rawPaymentId)
  external;

function settleIntent(uint256 intentId)
  external;
```

However, this still needs a reliable way to prove that a raw receiver payment corresponds to a given intent. The stronger version is to generate a unique receiver address per intent, but that requires a factory or minimal proxy pattern.

## Recommendation

For the next real-spend milestone:

1. Do not attempt to call `receiveUnifiedPayment(...)` directly from `unifiedBalance.spend`; the installed SDK types do not support it.
2. Implement backend intent mapping first, using `spend` result fields (`txHash`, `transferId`, `recipientAddress`, `destinationChain`, `fees`) as verification inputs.
3. Prefer Forwarding Service only after confirming exact amount behavior for Arc native USDC, because forwarding fees can reduce the destination amount.
4. Plan v0.3 around `buyProductFor` so receiver/backend settlement can preserve the original buyer in `ArcVoucherStore`.
5. If Option A remains necessary for demo continuity, redesign `ArcVoucherPaymentReceiver` to support pre-created intents and raw payment attachment, or deploy deterministic per-intent receiver addresses.

## Pseudocode If Using Current API

This is not a direct contract-function call. It only sends/mints USDC to the receiver address:

```ts
const spendResult = await kit.unifiedBalance.spend({
  amount: productPriceUsdc,
  token: "USDC",
  from: {
    adapter,
    allocations: selectedAllocations,
  },
  to: {
    adapter,
    chain: "Arc_Testnet",
    recipientAddress: arcVoucherPaymentReceiverAddress,
    // Optional only after verifying destination behavior:
    // useForwarder: true,
  },
});

await backend.recordUnifiedBalanceSpend({
  intentId,
  buyer,
  productId,
  receiver: arcVoucherPaymentReceiverAddress,
  spendResult,
});
```

