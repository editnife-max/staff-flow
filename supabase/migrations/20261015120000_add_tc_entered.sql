-- Mark candidates that were registered through the Training Centre
alter table candidates
  add column if not exists tc_entered boolean not null default false;

-- Index for fast TC queries
create index if not exists idx_candidates_tc_entered
  on candidates (tc_entered)
  where tc_entered = true;
