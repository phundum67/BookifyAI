# Expo + Supabase Setup

This mobile app can now run in two modes:

```text
EXPO_PUBLIC_DATA_BACKEND=flask
```

or:

```text
EXPO_PUBLIC_DATA_BACKEND=supabase
```

Flask remains the default so the app does not break while Supabase is being prepared.

## 1. Create Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Open `SQL Editor`.
4. Run:

```text
../../supabase/schema.sql
```

from this repo.

## 2. Add Expo Environment File

Create `mobile-expo/.env`:

```text
EXPO_PUBLIC_DATA_BACKEND=supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use the anon/public key from:

```text
Supabase Dashboard > Project Settings > API
```

## 3. Run Expo

```powershell
cd mobile-expo
npm start
```

## Current Status

The project now includes:

- Supabase client setup for Expo/React Native.
- Supabase schema for users/profiles, businesses, slots, bookings, reviews, favorites, and notifications.
- Environment switch to keep Flask working while Supabase is configured.

The next step is wiring each existing screen to the Supabase data adapter once your Supabase URL/key are available.
