# Mumsrelle Dashboard

Internal Mumsrelle operations dashboard for sales, CSO pipeline metrics, and verified keyword-performance imports.

## Production safeguards

- Dashboard and keyword reads require an authenticated user.
- Keyword imports require the authenticated user to have the `admin` role.
- Keyword imports are stored as immutable MySQL snapshots and survive restarts and redeployments.
- CSO and live-sales identifiers are read from environment variables instead of source code.
- API responses are marked `no-store`, cross-origin mutations are rejected, and upload bodies are limited to 10 MB.
- Google Sheets and live-sales reads use a five-minute cache and expose warnings instead of silently fabricating values.

## Local setup

Requirements: Node.js 22.14+, pnpm 10.4.1+, and MySQL 8+.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:push
pnpm dev
```

Open `http://localhost:3000`. The OAuth variables must point to a valid Manus application before login can complete.

## Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection used for users and durable keyword imports |
| `JWT_SECRET` | Session-token signing secret |
| `OWNER_OPEN_ID` | User promoted to administrator on sign-in |
| `OAUTH_SERVER_URL` | OAuth server used by the backend |
| `VITE_OAUTH_PORTAL_URL` | OAuth portal used by the browser |
| `VITE_APP_ID` | OAuth application ID |
| `CSO_SHEET_ID` | Mumsrelle CSO Casesheet ID |
| `CSO_KIV_GID` | KIV worksheet GID |
| `CSO_SIGNED_GID` | Signed Up worksheet GID |

`SALES_OVERVIEW_URL` is required for current sales data. `SALES_OVERVIEW_TOKEN` is optional and, when provided, is sent as a Bearer token. Without a live URL the application deliberately falls back to the bundled snapshot and displays a warning.

The live overview endpoint must return:

```json
{
  "source": { "name": "verified-source" },
  "salesDaily": { "2026-08-18": 1250.5 },
  "deptDaily": {
    "2026-08-18": { "BODY": 900, "RETAIL PRODUCT": 200, "FACE": 150.5 }
  }
}
```

## Data definitions

- **Active KIV:** rows currently marked `KIV` in the KIV worksheet.
- **Due Today / Overdue:** active KIV rows evaluated using `KIV Date` in Singapore time.
- **New Leads:** unique contacts across KIV and Signed Up whose `Call In Date` is inside the selected period.
- **Signed Up:** Signed Up rows whose first available status date is inside the selected period. Date priority is `Signed Up Date`, `SC Status Date`, `PRHB Status Date`, `Case Status Date`, then `Call In Date`.
- **Keyword import:** up to 20,000 verified CSV or JSON rows per immutable database snapshot.

## Verification and deployment

```bash
pnpm check
pnpm test
pnpm build
docker build -t mumsrelle-dashboard .
docker run --env-file .env -p 3000:3000 mumsrelle-dashboard
```

Health check: `GET /api/health`.

Run `pnpm db:push` as a release step before starting a new production version. GitHub Actions runs type checking, tests, and the production build for every pull request and every push to `main`.

## Security note

An earlier revision contained the CSO Sheet ID and worksheet GIDs in source history. Configure a new restricted publishing arrangement or replace the source sheet before production deployment; moving the values to environment variables prevents future exposure but does not erase Git history.

## CSO Daily Update

The historical daily page reads the eight numeric columns of the original `CSO Daily Update` tab through server-side CSV access. Configure `CSO_DAILY_GID` for that tab; if it is unavailable, the page explicitly shows a warning and displays only separately saved MySQL rows. Text found in a numeric cell is shown for review rather than silently coerced.

The dashboard password still gates the Netlify site. The daily page additionally requires a named OAuth account for reads and an OAuth admin account for edits, so revisions can record a real editor ID. MySQL edits take precedence for their date in the page, while the Google Sheet stays unchanged. Run `pnpm db:push` before enabling the page.
