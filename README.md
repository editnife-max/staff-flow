# Flowpath Suite

A staff recruitment and management SaaS platform with role-based dashboards, Kanban boards, CV generation, and email/Google authentication — deployed on Cloudflare Workers with Supabase as the backend.

## Features

- **Role-based dashboards** — Separate Manager and Staff views with scoped navigation
- **Candidate management** — Kanban-style pipeline for tracking recruitment stages
- **Staff accounts** — Manage staff profiles and assignments
- **Agency management** — Track and manage recruitment agencies
- **CV generator** — Export candidate CVs as PDF
- **Authentication** — Email/password and Google OAuth via Supabase Auth
- **Subscription management** — Manager-level subscription controls

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
| Icons | Lucide React |
| Toasts | Sonner |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Supabase](https://supabase.com) project
- A [Cloudflare](https://cloudflare.com) account (for deployment)

### Installation

```bash
git clone https://github.com/nifeesleman/flowpath-suite.git
cd flowpath-suite
bun install
```

### Environment Variables

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Development

```bash
bun dev
```

### Build

```bash
bun build        # Production build
bun build:dev    # Development build
bun preview      # Preview production build
```

### Lint & Format

```bash
bun lint         # ESLint check
bun format       # Prettier format
```

## Project Structure

```
src/
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── app-shell.tsx               # Authenticated layout wrapper
│   ├── public-shell.tsx            # Public pages layout
│   ├── page-header.tsx             # Reusable page heading
│   ├── stat-card.tsx               # Dashboard metric tiles
│   └── status-badge.tsx            # Status pill component
├── routes/
│   ├── __root.tsx                  # Root layout
│   ├── _authenticated.tsx          # Auth guard
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
│   ├── login.tsx
│   ├── about.tsx
│   ├── contact.tsx
│   └── faq.tsx
├── integrations/supabase/
│   ├── client.ts                   # Browser Supabase client
│   ├── client.server.ts            # Server-side client
│   ├── auth-middleware.ts          # Auth middleware
│   └── types.ts                    # Generated DB types
├── hooks/
│   ├── use-auth.tsx
│   └── use-mobile.tsx
└── lib/
    ├── candidates.functions.ts
    ├── staff-accounts.functions.ts
    └── utils.ts
```

## Database

Migrations are in `supabase/migrations/`.

```bash
supabase db push                                                               # Apply migrations
supabase gen types typescript --linked > src/integrations/supabase/types.ts   # Regenerate types
```

## Deployment

The app deploys to Cloudflare Workers via `wrangler`. See `wrangler.jsonc` for configuration.

## License

Private — all rights reserved.
