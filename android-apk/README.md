# Bookify AI Android APK

This Android project wraps the hosted Flask app in a WebView so you can install and test Bookify AI on an Android phone.

## App URL

The APK opens:

```text
https://phundum67.pythonanywhere.com/
```

To change it later, edit `APP_URL` in:

```text
app/src/main/java/com/bookifyai/app/MainActivity.java
```

## Build With Android Studio

1. Open Android Studio.
2. Choose `Open`.
3. Select this folder:

```text
android-apk
```

4. Let Gradle sync finish.
5. Connect your Android phone with USB debugging enabled.
6. Press the green Run button, or choose `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

The debug APK will be created at:

```text
android-apk/app/build/outputs/apk/debug/app-debug.apk
```

## Build From Terminal

If Gradle and Android SDK are installed:

```powershell
cd android-apk
gradle assembleDebug
```

Install with:

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Important

This APK shows whatever is live at the PythonAnywhere URL. Make sure the Flask template frontend is fully deployed before judging the phone UI.
