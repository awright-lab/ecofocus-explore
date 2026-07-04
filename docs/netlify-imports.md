# Netlify Dataset Import Storage

InsightCanvas is configured to prefer Netlify-hosted dataset import storage. This keeps source files and parsed metadata out of browser-only `localStorage`, while preserving the current frontend import flow.

## Current Flow

```text
Browser parses first-pass metadata/rows
  -> POST /.netlify/functions/dataset-import
  -> Netlify Function stores original file in Netlify Blobs
  -> Netlify Function stores parsed dataset metadata JSON in Netlify Blobs
  -> Netlify Function writes dataset, field, and row records to Netlify Database when connected
  -> frontend keeps using the normalized imported dataset contract
```

If the Netlify Function is unavailable, the import falls back to local workspace storage and shows a storage note. If Netlify Database is not connected yet, the Function still stores the original source file and metadata JSON in Netlify Blobs and returns an import-status note that the database write was skipped.

## Environment

The default provider is Netlify:

```env
VITE_DATASET_IMPORT_PROVIDER=netlify
NETLIFY_DATASET_BLOB_STORE=dataset-imports
NETLIFY_DATASET_METADATA_STORE=dataset-import-metadata
```

`NETLIFY_DB_URL` is provided server-side by Netlify Database after the site is connected to a database. It should not be exposed as a `VITE_` client variable.

Set `VITE_DATASET_IMPORT_PROVIDER=local` to disable remote upload during local testing.

## Netlify Blobs

The function stores original files at:

```text
workspace-imports/{datasetId}/{fileName}
```

Parsed dataset metadata is stored as:

```text
datasets/{datasetId}.json
```

## Netlify Database

The import Function writes to these tables through `@netlify/database`:

- imported dataset records
- imported field metadata
- value labels
- import status
- parsed rows as JSON records

The schema lives in:

```text
netlify/database/migrations/20260704000100_imported_datasets.sql
```

Netlify applies this migration during deploy previews and production deploys when Netlify Database is enabled for the site.

## Current Boundaries

- CSV/XLSX rows parsed in the browser are persisted to the database.
- SAV metadata parsed in the browser is persisted, but server-side SAV row parsing is still a future pass.
- Imports remain usable if Database is temporarily unavailable because the source file is still stored in Netlify Blobs.
- The frontend contract remains unchanged: imported datasets still flow through the normalized workspace dataset model.

## Recommended Next Pass

Add server-side parsing from the stored Blob source file:

1. Load the original source file from Netlify Blobs inside the Function or a background job.
2. Parse CSV/XLSX/SAV server-side, with special focus on SAV respondent rows.
3. Update the database rows and import status to `ready`, `metadata_only`, or `failed`.
4. Add a read path that can hydrate large imported datasets from Netlify Database instead of browser storage.
