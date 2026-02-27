# PersonalCoach

A production-ready **iOS + Android** workout tracker + AI personal coach, built with **Expo (React Native)** + **Supabase** + **TypeScript strict**.

## Features

| Tab | What it does |
|-----|-------------|
| 🏋️ **Workouts** | Templates, routines, create/edit/start workouts |
| 📚 **Library** | Exercise library with instructions, history, PR charts |
| 📊 **History** | Workout log, volume charts, body measurements |
| 🥗 **Meals** | Daily meal tracking, AI macro estimation from photo |
| 🤖 **Coach** | AI chat with your training + nutrition data as context |
| ⚙️ **Settings** | Units (kg/lbs), theme, rest timers, plate config |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/YOUR_ORG/personal-coach
cd personal-coach/mobile
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations in order:

```bash
# Using Supabase CLI
supabase db push

# Or paste each file manually in SQL Editor:
supabase/migrations/001_initial_schema.sql
supabase/seed/exercises.sql
```

3. Deploy Edge Functions:

```bash
supabase functions deploy meal-analysis
supabase functions deploy coach-chat

# Set secrets (never committed to git):
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# or
supabase secrets set AI_PROVIDER=openai OPENAI_API_KEY=sk-...
```

### 4. Run the app

```bash
# Expo Go (quick test on device)
npm start

# Android emulator
npm run android

# iOS simulator (macOS only)
npm run ios
```

---

## Project Structure

```
mobile/
├── app/
│   ├── (auth)/          # Login, register screens
│   ├── (tabs)/          # Tab navigator
│   │   ├── workouts/    # Templates + [id] editor
│   │   ├── library/     # Exercise list + [id] detail + new
│   │   ├── history/     # Workout history + [id] detail
│   │   ├── meals/       # Daily meals + AI analysis
│   │   ├── coach/       # AI chat
│   │   └── settings/    # App settings
│   └── workout/session  # Full-screen active workout modal
├── src/
│   ├── types/           # All TypeScript interfaces
│   ├── stores/          # Zustand (auth, workout, meals)
│   ├── hooks/           # useTheme, custom hooks
│   ├── lib/             # Supabase client
│   ├── utils/           # calculations.ts (pure, tested)
│   ├── constants/       # Colors, spacing, fonts
│   └── components/ui/   # Button, Card, Input, Badge, etc.
├── supabase/
│   ├── migrations/      # 001_initial_schema.sql
│   ├── seed/            # exercises.sql (~80 seeded exercises)
│   └── functions/       # meal-analysis, coach-chat (Deno)
└── __tests__/
    └── utils/           # calculations.test.ts
```

---

## Architecture

### Data Model (key tables)

```
profiles          — user settings, goals, unit pref
exercises         — global + user custom exercises
templates         — workout routines
  template_exercises
  template_sets
workouts          — completed workout sessions
  workout_exercises
  workout_sets    — actual reps/weight/rpe
meals             — daily meal log
  meal_items      — ingredients with macros
saved_meals       — reusable meal presets
body_measurements — weight + circumferences
coach_messages    — chat history per user
```

### Offline-first Strategy

- **Supabase + AsyncStorage** persist the auth session.
- Workouts are saved to Supabase on `finishWorkout()`. If offline, an `is_synced: false` flag is set and a retry hook syncs on reconnect (TODO: full offline queue via MMKV).
- React Query caches all reads for 5 minutes.

### AI Endpoints

| Function | Route | Description |
|----------|-------|-------------|
| `meal-analysis` | `POST /functions/v1/meal-analysis` | Base64 image → ingredient list + macros |
| `coach-chat` | `POST /functions/v1/coach-chat` | Chat message + context → coach reply |

Provider is set via `AI_PROVIDER` secret (`anthropic` or `openai`). Swap freely without touching the mobile app.

---

## Running Tests

```bash
npm test
```

Tests cover: `estimate1RM`, `calculateVolume`, `calculatePlates`, `generateWarmUpSets`, `scaleItem`, `recalcTotals`, `formatDuration`.

---

## Security Notes

- All Supabase tables use **Row Level Security (RLS)** — users can only read/write their own data.
- AI API keys are **server-side only** (Supabase Edge Function secrets), never in the mobile bundle.
- Photos are stored in a **private Supabase Storage bucket** (`meal-photos`) — accessible only by the owner via signed URLs.
- Auth tokens are stored in **AsyncStorage** (Expo); for production consider `expo-secure-store` wrapper (already installed).

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `.env` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` | Supabase anon/public key |
| `AI_PROVIDER` | Supabase Secret | `anthropic` or `openai` |
| `ANTHROPIC_API_KEY` | Supabase Secret | Claude API key |
| `OPENAI_API_KEY` | Supabase Secret | OpenAI API key |

---

## TODO / Roadmap

- [ ] Full offline queue with MMKV + sync-on-reconnect
- [ ] Superset grouped UI in active workout
- [ ] Body measurement charts
- [ ] Plate calculator modal in workout session
- [ ] Warm-up set auto-generation
- [ ] HealthKit / Google Fit integration
- [ ] Push notifications for rest timer (background)
- [ ] Share workout as image card
- [ ] E2E tests (Detox or Maestro)
