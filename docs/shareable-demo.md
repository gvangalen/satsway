# Shareable Satsway demo

The temporary demo serves the real Satsway web interface over HTTPS. It uses
Grid's USD sandbox and a separate SQLite database. A payer can open a link on
a different phone, sign in as Sam with the demo code, request a Grid quote,
simulate payment, and see its status. Noor can reopen the owner link to see
the same status. No real bank payment or external wallet receipt is involved.

## Local setup

Create a private `.env.demo.local` (ignored by Git) with
`GRID_SANDBOX_LINKS_ENABLED=true`, a long random
`GRID_SANDBOX_DEMO_ACCESS_CODE`, a separate `AUTH_TOKEN_SECRET`, and
`DATABASE_URL=sqlite:///./satsway_demo.db`. The backend also needs the Grid
sandbox credentials already in `.env`.

Run the demo backend only on localhost port 8001:

```bash
set -a
source .env
source .env.demo.local
set +a
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Build and run the frontend on localhost port 3001:

```bash
cd frontend
NEXT_PUBLIC_API_BASE_URL='' NEXT_PUBLIC_SATSWAY_DEMO_MODE=true \
  SATSWAY_DEMO_PROXY_API=true SATSWAY_DEMO_API_PORT=8001 npm run build
NEXT_PUBLIC_API_BASE_URL='' NEXT_PUBLIC_SATSWAY_DEMO_MODE=true \
  SATSWAY_DEMO_PROXY_API=true SATSWAY_DEMO_API_PORT=8001 \
  npm run start -- --hostname 127.0.0.1 --port 3001
```

Expose only the frontend with an HTTPS tunnel (for example, `ngrok http 3001`).
Next.js proxies only `/api/sandbox/grid-links/*` and `/api/rates` to port 8001.
The demo code is required even when the backend sees the tunnel connection as
localhost. The tunnel URL changes when restarted and works only while the Mac,
frontend, backend, and tunnel remain running. Ngrok's free plan may show a
one-time visitor notice.

## Test from two devices

1. On device A, open the HTTPS demo and choose **Maak betaalverzoek**.
2. Enter the demo access code, choose **Noor**, keep `$18.50`, and create a
   test link. Copy or share its `/pay/grid/{id}` URL.
3. On device B, open that URL, enter the same access code, choose **Sam**,
   fetch the Grid quote, and simulate the payment.
4. On device A, reopen `/request/grid/{id}`. The fiat and sats statuses are
   shown separately.

The Satsway mobile app can be device A: open **Sturen → Test USD → sats via
Grid**, enter the public demo base URL and access code, create the link as
Noor, and share it through the phone's share menu. Sam still uses the browser
on device B. Noor enters the code only at first sign-in on that device (or
after the 30-day test session expires). The mobile app stores the temporary
session in secure device storage, fetches Noors links after reopening, and
shows the newest test request on the home screen. The mobile screen refreshes
both statuses automatically.

The sample Lightning address `recipient@example.com` is non-routable. A Grid
status of `completed` represents sandbox processing, not receipt in a real
wallet. The demo's login route is code gated; the ordinary email login and
legacy EUR checkout routes are not exposed by the demo proxy.
