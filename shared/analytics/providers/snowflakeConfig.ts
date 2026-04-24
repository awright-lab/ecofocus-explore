export interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
  role: string;
  authenticator?: string;
}

export interface SnowflakeReadiness {
  configured: boolean;
  missingEnvVars: string[];
  config?: SnowflakeConfig;
}

const requiredSnowflakeEnvVars = [
  "SNOWFLAKE_ACCOUNT",
  "SNOWFLAKE_USERNAME",
  "SNOWFLAKE_PASSWORD",
  "SNOWFLAKE_WAREHOUSE",
  "SNOWFLAKE_DATABASE",
  "SNOWFLAKE_SCHEMA",
  "SNOWFLAKE_ROLE"
] as const;

function readEnv(name: string, env: Record<string, string | undefined>) {
  return env[name]?.trim() ?? "";
}

export function getSnowflakeReadiness(env: Record<string, string | undefined> = process.env): SnowflakeReadiness {
  const missingEnvVars = requiredSnowflakeEnvVars.filter((name) => !readEnv(name, env));

  if (missingEnvVars.length > 0) {
    return {
      configured: false,
      missingEnvVars
    };
  }

  return {
    configured: true,
    missingEnvVars: [],
    config: {
      account: readEnv("SNOWFLAKE_ACCOUNT", env),
      username: readEnv("SNOWFLAKE_USERNAME", env),
      password: readEnv("SNOWFLAKE_PASSWORD", env),
      warehouse: readEnv("SNOWFLAKE_WAREHOUSE", env),
      database: readEnv("SNOWFLAKE_DATABASE", env),
      schema: readEnv("SNOWFLAKE_SCHEMA", env),
      role: readEnv("SNOWFLAKE_ROLE", env),
      authenticator: readEnv("SNOWFLAKE_AUTHENTICATOR", env) || undefined
    }
  };
}

export function requireSnowflakeConfig(env: Record<string, string | undefined> = process.env): SnowflakeConfig {
  const readiness = getSnowflakeReadiness(env);

  if (!readiness.configured || !readiness.config) {
    throw new Error(`Snowflake provider is not configured. Missing: ${readiness.missingEnvVars.join(", ")}.`);
  }

  return readiness.config;
}

export const snowflakeEnvVars = requiredSnowflakeEnvVars;
