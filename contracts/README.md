# ArcVoucher Contracts

Foundry workspace for ArcVoucher smart contracts on Arc Testnet.

`ArcVoucherStore.sol` holds product, stock, order, refund, revenue, and voucher hash state. Voucher plaintext must stay off-chain.

## Arc Testnet

* RPC URL: `https://rpc.testnet.arc.network`
* Foundry RPC alias: `arc_testnet`
* Native currency for this contract: USDC via `msg.value`

## Environment

Copy the example file before deploying:

```bash
cp .env.example .env
```

Set:

```bash
PRIVATE_KEY=
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_VOUCHER_STORE_ADDRESS=
```

Never commit `.env` or private keys.

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

```bash
forge script script/DeployArcVoucher.s.sol:DeployArcVoucher \
  --rpc-url arc_testnet \
  --broadcast
```

After deployment, set `ARC_VOUCHER_STORE_ADDRESS` in `.env` to the deployed contract address.

## Seed Demo Products

```bash
forge script script/SeedProducts.s.sol:SeedProducts \
  --rpc-url arc_testnet \
  --broadcast
```

The seed script adds demo products and stock only. It does not store voucher plaintext.
