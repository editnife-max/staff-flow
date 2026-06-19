# Staff-Flow

A staff recruitment and management SaaS platform built for labor recruitment agencies. Manages the full candidate journey — from registration and medical checks through CV generation, assignment, and travel — with role-based dashboards for Admins, Managers, Agency operators, and Staff.

---

## Features

### Manager Portal
- **Dashboard** — live pipeline stats (available, medical, COC, travel, placed) with recent-candidate activity feed
- **Candidates** — full CRUD with 40+ data fields; bulk import via Excel; photo & passport scan upload; multi-field search and filter; pagination
- **Staff Accounts** — create and manage sub-accounts scoped to the manager's candidate pool
- **Agencies** — track partner agency relationships
- **Assignments** — manage destination countries and offices; upload DOCX CV templates analyzed by Claude AI; generate filled CVs as DOCX or PDF per candidate or in bulk
- **Subscription** — billing and plan management

### Staff Portal
- **Candidates** — read/update access to the manager's candidate pool
- **CV Generator** — select a CV template and generate filled DOCX/PDF for individual candidates or in bulk with passport-scan page

### Admin Portal
- **Managers** — create manager accounts and view their candidate stats
- **Subscriptions & Payments** — platform-level billing management
- **Admins** — manage admin accounts

### CV Generation Engine
- Templates are uploaded as `.docx` files and analyzed by Claude AI at upload time
- Claude maps every label cell in the template (`Full Name`, `الاسم`, `Date of Birth`, …) to a standard field and records image placeholder cells
- At generation time the engine fills value cells, injects the candidate's photo and full-body photo into image slots, and optionally appends the passport scan as a second page
- Output: `.docx` (with all images embedded) or `.pdf` (via canvas rendering)

### Auth
- Email + password and Google OAuth via Supabase Auth
- Role-based access: `admin`, `manager`, `agency`, `staff` — enforced by Supabase RLS and TanStack `beforeLoad` guards

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19, SSR, file-based routing) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Forms | React Hook Form + Zod |
| Data fetching | TanStack React Query |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Edge runtime | Cloudflare Workers |
| Build | Vite 7, TypeScript 5, Bun |
| Drag-and-drop | dnd-kit |
| PDF export | html2canvas + jspdf |
| DOCX processing | PizZip (raw OOXML manipulation) |
| AI analysis | Anthropic Claude API (template field mapping) |
| Icons | Lucide React |
| Toasts | Sonner |

---

## Project Structure

