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
