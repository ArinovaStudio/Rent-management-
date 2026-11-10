# Rental ERP

## Setup

1. `npm install`
2. `cp .env.example .env` and fill it in (`JWT_SECRET` via `openssl rand -base64 32`)
3. `npx prisma migrate dev --name init`
4. `npm run db:seed` (creates the first Super Admin from the env values)
5. `npm run dev` and open http://localhost:3000
