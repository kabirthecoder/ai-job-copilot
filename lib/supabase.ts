import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SavedAnalysis, SupabaseEnvConfig } from "@/lib/types";

export type SupabaseIntegrationState = {
  enabled: boolean;
  remoteReady: boolean;
  table: string;
  statusMessage: string;
};

export type SupabaseSyncResult = {
  ok: boolean;
  status: "local" | "remote" | "error";
  message: string;
};

const DEFAULT_TABLE = "saved_analyses";

export function getSupabaseConfig(): SupabaseEnvConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const missing: string[] = [];

  if (!url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    url,
    anonKey,
    enabled: missing.length === 0,
    missing
  };
}

export function getSupabaseTableName() {
  return process.env.NEXT_PUBLIC_SUPABASE_TABLE?.trim() || DEFAULT_TABLE;
}

export function getSupabaseIntegrationState(): SupabaseIntegrationState {
  const config = getSupabaseConfig();
  const table = getSupabaseTableName();

  if (!config.enabled) {
    return {
      enabled: false,
      remoteReady: false,
      table,
      statusMessage: `Supabase is in local-only mode. Missing env vars: ${config.missing.join(", ")}.`
    };
  }

  return {
    enabled: true,
    remoteReady: true,
    table,
    statusMessage: `Supabase remote sync is ready for table ${table}.`
  };
}

export function isSupabaseConfigured(config: SupabaseEnvConfig = getSupabaseConfig()) {
  return config.enabled;
}

export function getSupabaseStatusMessage(config: SupabaseEnvConfig = getSupabaseConfig()) {
  if (config.enabled) {
    return `Supabase is configured. Remote sync can target ${getSupabaseTableName()}.`;
  }

  if (config.missing.length === 0) {
    return "Supabase is not configured. The app will keep using local browser storage.";
  }

  return `Missing Supabase env vars: ${config.missing.join(", ")}. The app will keep using local browser storage.`;
}

export type SupabaseClientState = {
  enabled: boolean;
  config: SupabaseEnvConfig;
  client: SupabaseClient | null;
};

export function createSupabaseClientState(): SupabaseClientState {
  const config = getSupabaseConfig();

  return {
    enabled: config.enabled,
    config,
    client: createBrowserSupabaseClient()
  };
}

export function createBrowserSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();

  if (!config.enabled) {
    return null;
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function toSupabaseRecord(analysis: SavedAnalysis) {
  return {
    id: analysis.id,
    created_at: analysis.createdAt,
    updated_at: analysis.updatedAt,
    source: analysis.source,
    input: analysis.input,
    result: analysis.result
  };
}

export async function syncSavedAnalysisToSupabase(
  analysis: SavedAnalysis
): Promise<SupabaseSyncResult> {
  const config = getSupabaseConfig();

  if (!config.enabled) {
    return {
      ok: false,
      status: "local",
      message: "Supabase is not configured, so the analysis was kept in local storage."
    };
  }

  const client = createBrowserSupabaseClient();

  try {
    if (client) {
      const { error } = await client.from(getSupabaseTableName()).insert(toSupabaseRecord(analysis));

      if (!error) {
        return {
          ok: true,
          status: "remote",
          message: `Saved analysis to Supabase table ${getSupabaseTableName()}.`
        };
      }

      return {
        ok: false,
        status: "error",
        message: `Supabase sync failed: ${error.message}`
      };
    }
  } catch {
    // Fall through to REST-based attempt below.
  }

  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(getSupabaseTableName())}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(toSupabaseRecord(analysis))
    });

    if (response.ok) {
      return {
        ok: true,
        status: "remote",
        message: `Saved analysis to Supabase table ${getSupabaseTableName()}.`
      };
    }

    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      status: "error",
      message: `Supabase sync failed with ${response.status}${detail ? `: ${detail}` : ""}.`
    };
  } catch {
    return {
      ok: false,
      status: "error",
      message: "Supabase sync could not complete, so the local copy was kept."
    };
  }
}
