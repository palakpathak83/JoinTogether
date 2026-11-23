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

## Deployment (Render + MongoDB Atlas)

### 1. MongoDB Atlas
Create a database user, allow network access for your app, and copy the cluster connection string into `MONGODB_URI`. The app uses `jointogether` by default; Atlas creates the database and collections when the app first writes data.

### 2. Deploy the full-stack app on Render (`render.yaml`)
- Connect the repository to Render as a Blueprint and use `render.yaml`.
- Set `MONGODB_URI` in the service environment. Render generates the JWT secrets; set `ADMIN_BOOTSTRAP_PASSCODE` only if you want to require one.
- This service builds the Vite frontend and serves it, the Express API, and Socket.IO from the same origin. The site is available at the Render service URL after deployment; `VITE_API_URL` is not needed.
- Render uses `/api/health` for health checks and runs `npm start`.

### Optional: host the frontend on Vercel
- Deploy the Vite SPA using `vercel.json` only after the Render API is deployed and reachable.
- Set `VITE_API_URL` in Vercel Project Settings to the Render service URL, then redeploy. Set `CLIENT_URL` on Render to the Vercel site origin.
- Without `VITE_API_URL`, the browser sends API calls to Vercel, whose SPA rewrite serves `index.html`; registration then fails with HTTP 405. Use the single-origin Render deployment above if you do not have a separate API URL.
