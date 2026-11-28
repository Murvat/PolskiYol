# PolskiYol

An Azerbaijani-language Polish tutoring portal with React JavaScript, React Router, Redux Toolkit (RTK Query), Tailwind CSS, and Cloudflare D1.

## Development

Use Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

The local Vite server provides the tutor and student demos at `/?demo=tutor` and `/?demo=student`. It runs with fictional data. The hosted portal uses ChatGPT identity and the existing D1 database.

```sh
npm run build
npm test
```

The production build compiles the React client and embeds its assets in the Cloudflare Worker at `dist/server/index.js`. The verification script runs the built Worker against a temporary D1 database created by applying the SQL migrations in order.

## Portal structure

- `src/router.jsx` defines the portal and account routes. The tutors-only student list is restricted by role. The API independently enforces record access.
- `src/store.js` uses Redux Toolkit and RTK Query to load sessions, run mutations, and refresh cached portal data.
- `src/portal/pages/` contains the tutor and student views. Shared UI lives in `src/portal/`.
- `server/` implements the same-origin JSON API and reads identity from the ChatGPT Sites gateway.
- `.openai/hosting.json` identifies the existing Site and D1 binding. The applied SQL migration and its metadata live in `drizzle/`. Append future migrations without modifying applied ones.

## Accounts and records

The tutor activates their account once at `/account` with the `TUTOR_SETUP_TOKEN` configured as a Sites secret. The tutor can then create private, single-use student invitations that expire after seven days. A redeemed invitation connects the student to their ChatGPT identity. Students can access their own schedules, payments, and messages, plus shared materials and posts.

D1 stores all portal records. Lesson times use Europe/Warsaw. Payment records use PLN and track status manually.

## Zoom classroom pilot

The Worker owns classroom state and authorizes every operation against the D1 roster. Provider adapters issue credentials, end sessions, and normalize authenticated lifecycle events. The React classroom uses a separate media adapter. To add a provider, register its Worker and React implementations and exercise the shared lifecycle tests with the same contract.

Apply the roster and live-room migrations with the matching Worker release. Back up D1 before applying the migration that rebuilds the lessons table. A local build can run without the Sites hosting descriptor. Include the existing descriptor when packaging a hosted release.

Configure Zoom Video SDK credentials `ZOOM_VIDEO_SDK_KEY` and `ZOOM_VIDEO_SDK_SECRET`, a Zoom Build API key `ZOOM_API_KEY` with session-status update scope, and `ZOOM_WEBHOOK_SECRET` as Worker secrets. Point Zoom's session started and ended subscriptions to `/api/lessons/live/events/zoom`. Configure the deployed Worker to invoke its scheduled handler every minute for automatic room closure and cleanup retries.

Set `LIVE_LESSONS_ENABLED=true` on HTTPS staging. Run a one-to-one and a six-person lesson with mic, camera, audio-only entry, desktop screen sharing, mobile joining, and reconnect. Verify teacher end, cancellation, and timeout with the teacher browser closed. From fresh browsers, verify that previously issued teacher and student credentials fail to recreate or join the closed Zoom session. Keep the production flag off until those checks pass. Review Zoom usage and Worker cleanup retry logs during the pilot.
