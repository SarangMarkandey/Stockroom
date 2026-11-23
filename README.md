# Stockroom

Multi-godown inventory management for the SasthaSoft full stack developer trial.

## Local setup

Use Node.js 20.9 or later.

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the Dashboard.

## Stack and data

Stockroom uses Next.js App Router, TypeScript, Tailwind CSS, and Lucide icons. It runs without a database, login, API keys, or environment variables. The Next.js project can be deployed directly to Vercel.

The browser starts with fictional data and saves changes for that browser and origin in `localStorage`. One inventory state stores products, godowns, orders, transfers, and a stock movement ledger. Balances, movement history, alerts, and reports are derived from that ledger and the posted orders. Order prices and costs are stored as integer paise and displayed in INR.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
```
