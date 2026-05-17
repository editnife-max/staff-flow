# flowpath-suite

Staff recruitment & management SaaS. Role-based dashboards (Manager / Staff), Kanban boards, CV generation, and email + Google auth — deployed on Cloudflare Workers with Supabase as the database/auth layer.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19, SSR, file-based routing) |
| Styling | Tailwind CSS 4 + shadcn/ui (45+ components) |
| Forms | React Hook Form + Zod |
| Data fetching | TanStack React Query |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Edge runtime | Cloudflare Workers (`wrangler.jsonc`) |
| Build | Vite 7, TypeScript 5, Bun |
| Drag-and-drop | dnd-kit |
| PDF export | html2canvas + jspdf |
| Icons | Lucide React |
| Toasts | Sonner |

## Project Structure

```
src/
├── components/
│   ├── ui/                         # shadcn primitives (never edit directly)
│   ├── app-shell.tsx               # Authenticated layout wrapper
│   ├── public-shell.tsx            # Public pages layout
│   ├── page-header.tsx             # Reusable page heading
│   ├── stat-card.tsx               # Dashboard metric tiles
│   └── status-badge.tsx            # Status pill component
├── routes/
│   ├── __root.tsx                  # Root layout (fonts, providers)
│   ├── _authenticated.tsx          # Auth guard (redirects to /login)
│   ├── _authenticated/
│   │   ├── manager.tsx             # Manager shell + nav
│   │   ├── manager.dashboard.tsx
│   │   ├── manager.candidates.tsx
│   │   ├── manager.staff.tsx
│   │   ├── manager.agencies.tsx
│   │   ├── manager.subscription.tsx
│   │   ├── staff.tsx               # Staff shell + nav
│   │   ├── staff.candidates.tsx
│   │   └── staff.cv-generator.tsx
│   ├── index.tsx                   # Public landing page
│   ├── login.tsx                   # Email / Google OAuth
│   ├── about.tsx
│   ├── contact.tsx
│   └── faq.tsx
├── integrations/supabase/
│   ├── client.ts                   # Browser Supabase client
│   ├── client.server.ts            # Server-side client (service role)
│   ├── auth-middleware.ts          # TanStack Start auth middleware
│   └── types.ts                    # Generated DB types
├── hooks/
│   ├── use-auth.tsx                # Auth state + session
│   └── use-mobile.tsx              # Responsive breakpoint
├── lib/
│   ├── candidates.functions.ts     # Server CRUD for candidates
│   ├── staff-accounts.functions.ts # Server CRUD for staff
│   ├── utils.ts                    # cn(), date helpers, etc.
│   └── error-capture/page.ts      # Global error boundary util
├── router.tsx                      # TanStack Router config
├── start.ts                        # TanStack Start middleware entry
└── server.ts                       # Cloudflare Workers entry point
```

## Key Conventions

- **Path alias**: `@/*` → `src/*` (configured in `tsconfig.json` + `vite.config.ts`)
- **Server functions**: Live in `src/lib/*.functions.ts`; always call `requireSupabaseAuth()` at the top
- **Role guards**: Done via TanStack `beforeLoad` in `_authenticated/manager.tsx` and `staff.tsx`
- **UI tokens**: Navy `#1a3a52`, Teal `#5cb8c4` — defined as Tailwind oklch tokens; use semantic class names, not raw hex
- **Supabase RLS**: Every table has Row-Level Security policies — server functions use service role client to bypass when needed
- **shadcn components**: In `src/components/ui/` — add new ones via `npx shadcn add <name>`, never manually copy
- **Data loaders**: Only in protected (authenticated) routes; public routes must avoid server functions

## Dev Commands

```bash
bun dev          # Start local dev server
bun build        # Production build
bun build:dev    # Development build
bun preview      # Preview production build
bun lint         # ESLint check
bun format       # Prettier format all files
```

## Supabase

- Migrations in `supabase/migrations/`
- Apply migrations: `supabase db push`
- Auth: Supabase email + Google OAuth provider
- Regenerate types: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`

## Adding a New Route

1. Create `src/routes/_authenticated/manager.<name>.tsx` (or `staff.<name>.tsx`)
2. Export a `Route` using `createFileRoute`
3. Add nav link in the relevant shell (`manager.tsx` or `staff.tsx`)
4. Add a server function in `src/lib/<name>.functions.ts` if DB access is needed
