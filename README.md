# CryptoBin

Zero-knowledge secret exchange: one-time share links, personal inboxes, vault storage, and shared team inboxes. Secrets are encrypted in the browser; the server stores ciphertext only.

**Live site:** [cryptobin.app](https://cryptobin.app)  
**Source:** [github.com/darioguarascio/cryptobin.app](https://github.com/darioguarascio/cryptobin.app)

## Stack

| Area | Tech |
| --- | --- |
| Web app | Astro 7, React 19, Node adapter |
| Database | PostgreSQL, Drizzle ORM |
| CLI | `@cryptobin/cli` (npm workspace) |

Requires **Node.js 22+**.

## Local development

```bash
git clone https://github.com/darioguarascio/cryptobin.app.git
cd cryptobin.app
cp .env.example .env
npm ci
npm run db:migrate
npm run dev
```

The app listens on port **4321** by default. Postgres must be reachable at `DATABASE_URL` (see `.env.example`).

Set **`SITE_URL`** to your public origin in production (emails and UI copy). Optional **[Rybbit](https://rybbit.io)** analytics: set **`RYBBIT_HOST`** (e.g. `https://t.surl.it`) and **`RYBBIT_SITE_ID`**; the tracking script is omitted if either is missing. Override the footer repo link with **`GITHUB_REPO_URL`**.

### Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web dev server |
| `npm run build` | Production build |
| `npm run test` | Unit tests (web + CLI + install script) |
| `npm run test:coverage` | Unit tests with 80% coverage gate |
| `npm run test:integration` | API integration tests (Postgres fixture DB) |
| `npm run test:all` | Unit + integration |
| `npm run db:generate` | Generate Drizzle migrations after schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run cli` | Run CLI in dev mode |

Integration tests use `TEST_DATABASE_URL` (default `cryptobin_test`); see `scripts/test-integration.sh`.

## CLI

Install from the site:

```bash
curl -fsSL https://cryptobin.app/install.sh | sh
```

Or from the repo: `npm run cli:build` then use the built binary from `packages/cli`.

## Docker

Build and run with `docker-compose.yml` and a host `.env` (image tag via `IMAGE_TAG`). Migrations run via the web image entrypoint / compose profile as configured in the repo.

## CI

GitHub Actions run unit tests (with coverage reports), integration tests against Postgres, and Docker image builds on version tags (`v*`).

## License

Private repository; all rights reserved unless otherwise noted by the owner.
