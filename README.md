# K7 CyberSecurity website

Next.js 16 + Payload 3 (Postgres, Lexical) on the K7 Design Language 2.1. The public site and the CMS admin are one app.

```sh
docker compose up -d   # Postgres on 127.0.0.1:5434 (k7 / k7 / k7)
pnpm install
pnpm dev               # http://localhost:3000 and http://localhost:3000/admin
```

Copy `.env.example` to `.env` and set a fresh `PAYLOAD_SECRET` on a new machine. The first visit to `/admin` creates the first user.

See `CLAUDE.md` for the repository layout and settled decisions, `docs/page-shapes.md` for the page model, and `design-system/README.md` for the design rules.
