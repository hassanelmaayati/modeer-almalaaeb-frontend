# Modeer Almalaaeb

## Vercel deployment

Import this repository in Hassan's Vercel account and select the Hobby plan. Use
the `main` production branch and Node.js 24.x; `vercel.json` sets the Vite build,
`dist` output and SPA rewrites so refreshing `/groups`, `/sports` and other routes
works.

Keep **Enable access to System Environment Variables** enabled in Vercel so the
build can detect Vercel and reject a missing or non-HTTPS production API URL.

Set `VITE_API_BASE_URL` in Vercel's **Production** environment to
`https://YOUR-BACKEND.onrender.com/api/v1` before deploying. This public URL also
sets the secure WebSocket destination; no separate WebSocket service is needed.
Vite's `/api` proxy is for local development only. Never add database credentials
or the backend JWT secret to frontend environment variables.

After Vercel assigns the production URL, set that exact origin (without a trailing
slash) as `CORS_ORIGINS` in Render and redeploy the backend. Preview deployments
need their own explicitly allowed origins to call it. Leave `VITE_GOOGLE_CLIENT_ID`
unset unless Google sign-in is configured with the same client ID on the backend.
Changing a `VITE_` variable requires a new frontend build/deployment.

Pushes to the connected `main` branch deploy automatically. Verify `/sports`
loads backend sports and refresh `/groups` directly after the deployment.

## Project idea

A community website for people in Bahrain to organize activities, make friends, build groups and chat.

Activities: football, basketball, padel, tennis, volleyball, badminton, **walking together, running and cycling**. Outings use participant lists with optional distance, pace and route notes.

**Scope:** Six core models plus Cup — seven models total.

**Status:** In development; English-first desktop/mobile website. **Stack:** React/Vite (JavaScript/JSX), FastAPI, SQLAlchemy/Alembic, PostgreSQL, WebSockets, Redis and a background worker.

Original project idea:

https://docs.google.com/document/d/146Ux37oZdEJnZHlKk3vzWZATzfPnYqUf0dR-ri5tRlU/edit?usp=sharing

## Repository links

- [Backend](https://github.com/hassanelmaayati/modeer-almalaaeb-backend)
- [Frontend](https://github.com/hassanelmaayati/modeer-almalaaeb-frontend)

## User stories

- As a visitor, I want to browse activities and rooms so I can find a suitable game or outing.
- As a player, I want an account and profile so others can recognize me.
- As a host, I want to schedule rooms and approve players so I can organize my activity.
- As an admitted player, I want a slot, readiness and room chat so we can coordinate.
- As a completion host, I want to record attendance and rate attended players so history reflects participation.
- As a player, I want accepted friendships and direct messages so I can coordinate privately.
- As a group owner/member, I want invitations and reusable groups so we can meet again.
- As a captain/organizer, I want football cups with accepted rosters and fixtures so teams can compete.
- As a visitor, I want sports news from an external API so I can follow updates.
- As an administrator, I want user role/status controls so I can manage access.

## Wireframes


Main planning screens, organized by journey. Editable originals are in `assets/wireframes/`.

### Discover

**Home**

![Home page](assets/previews/home-desktop.png)

**Browse and filter rooms**

![Room discovery and filters](assets/previews/room-list-desktop.png)

### Create and join

**Create and open a scheduled activity**

![Room creation and preview](assets/previews/create-room-desktop.png)

**Admitted player: choose a slot and coordinate**

![Team lobby with slots, readiness and chat](assets/previews/room-desktop.png)

### Walk, run or cycle

**Admitted player: mobile roster and meeting details**

![Mobile lobby for walking, running and cycling](assets/previews/room-pool-mobile.png)

### After the activity

**Completion host: attendance, ratings and group invitations**

![After-game attendance and ratings](assets/previews/after-game-desktop.png)

Original wireframes; the new designs add mobile layouts and missing screens:

https://excalidraw.com/#json=mm8VWN_xrBNjyhHDay83Q,RyXy2F4vY2rYgb8-3t7_Xw

## ERDs

**Six core models + one Cup model:**

| Model | Stores |
| --- | --- |
| User | Accounts, profiles and roles |
| Sport | Activities and format presets |
| Room | Schedule, privacy, capacity and slot layout |
| Membership | Room/group members, friend connections and cup rosters |
| Message | Room chat and direct messages |
| Group | Social groups and persistent teams |
| Cup — seventh model | Teams, bracket, fixtures and results |

Membership uses a checked `kind` (room/group/friend/cup). Room slots and cup fixtures are embedded data, validated by the server.

![Six core models plus Cup ERD](assets/previews/erd.png)

[Editable ERD](assets/diagrams/erd.svg) · [Model details](assets/models.json)

## Routes/endpoints

Each model shares a small set of pages and scoped endpoints. Use `/api/v1` before the API paths shown below. Frontend paths use `:roomId`; FastAPI paths use `{room_id}`.

| Model / feature | Main frontend routes | Main API endpoints |
| --- | --- | --- |
| User | `/sign-in`, `/sign-up`, `/users/:userId`, `/settings` | `POST /auth/signup`, `/auth/login`, `/auth/google`<br>`GET/PATCH /users/me` |
| Sport | `/`, `/rooms` | `GET /sports` |
| Room | `/rooms`, `/rooms/new`, `/rooms/:roomId`, `/my-rooms` | `GET/POST /rooms`<br>`GET/PATCH /rooms/{room_id}`<br>`POST /rooms/{room_id}/cancel` |
| Membership | Room/after-game pages, `/friends`, group/cup pages | `GET/POST /rooms/{room_id}/members`<br>`GET/POST /friends`<br>`GET/POST /groups/{group_id}/members`<br>`POST /cups/{cup_id}/roster` |
| Message | Room chat, `/messages`, `/messages/:userId` | `GET/POST /messages` |
| Group | `/groups`, `/groups/new`, `/groups/:groupId` | `GET/POST /groups`<br>`GET/PATCH /groups/{group_id}` |
| Cup | `/cups`, `/cups/new`, `/cups/:cupId` | `GET/POST /cups`<br>`GET/PATCH /cups/{cup_id}`<br>`POST /cups/{cup_id}/entries` |

Membership routes handle requests, consent, slots, readiness, attendance and ratings with action-specific permissions. Rooms open on creation and start/finish automatically. WebSockets deliver room and message updates.

[Route map](assets/diagrams/endpoints.svg) · [Methods and permissions](assets/interfaces.json)

## Component hierarchy

Shared account/live providers support room pages, friends, groups, messaging, cups and external news.

![Compact React component hierarchy](assets/previews/component-hierarchy.png)

[Editable hierarchy](assets/diagrams/component-hierarchy.svg)
