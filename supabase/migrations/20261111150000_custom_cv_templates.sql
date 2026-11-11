-- Custom CV templates: designs a manager builds in "Custom CV" and their staff use
-- when downloading candidate CVs. Each row belongs to one company (the manager).
-- The whole design (layout, header, sections, footer, theme) is one JSON document,
-- validated by the app (src/components/custom-cv/config.ts → normalizeConfig).

create table if not exists public.custom_cv_templates (
  id          uuid primary key default gen_random_uuid(),
  manager_id  uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  config      jsonb not null default '{}'::jsonb,
  -- Only active templates are offered to staff.
  is_active   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists custom_cv_templates_manager_idx
  on public.custom_cv_templates (manager_id, updated_at desc);

alter table public.custom_cv_templates enable row level security;

-- The app reads and writes through server functions (service role), which enforce the
-- same rules; these policies keep direct client access just as narrow.
drop policy if exists "Managers manage own custom CV templates" on public.custom_cv_templates;
create policy "Managers manage own custom CV templates"
  on public.custom_cv_templates for all to authenticated
  using (manager_id = auth.uid()) with check (manager_id = auth.uid());

drop policy if exists "Staff read their company's active custom CV templates" on public.custom_cv_templates;
create policy "Staff read their company's active custom CV templates"
  on public.custom_cv_templates for select to authenticated
  using (is_active and manager_id = public.get_manager_id(auth.uid()));

drop trigger if exists custom_cv_templates_updated_at on public.custom_cv_templates;
create trigger custom_cv_templates_updated_at before update on public.custom_cv_templates
  for each row execute function public.set_updated_at();
