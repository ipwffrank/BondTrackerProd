# Axle — Platform Admin

React + Vite admin dashboard for the Axle platform. Deployed to Netlify, using Firebase (Firestore + Auth).

## Setup

### Prerequisites
- Node.js 18+
- npm

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env.local
# Fill in your Firebase credentials in .env.local
```

Get Firebase credentials from:
**Firebase Console → Project Settings → Your Apps → SDK setup and configuration**

### Run locally

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

## Project Structure

```
src/
  pages/          # Route-level components (Dashboard, Clients, Pipeline, Activities, Team, Analytics, AI)
  components/     # Shared UI components (Navigation, auth guards, marketing)
  services/       # Firebase data layer (clients, pipeline, team, analytics, export)
  contexts/       # React contexts (AuthContext)
  styles/         # Global CSS

bridgelogic-ui/   # Local shared UI package (@bridgelogic/ui)
netlify/functions/ # Serverless functions (send-invite, analyze-transcript, bloomberg-lookup)
```

## Key Dependencies

- **React 18** + React Router v6
- **Firebase** (Auth + Firestore with persistent cache)
- **Vite** (build tool)
- **jsPDF** + **xlsx** (PDF/Excel exports)
- **@google/generative-ai** (AI transcript analysis)
- **resend** (transactional email via Netlify functions)

## Deployment

Deployed via Netlify. Build command: `npm run build`. Publish dir: `dist`.

Set the following environment variables in the **Netlify dashboard** (not in `.env`):
- `VITE_FIREBASE_*` — Firebase config values
- `RESEND_API_KEY` — for email functions
- `ANTHROPIC_API_KEY` — for AI transcript analysis

## GitHub

Source: https://github.com/ipwffrank/BondTrackerProd
Deployed site: https://bondtracker-admin.netlify.app
