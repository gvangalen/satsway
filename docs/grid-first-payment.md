# Grid first payment: EUR to sats

## Target transaction

One person creates a Satsway request for EUR 18.50 and supplies their own
Lightning address. Another person opens the shared link on a phone, pays EUR
18.50 from a Dutch bank account, and the recipient receives sats. The payer
must not need to install Satsway.

## What the app supports today

- A request can store `settlement_currency=BTC` and a Lightning address.
- The request and public payment page show that Grid payment is unavailable.
- The backend refuses to create a Stripe or River payment session for a sats
  request (`GRID_NOT_CONFIGURED`). No mock payment is shown as successful.
- Existing EUR requests still use the legacy Stripe/River paths.
- With `GRID_SANDBOX_LINKS_ENABLED=true`, **Maak betaalverzoek** offers a
  separate **Test USD → sats** option. It creates a Grid sandbox link from the
  main app, shows an owner page at `/request/grid/{id}`, and gives the payer
  `/pay/grid/{id}`. The home list shows these test requests alongside ordinary
  requests for the current test user.

## Confirm with Lightspark before wiring live money

Grid has a sandbox. After creating a Grid test account and token, run the
read-only connectivity check with `GRID_API_TOKEN_ID` and
`GRID_API_CLIENT_SECRET` set in the shell:

```bash
python3 scripts/check-grid-api.py
```

The check only calls `GET /config`; it does not create a quote or move funds.
It verifies API access, not support for the Dutch payer-to-third-party-wallet
flow. Keep the token and secret out of git and frontend code.

### Sandbox result, 22 November 2026

The GVG Dienstverlening sandbox token successfully authenticated to `GET /config`
(`HTTP 200`). The platform configuration lists USD, USDB, USDC, and USDT as
supported sending currencies; EUR is absent. A read-only
`GET /exchange-rates?sourceCurrency=EUR&sendingAmount=1850` returned `HTTP 400`,
`INVALID_INPUT`, with reason `Sending currency CurrencyUnit.EUR is not supported
by the platform`. USD has 48 available destination corridors, but none has BTC
as its destination. No quote, customer, payment, or transaction was created.

This prevents an end-to-end EUR 18.50 to sats sandbox test with the current
platform setup. Grid's [API specification](https://github.com/lightsparkdev/grid-api/blob/main/openapi.yaml)
says EUR open banking requires Lightspark to enable it for the platform, and
Lightning invoice sends are available only on platforms where that feature is
enabled. Ask Lightspark to enable and confirm **both** EUR open banking for
individual Dutch payers and a payout route to a different person's external
Lightning wallet or invoice. Then repeat the corridor check and run a sandbox
payment before changing Satsway's public payment page.

### USD-first link test

EUR is not necessary to test the payment-link experience. The main request
form now offers a clearly labelled USD sandbox route. It is kept separate from
the normal EUR request data and payment sessions, which still block
`settlement_currency=BTC`.

The `GET /exchange-rates` lists for USD, USDB, and USDC did not include BTC as
a destination on this sandbox platform. This does **not** rule out the separate
Lightning quote route documented for `POST /quotes`. A quote to a saved
Lightning address **did** work in the sandbox, even though BTC was absent from
the general corridor list. Do not use an indicative FX rate as a Grid quote.

With a test Lightning destination, run the non-executing quote probe:

```bash
set -a
source .env
set +a
python3 scripts/check-grid-usd-lightning.py --lightning-address 'name@wallet.example' --amount-usd 18.50
```

The script uses the platform's USD account, registers a third-party Lightning
destination in Grid's sandbox, and requests a quote. It does not fund the USD
account or execute the quote. For a fresh BOLT11 invoice, use `--invoice` with
its exact `--sats` amount instead of `--lightning-address`. A successful quote
would establish pricing and API route availability, not a completed payout or
a payer checkout flow.

On 22 November 2026, this quote probe succeeded with a non-routable example
Lightning address: USD 18.50 quoted to 30,100 sats with USD 0.62 in fees. The
quote was not executed. It proves sandbox pricing and destination registration,
not that a real recipient can receive a sandbox payout.

The integrated Satsway route was also exercised on 22 November 2026: Noor
created a USD 18.50 request from **Maak betaalverzoek**, the app produced a
`/pay/grid/{id}` link, Sam opened it, accepted a Grid sandbox quote of 29,615
sats with USD 0.62 in fees, and the status reached **afgerond in sandbox**.
The sample address was still `recipient@example.com`; this is a sandbox
transaction result, not proof of sats arriving in a real wallet.