```
src/
├── components/
│   ├── ui/                          # shadcn/ui primitives (never edit directly)
│   ├── action-dialog.tsx            # CV generation engine (DOCX fill + PDF export)
│   ├── app-shell.tsx                # Authenticated layout wrapper
│   ├── public-shell.tsx             # Public pages layout
│   ├── page-header.tsx              # Reusable page heading
│   ├── stat-card.tsx                # Dashboard metric tiles
│   └── status-badge.tsx            # Candidate status pill
├── routes/
│   ├── __root.tsx                   # Root layout (fonts, providers)
│   ├── _authenticated.tsx           # Auth guard — redirects to /login if unauthenticated
│   ├── _authenticated/
│   │   ├── dashboard.tsx            # Redirect hub by role
│   │   ├── manager.tsx              # Manager shell + nav
│   │   ├── manager.dashboard.tsx
│   │   ├── manager.candidates.tsx
│   │   ├── manager.staff.tsx
│   │   ├── manager.agencies.tsx
│   │   ├── manager.assignments.tsx  # CV templates + country/office management
│   │   ├── manager.invoice.tsx
│   │   ├── manager.subscription.tsx
│   │   ├── staff.tsx                # Staff shell + nav
│   │   ├── staff.dashboard.tsx
│   │   ├── staff.candidates.tsx
│   │   ├── staff.cv-generator.tsx
│   │   ├── agency.tsx               # Agency shell + nav
│   │   ├── agency.candidates.tsx
│   │   ├── admin.tsx                # Admin shell + nav
│   │   ├── admin.dashboard.tsx
│   │   ├── admin.managers.tsx
│   │   ├── admin.admins.tsx
│   │   ├── admin.subscriptions.tsx
│   │   └── admin.payments.tsx
│   ├── index.tsx                    # Public landing page
│   ├── login.tsx                    # Email + Google OAuth
│   ├── about.tsx
│   ├── contact.tsx
│   └── faq.tsx
├── integrations/supabase/
│   ├── client.ts                    # Browser Supabase client
│   ├── client.server.ts             # Server-side client (service role key)
│   ├── auth-middleware.ts           # TanStack Start auth middleware
│   └── types.ts                     # Generated DB types
├── hooks/
│   ├── use-auth.tsx                 # Auth state + session
│   └── use-mobile.tsx               # Responsive breakpoint
├── lib/
│   ├── assignments.functions.ts     # CV template upload, AI analysis, country/office CRUD
│   ├── candidates.functions.ts      # Candidate CRUD server functions
│   ├── staff-accounts.functions.ts  # Staff account CRUD
│   └── utils.ts                     # cn(), date helpers
├── router.tsx                       # TanStack Router config
├── start.ts                         # TanStack Start middleware entry
└── server.ts                        # Cloudflare Workers entry point
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local DB / migrations)
- A Supabase project with email and Google OAuth providers enabled
- An Anthropic API key (for CV template AI analysis)
- A Cloudflare account (for deployment)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ANTHROPIC_API_KEY=<your-anthropic-key>
```

For Cloudflare Workers deployment, set the same variables as Worker secrets via `wrangler secret put`.

### 3. Apply database migrations

```bash
supabase db push
```

### 4. Start the dev server

```bash
bun dev
```

The app will be available at `http://localhost:5173`.

---

## Dev Commands

```bash
bun dev          # Start local dev server (Vite + TanStack Start)
bun build        # Production build
bun build:dev    # Development build
bun preview      # Preview the production build locally
bun lint         # ESLint check
bun format       # Prettier format all files
```

---

## Supabase

- Migrations are in `supabase/migrations/`
- Apply to the linked project: `supabase db push`
- Regenerate TypeScript types after schema changes:
  ```bash
  supabase gen types typescript --linked > src/integrations/supabase/types.ts
  ```
- Every table has Row-Level Security (RLS) policies. Server functions use the service-role client to bypass RLS when needed.

---

## Role System

| Role | Access |
|---|---|
| `admin` | Full platform management (managers, subscriptions, payments) |
| `manager` | Own candidates, staff accounts, agencies, CV templates |
| `staff` | Read/update candidates belonging to their manager |
| `agency` | Read candidates assigned to their agency |

Roles are stored in the `user_roles` table. Guards are enforced both at the database level (RLS) and in the router (`beforeLoad` in each role shell route).

---

## CV Template System

1. **Upload** a `.docx` file via the Assignments page
2. The server extracts the document's table layout (cell widths, row heights, image slot dimensions) and sends it to Claude AI
3. Claude maps every label cell to a standard field (`FULL_NAME`, `DATE_OF_BIRTH`, `PASSPORT_NUMBER`, …) and identifies photo placeholder cells
4. The mapping is stored in the template's `metadata` column in Supabase
5. At generation time, the engine fills value cells using the stored mapping and injects the candidate's photos into the correct image slots
6. Download as `.docx` or `.pdf`, individually or in bulk

---

## Deployment

The app targets **Cloudflare Workers** via `wrangler.jsonc`. After setting Worker secrets:

```bash
bun build
bunx wrangler deploy
```

---

## Adding a New Route

1. Create `src/routes/_authenticated/<role>.<name>.tsx`
2. Export a `Route` using `createFileRoute`
3. Add a nav link in the relevant shell file (`manager.tsx`, `staff.tsx`, etc.)
4. If DB access is needed, add a server function in `src/lib/<name>.functions.ts` and call `requireSupabaseAuth()` at the top
