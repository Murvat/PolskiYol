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

The production build compiles the React client and embeds its assets in the Cloudflare Worker at `dist/server/index.js`. The verification script runs the built Worker against a temporary D1 database created from the original migration.

## Portal structure

- `src/router.jsx` defines the portal and account routes. The tutors-only student list is restricted by role. The API independently enforces record access.
- `src/store.js` uses Redux Toolkit and RTK Query to load sessions, run mutations, and refresh cached portal data.
- `src/portal/pages/` contains the tutor and student views. Shared UI lives in `src/portal/`.
- `server/` implements the same-origin JSON API and reads identity from the ChatGPT Sites gateway.
- When supplied by the Sites environment, `.openai/hosting.json` identifies the Site and D1 binding. The applied SQL migration and its metadata live in `drizzle/`. Append future migrations without modifying applied ones.

## Accounts and records

The tutor activates their account once at `/account` with the `TUTOR_SETUP_TOKEN` configured as a Sites secret. The tutor can then create private, single-use student invitations that expire after seven days. A redeemed invitation connects the student to their ChatGPT identity. Students can access their own schedules, payments, and messages, plus shared materials and posts.

D1 stores all portal records. Lesson times use Europe/Warsaw. Payment records use PLN and track status manually.

## ASP.NET Core portal mode

Set `VITE_POLSKIYOL_BACKEND=dotnet` at build time to use the ASP.NET Core API for real accounts. Demo links continue to use the fictional portal data. For Vite development, set `POLSKIYOL_API_TARGET` to the API origin, which defaults to `https://localhost:7140`. Run Vite over HTTPS or use a browser that accepts Secure cookies on localhost. For the hosted Worker, set its `POLSKIYOL_API_TARGET` binding to the deployed HTTPS API origin. The Worker and Vite both forward REST and hub requests through the app's origin.

Users sign in with an ASP.NET Core account. An administrator can assign a registered student to a registered teacher from the account screen. Existing ChatGPT identities and D1 portal records require a separate migration if they need to appear in the ASP.NET Core portal. Teacher assignments and PDF uploads require the API's existing SQL Server and Azure Blob Storage setup. SignalR updates require the API branch that exposes `/hubs/messages`.
