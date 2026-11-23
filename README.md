# JoinTogether

JoinTogether is a full-stack group matching platform built with React, TypeScript, Tailwind CSS, Express, Mongoose (MongoDB), JWT + HttpOnly refresh cookies, RBAC, and authenticated Socket.IO real-time messaging.

## Core Capabilities

- **Category-Specific Matching Engine**: Dedicated compatibility scoring and hard-rule filtering for **Shopping** (store, delivery zone, order minimum progress), **Travel** (destination, date proximity, budget ceiling, mode/pace), **Hackathons** (event, mutual role complementarity, tech stack overlap), and **Events** (city, venue, schedule, ticket tier, vibe).
- **Authentication & RBAC**: Short-lived access JWTs held in memory paired with rotating `HttpOnly` refresh cookies stored hashed in MongoDB. Server-enforced roles (`USER`, `ADMIN`, `SUPER_ADMIN`) with one-time Super Admin bootstrap claim.
- **Atomic Group Formation & Capacity**: Join request approval/rejection and instant-join flows enforced atomically in MongoDB (`findOneAndUpdate` with `$expr` capacity guards) to prevent race-condition overbooking.
- **Authenticated Real-Time Chat**: Socket.IO server validating JWTs on handshake and MongoDB group membership on every room join, message send, and read receipt update.

## Local Development

1. Configure environment variables (copy `.env.example` to `.env` or set in Secrets):
   - `MONGODB_URI`: MongoDB Atlas or local MongoDB connection string. Keep Atlas credentials in `.env`; do not commit or share them.
   - `MONGODB_DB_NAME`: Database name (defaults to `jointogether`; MongoDB creates it on the first write)
   - `PORT`: `3000` (default)
   - `CLIENT_URL`: Allowed frontend origins for CORS (optional in local dev)
   - `ADMIN_BOOTSTRAP_PASSCODE`: Optional passcode for claiming the first `SUPER_ADMIN` account
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the full-stack server (Express + Socket.IO + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```
4. Verify health check:
   ```bash
   curl http://localhost:3000/api/health
   ```

## Testing

- **Backend Unit & Integration Tests (Jest + Supertest + MongoDB)**:
  ```bash
  npm test
  ```
- **Frontend Component Tests (Vitest + Testing Library)**:
  ```bash
  npm run test:frontend
  ```
- **End-to-End Browser Tests (Playwright)**:
  ```bash
  npm run test:e2e
  ```
- **Type Check & Production Build**:
  ```bash
  npm run lint && npm run build
  ```

## Deployment (Render + Vercel + MongoDB Atlas)

### 1. MongoDB Atlas
Create a database user, allow network access for your app, and copy the cluster connection string into `MONGODB_URI`. The app uses `jointogether` by default; Atlas creates the database and collections when the app first writes data.

### 2. Backend & Socket.IO on Render (`render.yaml`)
- Connect your repository to Render using `render.yaml`.
- Set `MONGODB_URI` and `CLIENT_URL` (your Vercel URL, e.g. `https://jointogether.vercel.app`) in Render Environment Variables.
- Render uses `/api/health` for health checks and runs `npm start`.

### 3. Frontend on Vercel (`vercel.json`)
- Deploy the Vite SPA to Vercel using `vercel.json`.
- Set `VITE_API_URL` in Vercel Project Settings to your Render backend URL (e.g. `https://jointogether-api.onrender.com`).
