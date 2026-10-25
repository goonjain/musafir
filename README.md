# Jaipur Experience Hub

**Live Demo:** https://musafir-seven-xi.vercel.app

prepare a website for this add all features like particularly we are showing demo for jaipur so make the ui ux interactive according to jaipur themes

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://jaipur-vibe-showcase.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f6d873ac-dc61-4029-9a4d-621e8d59b6ff).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Social Community Feature (Musafir Pulse)

This branch contains the fully functional **Social Community Feature** with complete backend persistence, crowd engine integration, peer verification, and rewards:

- **Live Crowd Check-ins**: Real-time reporting of condition (`Quiet`, `Moderate`, `Busy`, `Packed`), queue wait times, ground-truth crowd photos, and traveler tips.
- **Dynamic Crowd Pressure Feedback**: Instant $+15$ or $+25$ (busy/packed) / $-15$ (quiet) shift applied to the crowd prediction model and live map with a 2-hour sliding window.
- **Anti-Spam & Rate Limiting**: 45-minute cooldown per destination per user (HTTP 429 with countdown).
- **Peer Verification ("Still accurate?")**: Upvoting and trust weight calculation (`trust_weight` boost and "✓ High trust" badge).
- **Server-Controlled Rewards**: $+20$ points per verified check-in, logged in a persistent transaction ledger with a daily cap of 100 points.
- **Photo Verification**: Visual crowd proof captured and rendered directly inside community post cards.

## Running the Backend

### Option A: Python FastAPI Backend (Recommended)
```sh
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --port 8000 --reload
```
To run the automated test suite:
```sh
pytest backend/tests/test_community.py
```

### Option B: Node.js / Express Backend
```sh
npm run backend
# Listens on http://localhost:5000
```

## Running the Frontend
```sh
npm install
npm run dev
# Starts on http://localhost:8080
```
