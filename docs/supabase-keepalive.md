# Supabase database keepalive

Run `npm run supabase:keepalive` for a single read-only health check using the private `.env`. It reads at most one catalog ID, prints no study data or credentials, times out after 15 seconds per attempt, and retries network failures, rate limits, and server errors up to three attempts. It supports modern secret keys and legacy service-role keys. No dependency installation is needed to run the script directly with Node 24.

`.github/workflows/supabase-keepalive.yml` schedules that check every six hours (00:23, 06:23, 12:23, and 18:23 UTC), independently of this workspace. To activate it:

1. Add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` under the repository's **Settings → Secrets and variables → Actions → New repository secret**. Use the InsightCanvas values from the ignored `.env`; never commit that file. A legacy key can instead be stored as `SUPABASE_SERVICE_ROLE_KEY`.
2. Merge the script and workflow into the repository's default branch and ensure GitHub Actions is enabled.
3. Open **Actions → Supabase database keepalive → Run workflow** and confirm a successful run. Failed checks exit nonzero and appear as failed workflow runs.

The schedule is not active merely because these files exist locally. [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) run from the default branch, can be delayed, and are disabled in public repositories after 60 days without repository activity. Check Actions periodically. [Supabase's Free plan pausing policy](https://supabase.com/docs/guides/platform/free-project-pausing) says a few database requests per day typically prevent inactivity pausing; this is not an uptime guarantee and cannot resume an already paused project. Paid plans are exempt from inactivity pausing.

The check requires the existing `public.private_dataset_versions` catalog in the configured Supabase project. It does not create tables or change study data.
