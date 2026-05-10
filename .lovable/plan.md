## Staff-Flow Agency — Phase 1 Plan

Build the foundation plus **Manager** and **Staff** roles. Admin and Foreign Agency come in later phases.

### Brand & design tokens
- Name: **Staff-Flow Agency** (new brand, Musaned screenshots used as visual reference only).
- Palette in `src/styles.css` (oklch): white background `#ffffff`, surface `#f5f7fa`, deep navy `#1a3a52` (primary), teal `#5cb8c4` (accent / CTAs).
- Typography: Inter. Rounded 10–12px, soft shadows, 24px gutters, card + table heavy SaaS layout.
- All shadcn components themed via semantic tokens — no raw color classes in components.

### Backend (Lovable Cloud)
Enable Cloud, then create:
- **Auth**: email/password + Google sign-in. Public `/login` and `/signup` routes.
- **profiles** table (id → auth.users, full_name, avatar_url) with auto-insert trigger on signup.
- **user_roles** table with `app_role` enum (`admin`, `manager`, `staff`, `agency`) + `has_role()` SECURITY DEFINER function. RLS everywhere.
- **staff** table (manager_id, user_id, name, role_title, status).
- **foreign_agencies** table (manager_id, name, country, status, contact).
- **candidates** table (manager_id, full_name, passport_number, serial_number, dob, country, occupation, education, skills, experience, marital_status, gender, religion, age, photo_url, status enum: available/processing/arrived/canceled, created_at).
- RLS: managers see their own org rows; staff see candidates of their assigned manager; service-role bypass only inside server fns.

### Routing (TanStack Start file-based)
```
src/routes/
  __root.tsx           shell
  index.tsx            public landing (hero + Go to Dashboard)
  about.tsx            About Staff-Flow
  contact.tsx          Contact
  faq.tsx              FAQ
  login.tsx            email + Google
  signup.tsx
  _authenticated.tsx   beforeLoad guard → /login
  _authenticated/
    _manager.tsx       role guard for "manager"
    _manager/
      dashboard.tsx
      staff.tsx
      agencies.tsx
      candidates.tsx
      subscription.tsx
    _staff.tsx         role guard for "staff"
    _staff/
      candidates.tsx
      cv-generator.tsx
```
Each route gets its own `head()` metadata. Sidebar adapts via the role guard layout.

### Shared UI components
- `AppShell` with shadcn `Sidebar` (collapsible icon mode), top header with user menu + sign-out.
- `StatCard` (analytics tiles), `StatusBadge` (available/processing/arrived/canceled pills), `DataTable` wrapper around shadcn Table with hover + action column, `PageHeader`.

### Manager role
- **Dashboard**: 4 stat cards (Total Candidates, Processing, Arrived, Canceled) + recent candidates table.
- **Staff**: table (Name, Role, Assigned Tasks count, Actions) + Add Staff dialog.
- **Foreign Agencies**: table (Name, Country, Status, Actions) + Add Agency dialog.
- **Candidates**: Kanban board, 4 columns (Available/Processing/Arrived/Canceled), draggable cards (dnd-kit) with Name, Country, status badge, View button.
- **Subscription Upgrade**: 3 plan cards (Basic/Standard/Pro) + screenshot upload (Cloud Storage bucket `payment-proofs`) + submit. Stored in `subscription_requests` table for the future Admin role.

### Staff role
- **Candidates**: top bar (search 400px, filter dropdown, status quick filters) + table (Avatar+Name, Age, Country, Status, Actions: View / Update Status / Generate CV). Row 64px.
- **CV Generator**: split layout — left 420px scrollable candidate list with search; right pane renders 720×900 CV preview (Name header, Personal details, Experience, Skills) + Download button (client-side `react-to-print` or `html2pdf.js`).

### Server functions
All data reads/writes go through `*.functions.ts` files using `requireSupabaseAuth`. Loaders only run inside `_authenticated/*` (so SSR has a session). No protected fn loaders on public routes.

### Out of scope (Phase 2+)
- Admin role (subscription approval, manager management, payments review).
- Foreign Agency role (browse + select candidates).
- Real payment processing.
- AR localization toggle.

### Deliverable
A working multi-page SaaS with email + Google auth, role-guarded Manager and Staff dashboards, full CRUD on candidates / staff / agencies, Kanban pipeline, and CV generator with PDF download — all themed in the Musaned teal palette.
