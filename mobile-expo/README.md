# Bookify AI Mobile

This is the real React Native + Expo mobile app for Bookify AI. It uses the Flask backend API at:

```text
https://phundum67.pythonanywhere.com/api
```

## Run On Phone

Install dependencies:

```powershell
cd mobile-expo
npm install
```

Start Expo:

```powershell
npm start
```

Then install `Expo Go` on your Android phone and scan the QR code.

## Build APK

Install EAS once:

```powershell
npm install -g eas-cli
```

Login and build:

```powershell
eas login
eas build -p android --profile preview
```

## Change Backend URL

Edit:

```text
src/constants.js
```

and update `API_BASE_URL`.
