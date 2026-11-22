# Satsway

Satsway is een prototype voor betaalverzoeken waarbij de betaler en ontvanger
ieder hun eigen betaalvaluta kiezen. De betaler opent een deelbare link zonder
de app te installeren. De beoogde eerste echte geldroute is **EUR betalen →
sats ontvangen** via Lightspark Grid.

## Huidige status

- Webapp (Next.js), mobiele Expo-app en FastAPI-backend.
- Deelbare betaallinks en twee testgebruikers in de Grid-sandbox.
- Een USD → sats sandboxflow met offerte, gesimuleerde betaling en aparte
  statussen voor betaling en uitbetaling.
- **Geen live eurobetaling of uitbetaling naar een echte Lightning-wallet.**
  De Nederlandse EUR-route vereist bevestiging en activering door Lightspark.

De sandboxdemo en de beperkingen staan in [docs/shareable-demo.md](docs/shareable-demo.md)
en [docs/grid-first-payment.md](docs/grid-first-payment.md).

## Lokaal starten

Vereist: Python 3.12+, Node.js 22+ en npm. Kopieer `.env.example` naar `.env`
en vul eigen waarden in. `.env` en lokale databases blijven buiten Git.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

Start de webapp in een tweede terminal:

```bash
cd frontend
npm ci
npm run dev
```

De webapp staat dan op `http://localhost:3000`. Voor de mobiele app: `cd mobile`,
`npm ci`, `npm start`. De Grid-sandbox is standaard uitgeschakeld en vereist
eigen sandboxcredentials; zie de demo-instructies.

## Controles

```bash
python -m pytest backend/tests
cd frontend && npm ci && npm run build
cd mobile && npm ci && npx tsc --noEmit
```
