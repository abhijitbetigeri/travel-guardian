# TravelGuardian - AI-Powered Travel Intelligence & Safety

> Your AI travel companion that sees where you are, remembers what you like, and keeps your loved ones informed.

**Live Demo:** [travel-guardian.butterbase.dev](https://travel-guardian.butterbase.dev)
**Demo Video:** [Loom](https://www.loom.com/share/421ad34990c04b92abd8d8ddf9aa3e24)
**Pitch Deck:** [View Slides](https://htmlpreview.github.io/?https://github.com/abhijitbetigeri/travel-guardian/blob/main/deck.html)
**Track:** Video Intelligence & World Models
**Hackathon:** Beta Hacks x Antler (June 2026)

---

## What It Does

TravelGuardian is a personalized travel agent that combines AI vision, persistent memory, and real-time safety features:

1. **Snap & Understand** - Point at any landmark. AI identifies the place, explains its historical significance, and surfaces safety tips and nearby attractions.
2. **Smart Context** - Chat with an AI that remembers your preferences, past visits, and conversations. It gets smarter with every trip.
3. **Guardian Ping** - One-tap safety check-ins sent to a guardian's real-time dashboard via WebSockets, with AI-generated location summaries.

---

## Architecture

```
+------------------+       +------------------------+       +-------------------+
|                  |       |    Butterbase Backend   |       |                   |
|   React + Vite   | <---> |                        | <---> |  Guardian Device  |
|   Frontend       |       |  +------------------+  |       |  (WebSocket)      |
|                  |       |  | PostgreSQL DB     |  |       |                   |
|  - Gallery       |       |  | 7 tables          |  |       +-------------------+
|  - Explore/Chat  |       |  +------------------+  |
|  - Guardian Dash |       |  | KV Store          |  |
|  - Auth          |       |  | (cache + memory)  |  |
|                  |       |  +------------------+  |
+------------------+       |  | AI Gateway        |  |
                           |  | Gemini 2.5 Flash  |  |
                           |  +------------------+  |
                           |  | Storage           |  |
                           |  | (photo uploads)   |  |
                           |  +------------------+  |
                           |  | Realtime WS       |  |
                           |  | (safety alerts)   |  |
                           |  +------------------+  |
                           |  | Auth              |  |
                           |  +------------------+  |
                           +------------------------+
```

### Data Flow

```
User browses landmark gallery
         |
         v
Clicks "AI Scene Analysis"
         |
         v
+-- Check KV cache (analysis:{landmarkId}) --+
|                                              |
|  HIT: return cached result                   |
|  MISS: call AI Gateway (Gemini 2.5 Flash)   |
|        with landmark photo                   |
|        cache result in KV Store              |
+----------------------------------------------+
         |
         v
Record visit (KV counter + DB row)
Create daily travel plan (DB)
         |
         v
User chats with AI agent
  - Context: landmark, analysis, travel memory,
    conversation memory, learned preferences
  - AI tailors responses to user history
         |
         v
Save conversation memory (KV Store)
Extract preferences from chat (KV + DB)
         |
         v
User sends Guardian Ping
  - Safety check-in written to DB
  - Realtime WebSocket pushes to guardian dashboard
```

### Database Schema

| Table | Purpose |
|---|---|
| `landmarks` | 71 landmarks across 12 countries with photos, coordinates, descriptions |
| `travel_plans` | Daily travel plans per user per city |
| `plan_items` | Items in a plan (landmarks, restaurants, activities) with visited toggle |
| `visits` | Visit tracking per user per landmark with count and photo references |
| `safety_checkins` | Safety pings with AI-generated summaries and GPS coordinates |
| `conversations` | Chat history per user per landmark |
| `guardian_links` | Traveler-to-guardian relationships |

### Persistent Memory Architecture

| Layer | Storage | TTL | Purpose |
|---|---|---|---|
| Analysis Cache | KV Store | 24h | Cached AI scene analysis per landmark |
| Visit Counter | KV Store | 7d | Fast visit count lookup per user per landmark |
| Visit History | Database | Permanent | Full visit records with photos and AI notes |
| Conversation Memory | KV Store | 7d | Chat summaries and context per landmark |
| Preference Learning | KV Store + DB | 7d / Permanent | Extracted preferences (cuisine, safety, interests, mobility) |
| Travel Plans | Database | Permanent | Daily itineraries with checklist items |

### Preference Learning

The AI extracts preferences from natural chat conversation:

| Category | Keywords Detected |
|---|---|
| Cuisine | vegetarian, vegan, halal, seafood, street food, fine dining |
| Safety | solo, family, kids, night, women, elderly |
| Interests | museum, art, history, nature, hiking, nightlife, architecture |
| Mobility | wheelchair, accessible, walking, public transport |

Preferences persist globally and are injected into every future AI conversation, enabling personalized recommendations without the user repeating themselves.

---

## Butterbase Features Used

| Feature | How We Use It |
|---|---|
| **Database** | 7 tables for landmarks, plans, visits, check-ins, conversations |
| **AI Gateway** | Gemini 2.5 Flash for vision-based scene analysis and chat |
| **KV Store** | Analysis caching, visit counters, conversation memory, preferences |
| **Realtime WebSockets** | Live guardian dashboard with instant safety alerts |
| **Auth** | User signup/login for personalized experience |
| **Storage** | Photo uploads at landmarks via presigned URLs |
| **Frontend Deploy** | React+Vite app deployed to butterbase.dev |
| **MCP** | Schema management, seeding, deployment automation |

---

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Butterbase (BaaS)
- **AI Model:** Google Gemini 2.5 Flash (via Butterbase AI Gateway)
- **Deployment:** Butterbase Frontend Deploy
- **Dataset:** Google Landmarks (HuggingFace)

---

## Project Structure

```
antler-hack/
├── CLAUDE.md              # Project instructions
├── README.md              # This file
├── deck.html              # Pitch deck (open in browser)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Router + navbar + auth state
│   │   ├── App.css        # All styles (light theme)
│   │   ├── api.js         # API layer (AI, KV, DB, storage, chat)
│   │   ├── config.js      # Butterbase endpoints + keys
│   │   ├── pages/
│   │   │   ├── Gallery.jsx        # Landmark gallery with search/filter
│   │   │   ├── Explore.jsx        # AI analysis + chat + plans + photos
│   │   │   ├── GuardianDashboard.jsx  # Real-time safety dashboard
│   │   │   └── AuthPage.jsx       # Login/signup
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── landmarks_seed.json    # Seed data
```

---

## Running Locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## License

MIT
