# SBIF Florist Shop POC

This repository contains a deliverable SBIF florist-shop proof of concept with:

- Scenario A and Scenario B financing simulation
- Real Solidity contract purchase and redeem flow
- Wallet connection with MetaMask
- Official open banking sandbox integration through Plaid
- Local ledger, transaction history, and platform metrics
- Automated tests for calculations, API routes, and contract flow

## What is now "real"

Two parts are now connected to real external-style interfaces instead of pure mock logic:

1. Wallet and smart contract
- Coupon purchase calls the Solidity contract first
- Coupon redeem calls the Solidity contract first
- The backend then stores the confirmed transaction hash and business record

2. Open banking
- The app uses the official Plaid API
- The backend creates a real `link_token`
- The frontend opens Plaid Link
- The backend exchanges the returned `public_token` for an `access_token`
- The backend fetches account data from Plaid

## Stack

- Frontend: vanilla HTML, CSS, JavaScript
- Backend: Node.js HTTP server
- Smart contract: Solidity
- Local chain: Ganache
- Wallet client: ethers
- Open banking: Plaid
- Deploy target: Render from GitHub

## Local run

### 1. Enter the project

```powershell
cd "c:\Users\Tokoyomi\Desktop\hku\smart_banking\7413smartbanking-project"
```

### 2. Create env file

Copy `.env.example` to `.env` and fill in your Plaid sandbox credentials:

```text
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
PLAID_REDIRECT_URI=
PORT=3000
```

If you do not add Plaid credentials, the app still runs, but the open banking buttons will stay disabled at the API layer.

### 3. Start the local chain

```powershell
npm.cmd run chain
```

Ganache runs at:

```text
http://127.0.0.1:8545
```

Chain ID:

```text
1337
```

### 4. Compile and deploy the contract

Open another PowerShell window and run:

```powershell
npm.cmd run compile:contract
npm.cmd run deploy:contract
```

This writes the deployed address and ABI to:

```text
public/contract-config.json
```

### 5. Start the app

```powershell
node server.js
```

Open:

```text
http://localhost:3000
```

## Wallet demo

To test the on-chain coupon flow:

1. Add a local network in MetaMask
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `1337`
- Currency symbol: `ETH`

2. Import one Ganache test private key

3. In the app:
- Click `Connect wallet`
- Click `Switch to local chain`
- Run `Issue coupons`
- Click `Redeem`

## Open banking demo

To test the bank-connection flow:

1. Create a Plaid developer account
2. Get sandbox credentials from Plaid Dashboard
3. Put them in `.env`
4. Restart the app
5. Click `Connect bank`
6. Complete the Plaid Link sandbox flow
7. The app will fetch and display connected account balances

## Tests

Run everything:

```powershell
npm.cmd run test
```

Current automated coverage includes:

- calculation tests
- API tests
- Solidity contract tests
- open banking configuration-path tests

## GitHub and final URL

GitHub is the right place for code hosting, but GitHub alone is not enough for a final live URL because this project needs:

- a Node.js backend
- environment variables for Plaid
- server-side API routes

The recommended submission setup is:

1. Push this repository to GitHub
2. Connect the GitHub repo to Render
3. Add the Plaid environment variables in Render
4. Deploy the web service
5. Use the Render URL as the final submission URL
6. Use the GitHub repository URL as the source-code URL

## Render deployment

This repo already includes `render.yaml`.

Recommended Render setup:

- Environment: `Node`
- Build command: `npm install`
- Start command: `node server.js`

Required environment variables on Render:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV`
- `PLAID_REDIRECT_URI` if required by your Plaid setup

After deployment, Render will give you a live URL similar to:

```text
https://your-service-name.onrender.com
```

## Important limitation for the live deployment

The current Solidity flow uses a local Ganache chain for development and testing.

That means:

- locally, the contract flow is fully runnable now
- for a public live URL, you should point the frontend to a public testnet contract instead of Ganache

If you want the final public URL to support both:

- real wallet-based contract calls
- real open banking sandbox calls

then the next deployment step should be:

1. deploy the Solidity contract to a public EVM testnet
2. update `public/contract-config.json`
3. deploy the app from GitHub to Render

## Key files

- `server.js`: backend server and API routes
- `contracts/SBIFCouponSettlement.sol`: Solidity contract
- `public/app.js`: frontend logic for wallet, contract, and Plaid Link
- `public/index.html`: UI
- `scripts/compile-contract.cjs`: compile contract
- `scripts/deploy-contract.cjs`: deploy contract
- `.env.example`: server env template
- `render.yaml`: Render deployment config

## Source references used for the open banking integration

- Plaid official docs for Link token creation
- Plaid official docs for public-token exchange
- Plaid official docs for account retrieval
