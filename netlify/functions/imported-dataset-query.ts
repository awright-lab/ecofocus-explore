import { getDatabase, MissingDatabaseConnectionError } from "@netlify/database";
import type { Handler } from "@netlify/functions";
import type { ImportedDatasetQueryConfig } from "../../src/features/data/importedDatasetAnalytics";
import { runImportedDatasetQuery } from "../../src/features/data/importedDatasetAnalytics";

const jsonHeaders = {
  "Content-Type": "application/json"
};

function errorResponse(statusCode: number, error: string, details?: string[]) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify({ error, details })
  };
}

function parseRequest(body: string): ImportedDatasetQueryConfig {
  const payload = JSON.parse(body) as Partial<ImportedDatasetQueryConfig>;
  if (!payload.dataset?.id) throw new Error("Missing imported dataset id.");
  if (payload.dataset.remote?.provider !== "netlify") throw new Error("Imported remote query only supports Netlify-backed datasets.");
  if (!payload.field?.id) throw new Error("Missing imported primary field.");
  return payload as ImportedDatasetQueryConfig;
}

async function loadDatasetRows(datasetId: string) {
  const { pool } = getDatabase();
  const result = await pool.query<{ row_data: Record<string, string> }>(
    "select row_data from imported_dataset_rows where dataset_id = $1 order by row_index asc",
    [datasetId]
  );
  return result.rows.map((row: { row_data: Record<string, string> }) => row.row_data);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  if (!event.body) {
    return errorResponse(400, "Missing request body.");
  }

  try {
    const config = parseRequest(event.body);
    const rows = await loadDatasetRows(config.dataset.id);
    if (!rows.length) {
      return errorResponse(422, "No stored rows are available for this imported dataset.", [
        "The dataset metadata is available, but Netlify Database does not have respondent rows for this dataset yet."
      ]);
    }

    const response = runImportedDatasetQuery({
      ...config,
      dataset: {
        ...config.dataset,
        rows,
        previewRows: config.dataset.previewRows ?? []
      }
    });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    if (error instanceof MissingDatabaseConnectionError) {
      return errorResponse(503, "Netlify Database is not connected for imported dataset queries.", [
        "Connect Netlify Database and rerun the import so rows can be stored server-side."
      ]);
    }

    return errorResponse(500, "Imported dataset query failed.", [error instanceof Error ? error.message : "Unknown error"]);
  }
};
