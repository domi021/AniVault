# AniVault

Your all-in-one anime companion — track, discover, and stream your favorite anime with cloud sync and personalized recommendations.

## Features

- **Dashboard** — overview of watching, completed, planned, and dropped counts
- **Lists** — filterable, sortable lists by status with local search and favorites
- **Search** — fast anime search powered by AniList GraphQL API
- **Anime Details** — rate (0–10), track episodes, mark as favorite
- **Watch** — stream episodes with embedded WebView player, ad-blocking, and double-tap skip
- **Sub/Dub Toggle** — switch between subbed and dubbed episodes with a persistent preference
- **Recommendations** — discover new anime based on your tracked list
- **Auth** — email/password signup and login via Supabase
- **Sync** — all data synced to Supabase, tied to your account
- **Force Updates** — old versions are prompted to download the latest APK
- **Themes** — light and dark mode with accent color picker
- **Multi-language** — English, Spanish, Japanese
- **Import** — bulk import from AniList or paste from notes

## Tech

- [Expo](https://expo.dev) (React Native) — Android/iOS/Web
- [Supabase](https://supabase.com) — Auth + Database
- [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs/) — Anime search, details, and recommendations
- [Zustand](https://github.com/pmndrs/zustand) — State management
- [TanStack React Query](https://tanstack.com/query) — Server state management
