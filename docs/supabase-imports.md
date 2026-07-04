# Supabase Dataset Import Foundation

InsightCanvas can optionally store imported dataset source files and parsed metadata in Supabase. This keeps large imports out of browser-only storage and creates the path for server-side SAV parsing.

## Environment

Set these Vite environment variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_DATASET_BUCKET=dataset-imports
VITE_SUPABASE_DATASET_TABLE=imported_datasets
```

If these values are missing, imports continue to work in local-browser mode.

## Storage Bucket

Create a private bucket named `dataset-imports` or set `VITE_SUPABASE_DATASET_BUCKET` to your preferred bucket name. Uploaded files are stored at:

```text
workspace-imports/{datasetId}/{fileName}
```

## Metadata Table

Create an `imported_datasets` table with at least these columns:

```sql
create table if not exists imported_datasets (
  id text primary key,
  title text not null,
  file_name text not null,
  file_type text not null,
  row_count integer not null default 0,
  field_count integer not null default 0,
  import_status jsonb,
  import_metadata jsonb,
  remote jsonb,
  fields jsonb,
  preview_rows jsonb,
  notes jsonb,
  imported_at timestamptz
);
```

The current client uploads the original file and upserts parsed metadata. Full server-side SAV row parsing is intentionally the next backend step.

## Current Product Behavior

- CSV/XLSX/SAV files still parse in the browser for the first pass.
- When Supabase is configured, the original source file is uploaded and dataset metadata is recorded.
- If a SAV file only yields labels/metadata in the browser, the uploaded source file remains available for future server-side parsing.
- Large respondent rows should ultimately move out of localStorage and into Supabase-backed row storage or query execution.

