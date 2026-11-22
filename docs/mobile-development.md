# Satsway mobile app

The mobile app lives in `/mobile` and uses Expo + React Native.

## Run in Expo

```bash
cd mobile
npm install
npm run ios
```

This starts Metro and opens the iOS Simulator.

## Open in Xcode

The native iOS project has been generated in `mobile/ios`.

If CocoaPods cannot find the iPhoneOS SDK, make sure macOS is using full Xcode instead of Command Line Tools:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

Then install pods and open the workspace:

```bash
cd mobile/ios
pod install
open Satsway.xcworkspace
```

## API target

The current mobile MVP points to:

```text
http://134.98.148.12
```

That is the Oracle server. Later, when a domain is ready, change `API_BASE_URL` in `mobile/App.tsx`.

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
