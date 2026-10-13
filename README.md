* npm install

You have access to local Cloudflare services (KV, R2, D1, Durable Objects, and Workflows) for this app via the Explorer API.
API endpoint: http://localhost:5173/cdn-cgi/local/explorer/api
Fetch the OpenAPI schema from http://localhost:5173/cdn-cgi/local/explorer/api to discover available operations. Use these endpoints to list, query, and manage local resources during development.


Run site for dev :
* npm run dev (starts Vite with the Worker configured in worker/wrangler.jsonc)

Run site for production :
* npx build
* deploy dist folder where you want