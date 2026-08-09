# VOID — Frictionless Note-Taking for GitHub Issues

A hyper-addictive, frictionless note-taking app. Every thought becomes a GitHub issue in your repo.

Built with Expo + React Native.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Expo SDK 51 (bare workflow) |
| Language | TypeScript |
| Animations | React Native Reanimated 3 |
| Gestures | React Native Gesture Handler 2 |
| State | Zustand + MMKV (local-first) |
| Cloud | GitHub Issues API |
| Storage | expo-secure-store (API keys), MMKV (notes) |
| Audio | expo-av |
| Media | expo-image-picker, expo-document-picker |

---

## 1. Prerequisites

```bash
node >= 18
npm >= 9
# iOS: Xcode 15+ with iOS 17 SDK
# Android: Android Studio + JDK 17
```

Install Expo CLI and EAS CLI:
```bash
npm install -g expo-cli eas-cli
```

---

## 2. Clone & Install

```bash
git clone <your-repo>
cd void-app
npm install
```

---

## 3. Prebuild (generates native code)

VOID uses MMKV and native audio — Expo Go will NOT work.
You must use the development build.

```bash
npx expo prebuild --clean
```

---

## 4. Run on device / simulator

### iOS
```bash
npx expo run:ios
# or for a physical device:
npx expo run:ios --device
```

### Android
```bash
npx expo run:android
```

---

## 5. Configure GitHub

### 5a. Create a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a name like `VOID`
4. Select the **repo** scope
5. Copy the token (starts with `ghp_`)

### 5b. Create a GitHub Repository

1. Create a repository on GitHub (e.g. `dimensionless`)
2. Keep it **private** or **public** depending on your preference

### 5c. Save credentials in the app

Open the **Settings** tab in the app and enter:
- **Token**: your GitHub personal access token
- **Owner**: your GitHub username
- **Repository**: `dimensionless` (or any repo name)

Your token is stored securely on-device via expo-secure-store.

---

## 6. Hosting the Web Build (GitHub Pages)

The web version is deployed to GitHub Pages automatically by the workflow in
`.github/workflows/deploy.yml` (at the repo root) — it runs `expo export
--platform web` on every push and publishes `void/dist`.

`app.json` sets `experiments.baseUrl` to the Pages path so all bundled assets
resolve under `https://voidconsole.github.io/dimensionless/`.

To build locally: `npx expo export --platform web` (output lands in `dist/`).

---

## 7. How It Works

- Each note you capture becomes a **GitHub Issue** in your repo
- **Labels** on GitHub serve as categories (e.g. `void:psyche`, `void:systems`)
- Labels are **auto-created** in your repo when you connect
- The Log screen pulls issues from GitHub — pull-to-refresh to sync
- Notes are written to local storage instantly, then synced in the background
- If offline, notes are queued and flushed on next launch

---

## 8. File Structure

```
void-app/
├── App.tsx                        # Root: navigation + gesture handler
├── app.json                       # Expo config
├── babel.config.js                # Reanimated plugin (must be last)
├── package.json
└── src/
    ├── theme/
    │   └── index.ts               # Colors, spacing, default labels, SPRING configs
    ├── services/
    │   ├── github.ts              # GitHub Issues API, labels, offline queue
    │   └── uploader.ts            # Catbox file uploads
    ├── store/
    │   ├── useNoteStore.ts        # Zustand + MMKV persistent note store
    │   └── useLabelStore.ts       # Zustand store for GitHub labels
    ├── hooks/
    │   ├── useHaptic.ts           # Haptic feedback
    │   └── useRecording.ts        # expo-av voice recording hook
    ├── components/
    │   ├── CategoryPills.tsx      # Horizontal label selector (dynamic from GitHub)
    │   ├── SendButton.tsx         # Animated send button with spring + ripple
    │   ├── NoteCard.tsx           # Log card with swipe-to-delete + markdown rendering
    │   └── AttachmentChip.tsx     # File/image/voice chip with remove
    └── screens/
        ├── CaptureScreen.tsx      # Main composition surface
        ├── LogScreen.tsx          # Note archive with GitHub-synced labels
        └── SettingsScreen.tsx     # GitHub config + label management
```

---

## 9. Architecture Notes

### Local-first
Notes are written to MMKV **instantly** on send. GitHub sync happens fire-and-forget in the background. If the network is unavailable, notes are pushed to a retry queue in MMKV. On next app launch, `flushQueue()` runs automatically.

### Dynamic Labels
Categories are not hardcoded. Labels are fetched from your GitHub repository. Create or modify labels directly on GitHub to add new categories. The app picks them up on the next connect.

### Markdown
Note text supports markdown. GitHub issues render markdown natively, and the app displays it with `react-native-markdown-display`.

### Optimistic UI
The UI resets and the note appears in the log **immediately** after send — before GitHub confirms. This makes the app feel instantaneous regardless of network conditions.

### Unsynced indicator
Notes with `synced: false` show a small blue dot in the top-right corner of their card in the Log view. Once successfully synced, the dot turns green.

---

## Troubleshooting

**"MMKV cannot be used in Expo Go"**
→ You must use `expo run:ios` or `expo run:android`. Expo Go does not support native modules.

**Reanimated crash on Android**
→ Ensure `react-native-reanimated/plugin` is the **last** plugin in `babel.config.js`. Clear the Metro cache: `npx expo start --clear`.

**GitHub returns 404**
→ Make sure the repository exists and your token has the `repo` scope.

**Audio recording not working on iOS simulator**
→ The iOS simulator does not support microphone input. Test on a physical device.

**Labels not showing up**
→ After connecting, labels are fetched once. Disconnect and reconnect, or pull-to-refresh in the Log screen.