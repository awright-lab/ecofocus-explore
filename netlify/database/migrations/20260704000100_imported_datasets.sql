create table if not exists imported_datasets (
  id text primary key,
  title text not null,
  file_name text not null,
  file_type text not null,
  source_type text not null default 'netlify',
  row_count integer not null default 0,
  field_count integer not null default 0,
  imported_at timestamptz not null,
  import_status jsonb,
  import_metadata jsonb,
  remote jsonb,
  notes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists imported_dataset_fields (
  dataset_id text not null references imported_datasets(id) on delete cascade,
  field_id text not null,
  label text not null,
  source_column text not null,
  variable_label text,
  value_labels jsonb,
  source_format text,
  field_type text not null,
  non_empty_count integer not null default 0,
  distinct_count integer not null default 0,
  sample_values jsonb,
  modeling_role text not null,
  eligible_for_filter boolean not null default false,
  eligible_for_segment boolean not null default false,
  eligible_for_banner boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dataset_id, field_id)
);

create table if not exists imported_dataset_rows (
  dataset_id text not null references imported_datasets(id) on delete cascade,
  row_index integer not null,
  row_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (dataset_id, row_index)
);

create index if not exists imported_dataset_fields_dataset_id_idx
  on imported_dataset_fields(dataset_id);

create index if not exists imported_dataset_rows_dataset_id_idx
  on imported_dataset_rows(dataset_id);

