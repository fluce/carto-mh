# Carto MH relay

This Cloudflare Worker proxies the MountyHall view endpoint so the static GitHub Pages app does not expose credentials or hit browser CORS restrictions.

From this directory:

```sh
npx wrangler login
npx wrangler secret put MH_USER_ID
npx wrangler secret put MH_USER_SECRET
npx wrangler deploy
```

Replace `https://YOUR-USER.github.io` in `ALLOWED_ORIGINS` with the exact GitHub Pages origin before deploying. Local development at `http://localhost:5173` is already included. The relay endpoint is:

```text
https://<worker-subdomain>.workers.dev/vue
```

The client should `GET` that endpoint instead of posting directly to `sp.mountyhall.com`.