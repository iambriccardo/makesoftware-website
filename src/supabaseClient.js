import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let realtimeClient;

export function hasRealtimeConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function groupFormationRealtimeTopic(formationId) {
  return `group-formation:${formationId}`;
}

export function getRealtimeClient() {
  if (!hasRealtimeConfig()) return null;
  if (!realtimeClient) {
    realtimeClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return realtimeClient;
}

export async function callGroupFormation(body, participantToken, formationCode) {
  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL.");
  }

  const method = body ? "POST" : "GET";
  const response = await fetch(`${supabaseUrl}/functions/v1/group-formation`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(participantToken ? { "x-participant-token": participantToken } : {}),
      ...(formationCode ? { "x-formation-code": formationCode } : {}),
    },
    body: body ? JSON.stringify(formationCode ? { ...body, join_code: formationCode } : body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Group Formation request failed.");
  }
  return data;
}