For the browser test, start the backend with `GRID_SANDBOX_LINKS_ENABLED=true`
and the sandbox credentials set, then start the frontend. Open **Maak
betaalverzoek → Test USD → sats**. The owner page at `/request/grid/{id}` gives
a copyable `/pay/grid/{id}` link, a system share button, and a WhatsApp link.
The payer page fetches a Grid quote and shows the sats, fees, and expiration.
Its **Simuleer betaling met testdollars** button
credits the platform USD sandbox account, executes that quote, and polls the
Grid transaction until it completes or fails. The two statuses stay separate:
simulated USD receipt and Grid payout. The sandbox endpoints are disabled by
default. A second click cannot add funds again. An interrupted funding call
stays in `needs_review` and must be inspected before any retry.

On 22 November 2026, a USD 18.50 test link to the non-routable address
`recipient@example.com` advanced from `PROCESSING` to `COMPLETED` in Grid. It
quoted 30,100 sats and USD 0.62 in fees. This proves the sandbox transaction
flow and link status handling. It does **not** prove that a real wallet received
sats: the destination was a placeholder and Grid's sandbox simulated delivery.
Before a real wallet test, confirm with Lightspark whether sandbox payouts can
settle to an external test wallet and which network that wallet must use. A
normal mainnet wallet should not be assumed compatible with sandbox funds.

### Two Satsway test users

The Satsway home screen links to the main request form when the backend
sandbox flag is enabled. The test form offers one-click local sessions for
**Noor** and **Sam**; these are records in Satsway, not Lightspark Grid
customers. Test login works locally without a code. A separately configured
HTTPS demo requires `GRID_SANDBOX_DEMO_ACCESS_CODE` for either account. The links remain
stored in Satsway and appear in the home screen's recent list for the
creator and test payer.

To repeat the app flow: choose Noor, create a USD 18.50 link, open it, switch to
Sam, fetch the Grid quote, and click **Simuleer betaling met testdollars**.
Grid's sandbox funds the platform USD account and executes the quote. The link
records Sam as test payer, shows Grid's final status, and prevents Noor from
paying her own link or either user from funding the same link twice. Switch
back to Noor to view the completed result. The payer's demo session represents
a simulated payment; no personal USD bank account, real bank authorization,
customer KYC, or wallet receipt is involved. This local URL cannot be shared
with someone outside the computer until the frontend has a reachable HTTPS
address and routes its sandbox API to the demo backend. The owner page warns
when the generated link is local. The HTTPS demo uses a separate database and
requires an access code for the Noor/Sam accounts; never put Grid credentials
in the frontend. See [shareable-demo.md](./shareable-demo.md).

1. Can Grid accept an individual payer's EUR 18.50 bank payment from the
   Netherlands through a mobile browser? Which rail and payer onboarding are
   required? Is there a hosted bank authorization flow or only bank transfer
   instructions?
2. Can that payment fund a conversion and payout to a different individual's
   external Lightning address? Is a Lightning address supported directly, or
   must Satsway resolve an invoice or use a Spark wallet?
3. Which party must complete KYC, which party owns the Grid account, and who
   handles refunds and disputes?
4. What are the total fees and exchange rate for EUR 18.50, and how long is
   a quote valid? Can the payer's EUR amount be fixed?
5. Which API objects and signed events identify fiat receipt, conversion,
   payout success, payout failure, expiration, and refund? How are retries
   and idempotency handled?

## Integration contract after approval

The Grid adapter should expose quote, payment instructions, and transfer
status to the app. Store provider IDs and idempotency keys against each share.
Track at least these states independently:

| Fiat collection | Sats payout | Satsway display |
| --- | --- | --- |
| awaiting | not started | Awaiting payment |
| received | pending | Payment received; payout in progress |
| received | completed | Paid |
| received | failed | Payment received; payout needs attention |

Only mark a share paid after confirmed payout. A failed payout must never
produce a second request for EUR from the payer. Verify Grid webhook
signatures and deduplicate events before updating state. Show the provider's
actual quote, fees, and receiving sats before the payer authorizes payment;
the app's indicative BTC/EUR rate is not a payment quote.
