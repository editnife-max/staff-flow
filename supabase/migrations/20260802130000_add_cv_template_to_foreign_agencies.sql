alter table foreign_agencies
  add column if not exists cv_template_id uuid references cv_templates(id) on delete set null;
