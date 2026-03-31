# LifeReplay — AI-Powered Communication Coaching Platform

> Real-time AI coaching for presentations, meetings, and public speaking. Powered by Google Gemini, FastAPI, Next.js, and Firestore.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Environment Configuration](#environment-configuration)
6. [Local Development Setup](#local-development-setup)
7. [Running the Application](#running-the-application)
8. [Docker Deployment](#docker-deployment)
9. [Cloud Deployment (GCP)](#cloud-deployment-gcp)
10. [API Reference](#api-reference)
11. [WebSocket Protocol](#websocket-protocol)
12. [AI Pipeline](#ai-pipeline)
13. [Database Schema](#database-schema)
14. [Security](#security)
15. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Next.js Frontend (TypeScript)                  │   │
│  │  Camera/Mic → MediaRecorder → WebSocket → Live UI       │   │
│  └──────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS / WSS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                          │
│              Routes: /api/* → Backend, /* → Frontend            │
│              WebSocket upgrade: /ws/* → Backend                  │
└──────────────────────┬────────────────┬────────────────────────┘
                       │                │
          ┌────────────▼──┐     ┌───────▼──────────┐
          │  FastAPI       │     │  Next.js Server  │
          │  Backend       │     │  (SSR/Static)    │
          │  :8000         │     │  :3000           │
          └────────┬───────┘     └──────────────────┘
                   │
     ┌─────────────┼──────────────┐
     │             │              │
     ▼             ▼              ▼
┌─────────┐  ┌──────────┐  ┌──────────┐
│Firestore│  │ Gemini   │  │  Auth    │
│   DB    │  │   AI     │  │  (JWT)   │
└─────────┘  └──────────┘  └──────────┘
```

### Real-Time Data Flow

```
Browser Camera/Mic
       │
       ▼ (every 2–3s)
Speech Recognition API ──► transcript text
       │
       ▼
WebSocket (audio_chunk message)
       │
       ▼
FastAPI WS Handler
       │
       ├──► Gemini Speech Analysis
       │         │ filler words, pace, confidence
       │         ▼
       │    FeedbackItem saved to Firestore
       │         │
       │         ▼ WebSocket (coaching message)
       │    → Browser shows live coaching tip
       │
       ├──► Gemini Vision Analysis (every 2s frame)
       │         │ eye contact, posture
       │         ▼
       │    MetricSnapshot saved to Firestore
       │         │
       │         ▼ WebSocket (metrics message)
       │    → Browser updates live metric bars
       │
       └──► Session finalized on stop
                 │ Gemini generates summary
                 ▼
            SessionSummary saved to Firestore
                 │
                 ▼ WebSocket (session_summary)
            → Browser shows summary modal
```

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **Frontend** | Next.js 14 + TypeScript | App Router, SSR, type safety |
| **Styling** | Tailwind CSS + Framer Motion | Rapid dark UI, smooth animations |
| **State** | Zustand | Lightweight, persist middleware |
| **Charts** | Recharts | Composable, responsive |
| **Backend** | FastAPI (Python 3.11) | Async-first, WebSocket, fast |
| **AI** | Google Gemini 1.5 Flash | Speech + vision analysis |
| **Database** | Cloud Firestore | Real-time, serverless, scalable |
| **Auth** | JWT (python-jose + bcrypt) | Stateless, secure |
| **Proxy** | Nginx | WebSocket upgrades, rate limiting |
| **Container** | Docker + Docker Compose | Reproducible environments |

---

## Project Structure

```
lifereplay/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py          # /api/v1/auth/* endpoints
│   │   │   ├── sessions.py      # /api/v1/sessions/* endpoints
│   │   │   └── websocket.py     # /ws/session WebSocket endpoint
│   │   ├── core/
│   │   │   ├── config.py        # Pydantic settings (env vars)
│   │   │   ├── security.py      # JWT, bcrypt
│   │   │   └── logging.py       # Structlog setup
│   │   ├── db/
│   │   │   └── firestore.py     # Firestore client + collections
│   │   ├── models/
│   │   │   └── schemas.py       # All Pydantic models
│   │   ├── services/
│   │   │   ├── gemini_service.py  # AI pipeline (speech + vision)
│   │   │   ├── session_service.py # Firestore CRUD for sessions
│   │   │   ├── user_service.py    # Firestore CRUD for users
│   │   │   └── ws_manager.py      # WebSocket connection manager
│   │   └── main.py              # FastAPI app, middleware, lifespan
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/           # Authenticated route group
│   │   │   │   ├── layout.tsx   # Sidebar shell
│   │   │   │   ├── dashboard/   # Dashboard page
│   │   │   │   ├── session/new/ # Live session page
│   │   │   │   ├── sessions/    # Sessions list + [id] replay
│   │   │   │   ├── analytics/   # Analytics + trends
│   │   │   │   └── settings/    # User settings
│   │   │   ├── login/           # Login page
│   │   │   ├── register/        # Register page
│   │   │   ├── globals.css      # Tailwind + custom CSS
│   │   │   └── layout.tsx       # Root layout (fonts, toaster)
│   │   ├── components/
│   │   │   ├── ui/              # ScoreRing, MetricBar
│   │   │   ├── session/         # CoachingFeed, LiveTranscript,
│   │   │   │                    # VolumeMeter, SessionSummaryModal
│   │   │   ├── sessions/        # SessionCard
│   │   │   └── analytics/       # TrendChart
│   │   ├── hooks/
│   │   │   ├── useSessionWS.ts  # WebSocket client hook
│   │   │   └── useMediaCapture.ts # Camera/mic/speech hook
│   │   ├── lib/
│   │   │   ├── api.ts           # Axios client + all API calls
│   │   │   └── utils.ts         # Shared helpers
│   │   ├── store/
│   │   │   └── authStore.ts     # Zustand auth state
│   │   └── types/
│   │       └── index.ts         # All TypeScript interfaces
│   ├── Dockerfile
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── nginx/
│   └── nginx.conf               # Reverse proxy + WS upgrade
├── scripts/
│   ├── setup.sh                 # One-time setup
│   └── dev.sh                   # Start both servers
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Composite index definitions
├── docker-compose.yml
└── .env
```

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.10+ | 3.11 recommended |
| Node.js | 18+ | 20 LTS recommended |
| npm | 9+ | Comes with Node |
| Docker | 24+ | For containerized run |
| Docker Compose | 2.x | `docker compose` v2 |
| Google Cloud Account | — | For Firestore + Gemini |
| `gcloud` CLI | Latest | For GCP deployment |

---

## Environment Configuration

### Step 1 — Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **Get API Key** → **Create API key**
3. Copy your key

### Step 2 — Set up Google Cloud Project

```bash
# Install gcloud CLI if not already installed
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Set project
gcloud config set project warm-alliance-381015

# Enable required APIs
gcloud services enable firestore.googleapis.com
gcloud services enable aiplatform.googleapis.com

# Create Firestore database (Native mode)
gcloud firestore databases create --location=us-central1
```

### Step 3 — Create Service Account Key

```bash
# Create service account
gcloud iam service-accounts create lifereplay-sa \
  --display-name="LifeReplay Service Account"

# Grant roles
gcloud projects add-iam-policy-binding warm-alliance-381015 \
  --member="serviceAccount:lifereplay-sa@warm-alliance-381015.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding warm-alliance-381015 \
  --member="serviceAccount:lifereplay-sa@warm-alliance-381015.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Download key → place in backend/
gcloud iam service-accounts keys create backend/aiplatform-sa-key.json \
  --iam-account=lifereplay-sa@warm-alliance-381015.iam.gserviceaccount.com
```

### Step 4 — Configure .env

Edit the `.env` file in the project root:

```env
# Required: your actual Gemini API key
GEMINI_API_KEY=AIza...your_key_here

# Required: strong random secret for JWT
SECRET_KEY=change_this_to_a_long_random_string_min_32_chars

# These should match your GCP project
PROJECT_ID=warm-alliance-381015
PROJECT_NUMBER=521107151792
REGION=us-central1
```

### Deploy Firestore Indexes

```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Deploy indexes
firebase use warm-alliance-381015
firebase deploy --only firestore:indexes
firebase deploy --only firestore:rules
```

---

## Local Development Setup

### Option A — Automated Setup (Recommended)

```bash
# Clone / enter project
cd lifereplay

# Run setup script (installs all dependencies)
chmod +x scripts/setup.sh scripts/dev.sh
./scripts/setup.sh
```

### Option B — Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import fastapi, google.generativeai; print('Backend deps OK')"
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Verify
npm run type-check
```

---

## Running the Application

### Development Mode

#### Start Both Servers (Recommended)

```bash
# From project root
./scripts/dev.sh
```

#### Or start individually:

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

#### Access Points

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |
| Health Check | http://localhost:8000/health |

---

## Docker Deployment

### Build and Start All Services

```bash
# From project root
docker compose up --build

# Run in background
docker compose up --build -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Individual Service Management

```bash
# Restart backend only
docker compose restart backend

# Rebuild a single service
docker compose up --build backend -d

# Stop everything
docker compose down

# Stop and remove volumes
docker compose down -v
```

### Environment for Docker

Create a `.env` file at the project root (the `docker-compose.yml` reads from it automatically):

```env
GEMINI_API_KEY=your_actual_key
SECRET_KEY=your_strong_secret
PROJECT_ID=warm-alliance-381015
# ... rest of variables
```

**Important:** The service account key file must exist at `backend/aiplatform-sa-key.json` before building.

---

## Cloud Deployment (GCP)

### Option A — Cloud Run (Serverless, Recommended)

#### Deploy Backend to Cloud Run

```bash
# Build and push backend image
gcloud builds submit backend/ \
  --tag gcr.io/warm-alliance-381015/lifereplay-backend

# Deploy to Cloud Run
gcloud run deploy lifereplay-backend \
  --image gcr.io/warm-alliance-381015/lifereplay-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,SECRET_KEY=your_secret,PROJECT_ID=warm-alliance-381015 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 2
```

**Note for WebSocket on Cloud Run:** Cloud Run supports WebSockets natively. Ensure `--session-affinity` is enabled if using multiple instances:

```bash
gcloud run services update lifereplay-backend \
  --session-affinity \
  --region us-central1
```

#### Deploy Frontend to Cloud Run

```bash
# Build and push frontend image
gcloud builds submit frontend/ \
  --tag gcr.io/warm-alliance-381015/lifereplay-frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://your-backend-url.run.app \
  --build-arg NEXT_PUBLIC_WS_URL=wss://your-backend-url.run.app

# Deploy
gcloud run deploy lifereplay-frontend \
  --image gcr.io/warm-alliance-381015/lifereplay-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEXT_PUBLIC_API_URL=https://backend-url.run.app
```

### Option B — Compute Engine (VM with Docker Compose)

```bash
# Create VM
gcloud compute instances create lifereplay-vm \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --zone=us-central1-a \
  --tags=http-server,https-server

# SSH in
gcloud compute ssh lifereplay-vm --zone=us-central1-a

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Clone project
git clone https://github.com/your-org/lifereplay.git
cd lifereplay

# Configure env
nano .env   # Add your keys

# Start
docker compose up -d --build
```

### Configure Firewall

```bash
# Allow HTTP/HTTPS traffic
gcloud compute firewall-rules create allow-http \
  --allow tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --target-tags http-server,https-server
```

### HTTPS with Let's Encrypt (for VM deployment)

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx.conf to use SSL
# Add ssl_certificate and ssl_certificate_key directives
```

---

## API Reference

### Authentication

All protected endpoints require: `Authorization: Bearer <token>`

#### Register
```
POST /api/v1/auth/register
Body: { "email": "user@example.com", "password": "secret123", "name": "Alex" }
Returns: { "access_token": "...", "user": { ... } }
```

#### Login
```
POST /api/v1/auth/login
Body: { "email": "user@example.com", "password": "secret123" }
Returns: { "access_token": "...", "user": { ... } }
```

#### Get Current User
```
GET /api/v1/auth/me
Returns: UserProfile
```

#### Get/Update Settings
```
GET  /api/v1/auth/settings
PUT  /api/v1/auth/settings
Body: UserSettings (partial)
```

### Sessions

#### Create Session (call before WebSocket)
```
POST /api/v1/sessions
Body: { "title": "Practice Run", "description": "optional" }
Returns: Session
```

#### List Sessions
```
GET /api/v1/sessions?limit=20
Returns: Session[]
```

#### Get Session
```
GET /api/v1/sessions/{session_id}
Returns: Session
```

#### Get Session Data (for Replay)
```
GET /api/v1/sessions/{session_id}/metrics
GET /api/v1/sessions/{session_id}/feedback
GET /api/v1/sessions/{session_id}/transcript
```

#### Dashboard + Analytics
```
GET /api/v1/sessions/dashboard
GET /api/v1/sessions/trends?days=14
```

#### Delete Session
```
DELETE /api/v1/sessions/{session_id}
```

---

## WebSocket Protocol

### Connection

```
ws://localhost:8000/ws/session?token=<JWT>
```

The JWT is passed as a query parameter because WebSocket headers are not widely supported.

### Client → Server Messages

#### Start Session
```json
{
  "type": "start_session",
  "session_id": "uuid-of-session-created-via-REST"
}
```

#### Stop Session
```json
{ "type": "stop_session" }
```

#### Send Audio Chunk (with transcript from browser Speech API)
```json
{
  "type": "audio_chunk",
  "data": {
    "transcript": "Hello everyone, so um, today I wanted to basically...",
    "duration_s": 3.2,
    "volume": 72.5
  }
}
```

#### Send Video Frame (base64 JPEG)
```json
{
  "type": "video_frame",
  "data": {
    "frame": "/9j/4AAQSkZJRgAB..."
  }
}
```

#### Ping (keepalive)
```json
{ "type": "ping" }
```

### Server → Client Messages

#### Session Started
```json
{
  "type": "session_started",
  "session_id": "uuid",
  "data": { "message": "Session started. Coaching is active.", "timestamp_ms": 0 }
}
```

#### Live Transcript
```json
{
  "type": "transcript",
  "data": {
    "text": "Hello everyone today I wanted to...",
    "filler_words": ["um", "basically"],
    "timestamp_ms": 3200,
    "word_count": 42
  }
}
```

#### Coaching Feedback
```json
{
  "type": "coaching",
  "data": {
    "id": "uuid",
    "feedback_type": "filler",
    "severity": "warning",
    "message": "Reduce filler words",
    "detail": "Detected: um, basically",
    "timestamp_ms": 6400
  }
}
```

**Feedback Types:** `pace` | `filler` | `eye_contact` | `posture` | `confidence` | `volume` | `clarity` | `positive`
**Severity:** `info` | `warning` | `success`

#### Live Metrics (every 2 seconds)
```json
{
  "type": "metrics",
  "data": {
    "timestamp_ms": 8000,
    "confidence_score": 72.5,
    "speaking_pace_wpm": 142.0,
    "filler_word_count": 3,
    "eye_contact_pct": 68.0,
    "posture_score": 75.0,
    "volume_level": 65.0,
    "clarity_score": 80.0
  }
}
```

#### Session Summary (on stop)
```json
{
  "type": "session_summary",
  "data": {
    "avg_confidence": 71.2,
    "avg_pace_wpm": 138.5,
    "avg_eye_contact_pct": 65.0,
    "avg_posture_score": 72.0,
    "total_filler_words": 12,
    "total_words": 423,
    "top_issues": ["Reduce filler words", "Maintain eye contact"],
    "strengths": ["Good speaking pace", "Clear articulation"],
    "overall_score": 70.8,
    "duration_seconds": 187
  }
}
```

---

## AI Pipeline

### Speech Analysis (Gemini 1.5 Flash)

Triggered every **3 seconds** of accumulated transcript. The pipeline:

1. **Local fast path:** Filler word detection via regex (zero latency)
2. **Gemini analysis:** Sends transcript + duration, receives:
   - `filler_words_found[]` — detected filler words
   - `word_count` — accurate word count
   - `pace_wpm` — words per minute
   - `clarity_score` — 0–100
   - `confidence_indicators` — 0–100
   - `coaching_feedback[]` — 1–3 short coaching messages
3. **Rate limiting:** Each feedback type has a cooldown (5–10s) to avoid spam
4. **Fallback:** If Gemini fails, local analysis is used automatically

### Vision Analysis (Gemini 1.5 Flash)

Triggered every **2 seconds** with a JPEG frame. Returns:
- `eye_contact_score` — 0–100 (100 = looking directly at camera)
- `posture_score` — 0–100 (100 = perfect upright posture)
- `confidence_score` — 0–100 (body language confidence)
- `face_visible` — boolean
- `coaching_feedback[]` — optional feedback items

### Session Summary (Gemini 1.5 Flash)

Generated when session ends. Analyzes:
- Averaged metrics over the full session
- Full transcript text
- Produces: top 3 issues, 2 strengths, overall coaching summary

### Coaching Feedback Cooldowns

| Type | Cooldown |
|---|---|
| Pace | 8 seconds |
| Filler Words | 5 seconds |
| Eye Contact | 6 seconds |
| Posture | 10 seconds |
| Confidence | 8 seconds |

This prevents the user from being overwhelmed with rapid-fire feedback.

---

## Database Schema

### Collection: `users`

```
users/{user_id}
├── user_id: string
├── email: string
├── name: string
├── password_hash: string (bcrypt)
├── created_at: ISO timestamp
├── avatar_url: string | null
├── total_sessions: number
└── total_practice_minutes: number
```

### Collection: `user_settings`

```
user_settings/{user_id}
├── user_id: string
├── camera_device_id: string | null
├── microphone_device_id: string | null
├── coaching_sensitivity: "low" | "medium" | "high"
├── show_live_transcript: boolean
├── show_confidence_meter: boolean
├── auto_start_recording: boolean
├── notification_feedback: boolean
└── updated_at: ISO timestamp
```

### Collection: `sessions`

```
sessions/{session_id}
├── session_id: string (UUID)
├── user_id: string
├── title: string
├── description: string | null
├── status: "pending"|"live"|"processing"|"completed"|"failed"
├── created_at: ISO timestamp
├── started_at: ISO timestamp | null
├── ended_at: ISO timestamp | null
├── duration_seconds: number | null
├── summary: SessionSummary | null
├── metrics_count: number
├── transcript_count: number
└── feedback_count: number
```

#### Sub-collection: `sessions/{id}/metrics`

```
{timestamp_ms}
├── timestamp_ms: number
├── confidence_score: float
├── speaking_pace_wpm: float
├── filler_word_count: int
├── eye_contact_pct: float
├── posture_score: float
├── volume_level: float
└── clarity_score: float
```

#### Sub-collection: `sessions/{id}/feedback`

```
{feedback_id}
├── id: string (UUID)
├── timestamp_ms: number
├── feedback_type: FeedbackType
├── severity: FeedbackSeverity
├── message: string
├── detail: string | null
└── score: float | null
```

#### Sub-collection: `sessions/{id}/transcripts`

```
{segment_id}
├── id: string (UUID)
├── timestamp_ms: number
├── duration_ms: number
├── text: string
├── filler_words: string[]
├── word_count: number
└── confidence: float (0–1)
```

---

## Security

### Authentication Flow

```
Register/Login → bcrypt password hash → JWT issued (7-day expiry)
               → Stored in HTTP-only cookie (js-cookie)
               → Attached as Authorization: Bearer header
               → Verified on every protected route
```

### WebSocket Authentication

JWT is passed as `?token=<jwt>` query parameter on WebSocket connect. The token is validated server-side before the connection is established. Invalid tokens result in `close(4001)`.

### Firestore Security Rules

Security rules enforce that users can only access their own data. No cross-user data access is possible even if a session ID is guessed. See `firestore.rules`.

### Input Validation

All API inputs are validated by Pydantic models. Invalid data returns `422 Unprocessable Entity` with field-level error details.

### Rate Limiting

Nginx applies `30 req/s` burst rate limiting on `/api/*` routes to prevent abuse.

---

## Troubleshooting

### Camera/Microphone Not Working

**Problem:** Browser shows permissions error or no video.

**Solution:**
- Access the app via `https://` or `localhost` only — browsers block camera access on non-secure origins
- Check browser permissions at `chrome://settings/content/camera`
- Grant permissions when prompted

### Speech Recognition Not Working

**Problem:** No transcript appears during session.

**Solution:**
- Speech Recognition API requires Chrome or Edge (not Firefox)
- Must be on HTTPS or localhost
- Check browser console for `SpeechRecognition` errors
- The system degrades gracefully — coaching still works via vision

### WebSocket Connection Fails

**Problem:** `WSStatus` shows "Disconnected" or "Error".

**Solutions:**
- Verify backend is running: `curl http://localhost:8000/health`
- Check that `NEXT_PUBLIC_WS_URL` matches backend port
- Check browser console for WebSocket errors
- Ensure JWT token is valid (try logging out and back in)

### Firestore Permission Denied

**Problem:** `403 PERMISSION_DENIED` errors in backend logs.

**Solutions:**
- Verify `backend/aiplatform-sa-key.json` exists and is valid
- Check service account has `roles/datastore.user` role
- Ensure Firestore is initialized in Native mode (not Datastore mode)

### Gemini API Errors

**Problem:** AI analysis fails, coaching doesn't appear.

**Solutions:**
- Verify `GEMINI_API_KEY` is set correctly in `.env`
- Check API key at [Google AI Studio](https://aistudio.google.com/)
- Check backend logs: `docker compose logs backend`
- The system falls back to local analysis if Gemini fails

### Docker Build Fails

**Problem:** `npm ci` fails or pip install fails.

**Solutions:**
```bash
# Clear Docker cache and rebuild
docker compose build --no-cache

# For frontend npm issues
cd frontend && npm install --legacy-peer-deps
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000
kill -9 <PID>

# Or use different ports via .env
API_BASE_URL=http://localhost:8001
```

---

## Performance Notes

- **Frame rate:** Vision analysis runs every 2.5 seconds (configurable via `frameIntervalMs`). Sending frames more frequently increases Gemini API costs.
- **Transcript batching:** Speech analysis batches 3 seconds of transcript before sending to Gemini, balancing latency vs. API costs.
- **Metric smoothing:** Confidence score is blended 60% historical / 40% vision to avoid jarring jumps.
- **WebSocket keepalive:** Ping/pong runs every 20 seconds to prevent proxy timeouts.

---

## License

MIT License — see LICENSE file.

---

*Built with ❤️ using Google Gemini AI, FastAPI, and Next.js*
