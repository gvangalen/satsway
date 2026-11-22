# Satsway: betaalverzoeken met vrije keuze in betaal- en ontvangvaluta

## Productrichting

Satsway is een Tikkie-achtige app waarmee mensen elkaar een betaalverzoek
sturen. De ontvanger kiest of die euro's of sats wil ontvangen. De betaler
opent een deelbare link en kiest of die in euro's of met Lightning betaalt.
De keuze van de betaler staat los van de keuze van de ontvanger:

| Betaler betaalt | Ontvanger ontvangt | Geldroute |
| --- | --- | --- |
| EUR | EUR | eurobetaling |
| EUR | sats | eurobetaling, conversie, Lightning-uitbetaling |
| sats | EUR | Lightning-betaling, conversie, bankuitbetaling |
| sats | sats | Lightning-betaling en uitbetaling |

De betaler moet een verzoek via de browser kunnen voldoen zonder Satsway te
installeren. De app is bedoeld voor mensen die verzoeken maken, betalingen
volgen en hun ontvangvoorkeur beheren. Lightspark Grid is de beoogde partner
voor betaling, conversie en uitbetaling; Satsway verzorgt de ervaring,
links, voorkeuren en betrouwbare statussen. De exacte routes en vereiste
identificatie moeten door Lightspark worden bevestigd.

De eerste echte proef is EUR 18,50 betalen vanaf een Nederlandse bankrekening
en sats ontvangen op de bestaande Lightning-wallet van de ontvanger. De app
heeft een Grid-sandboxkoppeling voor de testflow; de live route van euro's
naar sats is nog niet beschikbaar.

## Gratis particuliere versie en latere zakelijke versie

De particuliere versie blijft gratis. Op de achtergrond van de app wisselen
duidelijk herkenbare posters van Bitcoin-bedrijven en korte, neutrale uitleg
over hoe Bitcoin en Lightning werken elkaar af. Bedrijven betalen voor een
gesponsorde poster; educatieve inhoud blijft herkenbaar als uitleg van
Satsway. De reclame mag het bedrag, de kosten, de betaalkeuze of de
betaalstatus niet verhullen.

Een betaalde zakelijke versie kan later functies krijgen zoals teamaccounts,
meer betaalverzoeken, rapportage en eigen vormgeving. De exacte functies en
prijzen zijn nog niet bepaald.

Het prototype heeft al een willekeurige poster op het dashboard en als
achtergrond van de betaalpagina. Het heeft nog geen onderscheid tussen
gesponsorde en educatieve posters, geen sponsorbeheer en geen planning of
rapportage voor adverteerders.

## Oud prototypeplan hieronder

# 🚀 PROJECT: Satsway App (EUR + Bitcoin)

## 🎯 Doel
We bouwen een app zoals Tikkie, maar met twee betaalopties:

1. EUR betalingen via Stripe  
2. Bitcoin betalingen via River (Lightning)

De gebruiker kan bij elk betaalverzoek kiezen:
👉 betalen in euro of in bitcoin

---

## 🧠 Concept

De app is een hybride payment layer:

- User maakt verzoek (€10)
- Betaler kiest:
  - 💳 Betaal met euro (Stripe)
  - ⚡ Betaal met Bitcoin (Lightning via River)

De app handelt beide flows correct af en toont één status.

---

## ⚙️ Tech stack

### Frontend
- Next.js (App Router)
- TailwindCSS
- PWA (mobile-first)

### Backend
- FastAPI
- PostgreSQL
- Redis (later voor realtime)

---

## 🧱 Folder structuur

### Backend
plaintext id="hyb001" /backend   main.py    /api     auth_api.py     request_api.py     payment_api.py    /services     user_service.py     request_service.py     stripe_service.py     river_service.py     payment_orchestrator.py    /models     user.py     payment_request.py     transaction.py    /webhooks     stripe_webhook.py     river_webhook.py    /core     config.py     database.py 

---

## 🧠 Core services

### payment_orchestrator.py (BELANGRIJKSTE)
Deze service bepaalt:

- Welke payment flow wordt gebruikt
- Hoe status wordt verwerkt
- Eén uniforme response naar frontend

---

## 💳 Stripe flow (EUR)

### stripe_service.py

Functies:
- create_checkout_session(amount_eur)
- handle_webhook()

Flow:
1. User kiest EUR
2. Backend maakt Stripe checkout session
3. User betaalt via iDEAL / card
4. Stripe stuurt webhook
5. Status → paid

---

## ⚡ River flow (Bitcoin)

### river_service.py

Functies:
- create_lightning_invoice(amount_sats)
- handle_webhook()

Flow:
1. User kiest Bitcoin
2. Backend maakt Lightning invoice via River
3. QR wordt getoond
4. Betaling wordt gedaan
5. River webhook → paid

---

## 🔄 Unified payment flow

1. User maakt request (€10)
2. Backend slaat request op

3. Betaler opent link:
   - kiest:
     - EUR → Stripe
     - BTC → River

4. Backend start juiste flow

5. Webhook update:
   - payment_request.status = paid

---

## 🗄️ Database schema

### payment_requests
- id
- user_id
- amount_eur
- amount_sats (optioneel)
- description
- status (pending, paid, expired)
- created_at

---

### transactions
- id
- request_id
- payment_method (stripe, bitcoin)
- amount
- currency (EUR, BTC)
- external_id (stripe_session_id / lightning_invoice)
- status
- created_at

---

## 🎨 Frontend flow

### Create request
- bedrag invoeren (€)
- omschrijving

---

### Payment screen

Toon:

- Bedrag (€10)
- Keuze:
  - 💳 Pay with Euro
  - ⚡ Pay with Bitcoin

---

### Bitcoin flow
- toon QR
- toon sats bedrag

---

### Euro flow
- redirect naar Stripe checkout

---

### Status
- pending
- paid ✅

---

## 🚫 MVP beperkingen

- Geen eigen wallet
- Geen custody
- Geen conversie engine (nog niet)
- Stripe en River handelen betaling af

---

## 🚀 Eerste taken

1. Backend structuur opzetten
2. Database models maken
3. payment_request API bouwen
4. Stripe test integratie
5. River test integratie
6. Webhooks verwerken
7. Frontend keuze flow bouwen

---

## 🔥 Belangrijk

- Backend moet beide payment flows ondersteunen
- Eén request = meerdere betaalopties
- Status moet altijd synchroon zijn

---

## 🎯 MVP doel

Werkende app waarin:
- je een verzoek maakt (€10)
- iemand kiest:
  - euro of bitcoin
- betaling wordt verwerkt
- status wordt correct geüpdatet

---

## 💡 Focus

Simpel houden  
Geen extra features  
Werkende payment flow = succes
