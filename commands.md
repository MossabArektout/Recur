# Recur Commands

Command reference for building **Recur**, the Expo React Native subscription tracker.

## 0. Prerequisites

Check that Node and npm are installed:

```sh
node -v
npm -v
```

Optional, for iOS builds on macOS:

```sh
xcodebuild -version
```

Optional, for Android builds:

```sh
adb version
```

## 0.1. Run Expo Without Changing Default Node

This machine's default shell currently uses Node 16, while current Expo tooling requires Node 18 or newer. To run Expo/npm commands without changing the default Node version, prefix the command with Homebrew's Node path:

```sh
PATH=/opt/homebrew/opt/node/bin:$PATH npm run lint
```

Use the same prefix for Expo commands:

```sh
PATH=/opt/homebrew/opt/node/bin:$PATH npx expo start
```

And for package installs:

```sh
PATH=/opt/homebrew/opt/node/bin:$PATH npm install package-name
```

## 1. Create the Expo App

Already completed for this repo.

Run from inside this folder:

```sh
npx create-expo-app@latest . --template default@sdk-57
```

If Expo refuses because the folder is not empty, create the app in a temporary folder and move the generated app files into this project:

```sh
cd ..
npx create-expo-app@latest RecurApp --template default@sdk-57
```

Then move the generated files into `Recur` manually, keeping `app-build-spec.md` and this `commands.md`.

## 2. Start Development

Install dependencies after the app exists:

```sh
npm install
```

Start Expo:

```sh
npx expo start
```

Start with a cleared Metro cache:

```sh
npx expo start --clear
```

Run on iOS simulator:

```sh
npx expo start --ios
```

Run on Android emulator:

```sh
npx expo start --android
```

Run in a web browser, useful for quick UI checks:

```sh
npx expo start --web
```

## 3. Core MVP Dependencies

Install local database, notifications, date math, and common form inputs:

```sh
npx expo install expo-sqlite expo-notifications @react-native-community/datetimepicker
npm install date-fns zustand
```

If we use charts for Pro analytics:

```sh
npx expo install react-native-svg
npm install react-native-chart-kit
```

If we choose Victory charts instead:

```sh
npm install victory-native
```

## 4. Development Build

Some native features, especially purchases and production-like notification testing, need a development build instead of Expo Go.

Install EAS CLI:

```sh
npm install --global eas-cli
```

Log in:

```sh
eas login
```

Check login:

```sh
eas whoami
```

Configure EAS Build:

```sh
eas build:configure
```

Install Expo dev client:

```sh
npx expo install expo-dev-client
```

Create an iOS simulator development build:

```sh
eas build --profile development --platform ios
```

Create an Android development build:

```sh
eas build --profile development --platform android
```

Start the app for a development build:

```sh
npx expo start --dev-client
```

## 5. Local Native Runs

Use these after native projects are generated or when using development builds:

```sh
npx expo run:ios
```

```sh
npx expo run:android
```

Android release-mode notification behavior check:

```sh
npx expo run:android --variant release
```

## 6. Testing and Quality

Run linting:

```sh
npm run lint
```

Run TypeScript check if the project has a `tsconfig.json`:

```sh
npx tsc --noEmit
```

If we add Jest tests later:

```sh
npm test
```

## 7. RevenueCat / Paywall Stage

Install RevenueCat when we start Pro subscriptions:

```sh
npm install --save react-native-purchases
```

Optional RevenueCat paywall UI package:

```sh
npm install --save react-native-purchases-ui
```

After adding RevenueCat, rebuild the dev client:

```sh
eas build --profile development --platform ios
eas build --profile development --platform android
```

## 8. Production Builds

Build Android for store submission:

```sh
eas build --platform android
```

Build iOS for App Store submission:

```sh
eas build --platform ios
```

Build both platforms:

```sh
eas build --platform all
```

List recent builds:

```sh
eas build:list
```

## 9. Store Submission

Submit Android build:

```sh
eas submit --platform android
```

Submit iOS build:

```sh
eas submit --platform ios
```

## 10. Useful Expo Maintenance

Check Expo project health:

```sh
npx expo-doctor
```

Install a package with the Expo-compatible version:

```sh
npx expo install package-name
```

Update Expo packages to compatible versions:

```sh
npx expo install --fix
```

View Expo config:

```sh
npx expo config
```

## 11. Git Basics

Check changed files:

```sh
git status
```

Create a commit:

```sh
git add .
git commit -m "Describe the change"
```

View recent commits:

```sh
git log --oneline --decorate -5
```
