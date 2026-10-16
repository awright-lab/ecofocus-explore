import { setTimeout as sleep } from 'node:timers/promises';

// Server/CI only. Read one catalog ID; never log credentials or query results.
async function main() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('SUPABASE_URL must be a valid HTTPS project URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password
    || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SUPABASE_URL must be an HTTPS project origin without credentials, path, or query.');
  }
  url.pathname = '/rest/v1/private_dataset_versions';
  url.search = '?select=id&limit=1';
  const headers = { apikey: key, Accept: 'application/json' };
  // Modern sb_secret_ keys are not JWTs and must not be sent as Bearer tokens.
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
    } catch {
      // Do not print raw network exceptions: they can contain request details.
      if (attempt === 3) throw new Error('Database check failed after three network attempts.');
      console.warn(`Database unavailable; retrying (${attempt}/3).`);
      await sleep(attempt * 2_000);
      continue;
    }

    if (response.ok) {
      let rows;
      try {
        rows = await response.json();
      } catch {
        throw new Error('Database returned an invalid response.');
      }
      if (!Array.isArray(rows)) throw new Error('Database returned an unexpected response.');
      console.log(`Supabase database check passed at ${new Date().toISOString()}.`);
      return;
    }

    const status = response.status;
    await response.body?.cancel();
    if (attempt === 3 || (status !== 429 && status < 500)) {
      throw new Error(`Database check failed (HTTP ${status}). Check project status, credentials, and catalog migration.`);
    }
    console.warn(`Database returned HTTP ${status}; retrying (${attempt}/3).`);
    await sleep(attempt * 2_000);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
