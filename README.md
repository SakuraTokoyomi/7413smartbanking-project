# SBIF Florist Shop POC

This project is now a pure static dApp for the florist-shop SBIF case.

## Core idea

The business logic is executed on a public blockchain, while access is permissioned through an on-chain compliance registry.

That means:

- all coupon issuance, redemption, expiry settlement, and fee distribution are recorded on-chain
- buyer wallets must first receive an on-chain compliance approval before they can transact
- compliance approval represents the result of an off-chain RegTech or open-banking check, but the permission itself is stored and enforced on-chain

This matches the assignment idea of a `public, permissioned` blockchain design.

## Why static hosting now works

The app no longer depends on a backend server for its core workflow.

The frontend now:

- connects directly to the blockchain through the wallet
- reads coupon state directly from the smart contract
- reads compliance records directly from the smart contract
- reconstructs transaction history from on-chain events
- calculates Scenario A and Scenario B locally in the browser

Because of that, the repository can be hosted directly on GitHub Pages.

## Contracts

### `ComplianceRegistry`

Purpose:

- store whether a wallet is allowed to interact
- record the approval method, for example:
  - `CHAINALYSIS`
  - `OPEN_BANKING`
- enforce expiry of the compliance record

Key functions:

- `grantCompliance(address user, uint64 expiry, bytes32 method)`
- `revokeCompliance(address user)`
- `isCompliant(address user)`
- `getRecord(address user)`

### `SBIFCouponSettlement`

Purpose:

- issue coupon positions on-chain
- redeem coupons on-chain
- process expired coupons on-chain
- distribute value to supplier, courier, merchant, and platform treasury

Permission model:

- `purchaseCoupon(...)` requires the buyer wallet to be compliant
- `redeemCoupon(...)` requires the buyer wallet to be compliant
- `processExpiredCoupons(...)` is merchant-only

## Frontend

The frontend is a dApp and reads directly from the blockchain.

It provides:

- wallet connection
- chain switching to local Ganache
- compliance status display
- compliance grant / revoke controls
- Scenario A / Scenario B simulation
- coupon purchase
- coupon redeem
- expired coupon processing
- on-chain coupon listing
- blockchain event history
- on-chain platform metrics

## Local run

### 1. Enter the project

```powershell
cd "c:\Users\Tokoyomi\Desktop\hku\smart_banking\7413smartbanking-project"
```

### 2. Start Ganache

```powershell
npm.cmd run chain
```

Ganache RPC:

```text
http://127.0.0.1:8545
```

Chain ID:

```text
1337
```

### 3. Compile contracts

```powershell
npm.cmd run compile:contract
```

### 4. Deploy contracts

In another PowerShell window, with Ganache still running:

```powershell
npm.cmd run deploy:contract
```

This writes deployed addresses and ABI to:

```text
public/contract-config.json
```

### 5. Preview the static dApp locally

Use any static file server. For example:

```powershell
python -m http.server 3000
```

Then open:

```text
http://localhost:3000/public/
```

If you use VS Code Live Server, open `public/index.html`.

## MetaMask setup

Add a custom network:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `1337`
- Currency symbol: `ETH`

Import one of the Ganache test accounts.

Then in the app:

1. click `Connect wallet`
2. click `Switch to local chain`
3. if you are using the merchant / compliance admin wallet, grant compliance to a buyer wallet
4. switch to the approved buyer wallet
5. purchase coupons
6. redeem coupons

## Test

Run everything:

```powershell
npm.cmd run test
```

This covers:

- calculation logic
- compliance gating
- on-chain purchase / redeem
- on-chain expiry processing

## GitHub Pages deployment

Because the app is now static, you can host it directly on GitHub Pages.

Steps:

1. Push the repository to GitHub
2. Open repository `Settings`
3. Open `Pages`
4. Under `Build and deployment`, choose `Deploy from a branch`
5. Select branch `main`
6. Select folder `/ (root)`
7. Save

After deployment, the public URL should be:

```text
https://sakuratokoyomi.github.io/7413smartbanking-project/
```

The root `index.html` redirects automatically to the dApp inside `public/`.

## Key files

- `contracts/ComplianceRegistry.sol`
- `contracts/SBIFCouponSettlement.sol`
- `public/app.js`
- `public/index.html`
- `public/contract-config.json`
- `scripts/compile-contract.cjs`
- `scripts/deploy-contract.cjs`
- `test/contract.test.js`

## Design note for the assignment

This version answers the two key blockchain / compliance requirements as follows:

1. `Use/Create DLT/Blockchain (Type III public, permissioned) to record all token transactions`
- completed through the public-chain smart contracts and emitted events

2. `Use RegTech tools or Open Banking API services for AML check of the buyer's public key`
- represented as a compliance approval recorded on-chain
- the approval method is stored as `CHAINALYSIS` or `OPEN_BANKING`
- the business contracts enforce that approval before any buyer transaction can happen
