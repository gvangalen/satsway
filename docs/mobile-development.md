# Satsway mobile app

The mobile app lives in `/mobile` and uses Expo SDK 57 with React Native 0.86.
Use Node.js 22.13 or newer on the Node 22 line.

## Run in Expo

```bash
cd mobile
npm ci
npm run ios
```

This starts Metro and opens the iOS Simulator.

## Open in Xcode

The native iOS project is generated in `mobile/ios` and is not committed. After
updating dependencies or cloning the repository, generate it with
`npm run prebuild:ios`. The project uses an `expo-splash-screen` config plugin.
The `withQuotedIosBundleScript` config plugin and React Native patch keep iOS
builds working when the checkout path contains spaces.

If CocoaPods cannot find the iPhoneOS SDK, make sure macOS is using full Xcode instead of Command Line Tools:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

Then install pods and open the workspace:

```bash
cd mobile
npm run pods:ios
npm run open:ios
```

## API target

The current mobile MVP points to:

```text
http://134.98.148.12
```

That is the Oracle server. Later, when a domain is ready, change `API_BASE_URL`
in `mobile/src/config.ts`.

## Current app flow

- Home dashboard
- Create split
- Request result/share link
- Public pay screen with EUR/Bitcoin choices
- Camera-based receipt scan placeholder

## Checks

From the repo root:

```bash
./scripts/check-mobile.sh
```

## Grid-testlink vanuit de app

1. Start de gedeelde HTTPS-demo zoals beschreven in
   [shareable-demo.md](shareable-demo.md). De webdemo en mobiele app gebruiken
   dezelfde `/api/sandbox/grid-links`-backend.
2. Open in de mobiele app **Sturen → Test USD → sats via Grid**. Het publieke
   HTTPS-basisadres kan via `EXPO_PUBLIC_SATSWAY_DEMO_URL` zijn vooringevuld.
   Vul de demo-toegangscode eenmalig in om Noor aan te melden. Een lokaal adres
   is alleen bruikbaar op de simulator.
3. Laat $18,50 en het voorbeeldadres `recipient@example.com` staan en kies
   **Maak testlink als Noor**. De toegangscode wordt niet opgeslagen. De
   tijdelijke sessie staat in de beveiligde opslag van het toestel; de demo-URL
   en gemaakte link-ID's staan in de appopslag.
4. Kies **Deel via chat**. Sam opent de webbetaallink op een ander toestel,
   meldt zich daar aan als Sam en simuleert de betaling.
5. Open het Grid-testscherm opnieuw. De app haalt Noors links op, ververst de
   testdollar- en satsstatus elke vier seconden en bij terugkeer naar de app.
   Het nieuwste verzoek staat ook op het startscherm, na opnieuw openen van
   de app.

Als Noor de link op een ander apparaat of via de webdemo heeft gemaakt, kiest
de aangemelde gebruiker **Laad Noors testlinks**. Na afloop van de sessie moet
de demo-toegangscode opnieuw worden ingevuld.

Optioneel kan `EXPO_PUBLIC_SATSWAY_DEMO_URL` het basisadres vooraf invullen.
Voor een lokale demonstratie kan `EXPO_PUBLIC_SATSWAY_DEMO_LINK_ID` de publieke
status van één bestaande sandboxlink op het startscherm en in de testlinks tonen,
zonder toegangscode in te voeren. Dit is een
alleen-lezen demonstratie en telt niet mee in de gewone betaalverzoeken.
Zet de demo-toegangscode niet in een `EXPO_PUBLIC_` variabele: die wordt in de
appbundel opgenomen. Een afgeronde sandboxstatus bewijst geen ontvangst in
een echte Lightning-wallet.
