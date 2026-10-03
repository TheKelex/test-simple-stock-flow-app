# Simple Stock Flow — React Application

This repository contains the operational React frontend. It consumes the Laravel API contract documented in [`../docs/doc-laravel/api-contract.md`](../docs/doc-laravel/api-contract.md) and does not own business rules or persistence.

## Local development

Requirements: Node.js 20 or later and npm.

```sh
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` to the API base URL. The default is `http://localhost:8000/api`; see `.env.example`.

## Workflows

- Sign in with an API account.
- Browse and filter the active product catalog.
- Create, update, logically delete, and upload product images as an admin.
- Register sales and view recent transactions.
- Request sales reports by date range.

The frontend uses server responses as the source of truth for inventory, sale totals, permissions, and report aggregation. It does not include mock business data; API requests will fail visibly until the backend is available.
