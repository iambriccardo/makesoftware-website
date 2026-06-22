import { createClient } from "npm:@supabase/supabase-js@2";
export { assignParticipantToGroup, matchParticipants, professionCategory } from "./matching.js";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-group-formation-admin-token, x-participant-token, x-formation-code",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export type Participant = {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  years_experience: number;
  profession: string;
  profession_category: string;
  group_id?: string | null;
};

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export function badRequest(message: string, status = 400) {
  return json({ error: message }, { status });
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? secretKeys.default;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or a Supabase server-side secret key");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function publicParticipant(row: Record<string, unknown>) {
  return {
    id: row.id,
    formation_id: row.formation_id,
    first_name: row.first_name,
    last_name: row.last_name,
    age: row.age,
    years_experience: row.years_experience,
    profession: row.profession,
    profession_category: row.profession_category,
    group_id: row.group_id,
    match_rank: row.match_rank,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
