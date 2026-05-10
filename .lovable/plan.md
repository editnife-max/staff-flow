## Staff-Flow — Candidates Spreadsheet Dashboard

Rebuild `/staff/candidates` as a SaaS spreadsheet for managing candidate records end-to-end. Manager Kanban and other routes stay untouched.

### 1. Database (single migration)

Extend `public.candidates`:

New enums:
- `medical_status` — `pending | fit | unfit`
- `passport_status` — `pending | submitted | received | expired`
- `doc_status` — `pending | in_progress | done | rejected` (used for COC + Musaned)
- `office_name` — `saudi | kuwait | uae | qatar | bahrain | oman | other`

New columns on `candidates`:
- `candidate_code text unique` (auto-generated `CND-XXXXXX` via trigger when null)
- `birth_place text`, `living_town text`, `labour_id text`
- `office office_name`
- `passport_status passport_status default 'pending'`
- `coc_status doc_status default 'pending'`
- `musaned_status doc_status default 'pending'`
- `medical_status medical_status default 'pending'`
- `medical_date date`
- `selected_by text`, `cv_sent_to text`, `cv_sent_date date`
- `narrative text`, `notes text`
- `deleted_at timestamptz` (soft delete)

Indexes: `(manager_id, deleted_at)`, `(manager_id, status)`, `(manager_id, medical_status)`, `(manager_id, office)`, plus a trigram index on `full_name` and `candidate_code` for search.

RLS: keep existing policies, add `deleted_at IS NULL` filter to SELECT policies (and a separate "view trashed" SELECT for managers only — out of scope for v1, just enforce filter at query level).

### 2. Server functions (`src/lib/candidates.functions.ts`)

Add / update:
- `listCandidates({ search?, filters?, sort?, includeDeleted? })` — returns rows where `deleted_at IS NULL`, ordered server-side.
- `updateCandidateField({ id, field, value })` — whitelisted field set, used by inline edits.
- `softDeleteCandidate({ id })` and `bulkSoftDelete({ ids })` — set `deleted_at = now()`.
- `bulkUpdateField({ ids, field, value })` — generic for medical / availability / office / passport / coc / musaned.
- Existing `upsertCandidate` extended to accept new fields.

All gated by `requireSupabaseAuth` + manager scope (existing `resolveManagerId`).

### 3. Page rewrite — `src/routes/_authenticated/staff.candidates.tsx`

Replace current implementation with a spreadsheet shell composed of small components in `src/components/candidates/`:

```text
candidates/
  CandidatesToolbar.tsx     search, filters, column toggle, export, add
  CandidatesTable.tsx       table + sort headers + row checkboxes
  EditableCell.tsx          text inline edit (input on click, save on blur/Enter)
  EditableSelectCell.tsx    select inline edit with enum options
  StatusPill.tsx            colored pill per status type
  BulkActionBar.tsx         floating bar shown when selection > 0
  ColumnVisibilityMenu.tsx  dropdown of toggles + Show All / Reset
  DeleteConfirmDialog.tsx   single + bulk delete confirm
  useCandidatesView.ts      hook: search/filter/sort state + derived rows
```

Behavior:
- TanStack Query `useQuery(['candidates', filters, sort])` calls `listCandidates`.
- Inline edits use `useMutation` with optimistic update + sonner toast on success/error.
- Selection state is `Set<string>` of row ids; checkbox column + header "select all (filtered)".
- Sorting: 3-state (asc / desc / none) per column; icons in header.
- Column visibility persisted under `localStorage["staff-flow.candidates.columns.v1"]`.
- CSV export: builds rows from currently visible columns and current filtered set; filename `candidates_YYYY-MM-DD.csv`; values escaped per RFC 4180.
- Soft delete: confirm dialog → call server fn → invalidate query.

### 4. Filters (combine with AND)

- Search: `ilike` on `full_name` or `candidate_code`.
- Medical: `fit | pending | unfit | all`.
- Availability: existing `available | processing | arrived | canceled | all`.
- Office: enum values + `all`.

All filters live in URL search params via TanStack Router so views are shareable; pagination resets when any filter changes (page size 50, server-side `range()`).

### 5. Default visible columns

`full_name, candidate_code, passport_number, labour_id, office, passport_status, coc_status, medical_status, status, notes`.

All other fields available via column menu.

### 6. Out of scope (this phase)

- Trash / restore UI (rows are soft-deleted but no recovery screen yet).
- Photo upload changes (existing `photo_url` field reused as-is).
- Manager Kanban changes.
- Realtime subscriptions.

### 7. Deliverables checklist

- [ ] Migration applied (enums, columns, indexes, code-generation trigger).
- [ ] Server fns updated + soft delete enforced everywhere.
- [ ] New components under `src/components/candidates/`.
- [ ] `/staff/candidates` rewritten using the new shell.
- [ ] Column prefs persist; CSV export downloads cleanly; bulk + inline edits show toasts.
- [ ] Build passes; manual smoke on the route.
