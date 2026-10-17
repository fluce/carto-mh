# Carto MH relay

This Cloudflare Worker proxies the MountyHall view endpoint so the static GitHub Pages app does not expose credentials or hit browser CORS restrictions.

From this directory:

```sh
npx wrangler login
npx wrangler secret put MH_USER_ID
npx wrangler secret put MH_USER_SECRET
npx wrangler secret put CREDENTIALS_ENCRYPTION_KEY # openssl rand -base64 32
npx wrangler deploy
```

Replace `https://YOUR-USER.github.io` in `ALLOWED_ORIGINS` with the exact GitHub Pages origin before deploying. Local development at `http://localhost:5173` is already included. The relay endpoint is:

```text
https://<worker-subdomain>.workers.dev/vue
```

The client should `GET` that endpoint instead of posting directly to `sp.mountyhall.com`.

To create a user token, send `POST /api/token` with a JSON body containing `mh_user_id` and `mh_user_secret`.
The Worker validates the credentials against `SP_Profil2.php`, then stores them in the `USER_DATA` KV namespace
under `token:<token>` and returns the generated 128-bit token.

KV-backed data endpoints return `Last-Modified` and `Cache-Control: private, no-cache, must-revalidate`.
Browsers can revalidate cached responses with `If-Modified-Since`; unchanged data is returned as `304 Not Modified`.

`mh_user_secret` is encrypted with AES-256-GCM before it is stored. `CREDENTIALS_ENCRYPTION_KEY`
must be a base64-encoded random 32-byte key and must remain stable to allow future decryption.

For local development, set `TOKEN_VALIDATION_MOCK=true` to skip the upstream validation request.