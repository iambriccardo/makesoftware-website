import { adminClient, badRequest, corsHeaders, json, matchParticipants, normalizeText, professionCategory as classifyProfession } from "../_shared/group-formation.ts";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type SeedParticipantRow = {
  first_name: string;
  last_name: string;
  age: number;
  years_experience: number;
  profession: string;
  profession_category: string;
};

function authorized(req: Request) {
  const customToken = Deno.env.get("GROUP_FORMATION_ADMIN_TOKEN");
  const receivedAdminToken = req.headers.get("x-group-formation-admin-token") ?? "";

  return Boolean(customToken && customToken.length >= 24 && receivedAdminToken === customToken);
}

function makeJoinCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => codeAlphabet[byte % codeAlphabet.length]).join("");
}

function errorWithStatus(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

async function matchAndCloseFormation(supabase: ReturnType<typeof adminClient>, activeFormation: Record<string, any>) {
  const { data: participants, error: participantsError } = await supabase
    .from("group_formation_participants")
    .select("id, first_name, last_name, age, years_experience, profession, profession_category")
    .eq("formation_id", activeFormation.id)
    .order("created_at", { ascending: true });

  if (participantsError) throw errorWithStatus(participantsError.message, 500);
  if (!participants || participants.length < 2) throw errorWithStatus("At least two participants are required to match.", 409);

  const now = new Date().toISOString();
  const { error: matchingError } = await supabase
    .from("group_formations")
    .update({ status: "matching", matching_started_at: now })
    .eq("id", activeFormation.id);

  if (matchingError) throw errorWithStatus(matchingError.message, 500);

  await supabase.from("group_formation_group_participants").delete().in("participant_id", participants.map((participant: { id: string }) => participant.id));
  await supabase.from("group_formation_participants").update({ group_id: null, match_rank: null }).eq("formation_id", activeFormation.id);
  await supabase.from("group_formation_groups").delete().eq("formation_id", activeFormation.id);

  const matchedGroups = matchParticipants(participants, activeFormation.target_group_size);
  const createdGroups = [];

  for (const matchedGroup of matchedGroups) {
    const { data: group, error: groupError } = await supabase
      .from("group_formation_groups")
      .insert({
        formation_id: activeFormation.id,
        group_number: matchedGroup.group_number,
        label: matchedGroup.label,
        score: matchedGroup.score,
      })
      .select("*")
      .single();

    if (groupError) throw errorWithStatus(groupError.message, 500);
    createdGroups.push(group);

    for (let index = 0; index < matchedGroup.participants.length; index += 1) {
      const participant = matchedGroup.participants[index];
      const rank = matchedGroup.group_number * 100 + index;
      const { error: participantError } = await supabase
        .from("group_formation_participants")
        .update({ group_id: group.id, match_rank: rank })
        .eq("id", participant.id);

      if (participantError) throw errorWithStatus(participantError.message, 500);

      const { error: membershipError } = await supabase
        .from("group_formation_group_participants")
        .insert({ group_id: group.id, participant_id: participant.id });

      if (membershipError) throw errorWithStatus(membershipError.message, 500);
    }
  }

  const finishedAt = new Date().toISOString();
  const { data: updatedFormation, error: finalError } = await supabase
    .from("group_formations")
    .update({ status: "closed", matched_at: finishedAt, closed_at: finishedAt })
    .eq("id", activeFormation.id)
    .select("*")
    .single();

  if (finalError) throw errorWithStatus(finalError.message, 500);
  return { formation: updatedFormation, participants, groups: createdGroups };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return badRequest("Method not allowed", 405);
  if (!authorized(req)) return badRequest("Unauthorized", 401);

  try {
    const supabase = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body.action, 32);

    if (action === "status") {
      const { data: formation, error: formationError } = await supabase
        .from("group_formations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (formationError) return badRequest(formationError.message, 500);
      if (!formation) return json({ formation: null, participants: [], groups: [] });

      const [{ data: participants, error: participantsError }, { data: groups, error: groupsError }] = await Promise.all([
        supabase
          .from("group_formation_participants")
          .select("id, formation_id, first_name, last_name, age, years_experience, profession, profession_category, group_id, match_rank, created_at, updated_at")
          .eq("formation_id", formation.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("group_formation_groups")
          .select("*")
          .eq("formation_id", formation.id)
          .order("group_number", { ascending: true }),
      ]);

      if (participantsError) return badRequest(participantsError.message, 500);
      if (groupsError) return badRequest(groupsError.message, 500);
      return json({ formation, participants: participants ?? [], groups: groups ?? [] });
    }

    if (action === "create") {
      const { data: existingFormation, error: existingFormationError } = await supabase
        .from("group_formations")
        .select("id, status, closed_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingFormationError) return badRequest(existingFormationError.message, 500);
      if (existingFormation) {
        return badRequest("A group formation already exists. Reset it before creating another one.", 409);
      }

      const title = normalizeText(body.title, 120) || "Make Software Group Formation";
      const targetGroupSize = Number.isInteger(body.target_group_size) ? body.target_group_size : 3;
      const publicNote = normalizeText(body.public_note, 240);
      const requestedJoinCode = normalizeText(body.join_code, 8).toUpperCase().replace(/[^A-Z2-9]/g, "");
      const joinCode = requestedJoinCode.length === 4 ? requestedJoinCode : makeJoinCode();

      const { data, error } = await supabase
        .from("group_formations")
        .insert({
          title,
          join_code: joinCode,
          status: "draft",
          public_note: publicNote,
          target_group_size: Math.min(8, Math.max(2, targetGroupSize)),
          settings: body.settings && typeof body.settings === "object" ? body.settings : {},
        })
        .select("*")
        .single();

      if (error) {
        const message = error.message.includes("group_formations_single_room_idx")
          ? "A group formation already exists. Reset it before creating another one."
          : error.message;
        return badRequest(message, 409);
      }
      return json({ formation: data });
    }

    if (action === "seed") {
      const { data: existingFormation, error: existingFormationError } = await supabase
        .from("group_formations")
        .select("id, status, closed_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingFormationError) return badRequest(existingFormationError.message, 500);
      if (existingFormation) {
        return badRequest("A group formation already exists. Reset it before seeding another one.", 409);
      }

      const seedParticipants = Array.isArray(body.participants) ? body.participants : [];
      if (seedParticipants.length < 2 || seedParticipants.length > 80) {
        return badRequest("Seed requires between 2 and 80 participants.", 400);
      }

      const cleanParticipants: SeedParticipantRow[] = seedParticipants.map((participant: Record<string, unknown>) => {
        const firstName = normalizeText(participant.first_name, 80);
        const lastName = normalizeText(participant.last_name, 80);
        const profession = normalizeText(participant.profession, 120);
        const age = Number(participant.age);
        const yearsExperience = Number(participant.years_experience);
        if (!firstName || !lastName || profession.length < 2) {
          throw errorWithStatus("Every seed participant needs first_name, last_name, and profession.", 400);
        }
        if (!Number.isInteger(age) || age < 13 || age > 120) throw errorWithStatus("Seed participant age must be between 13 and 120.", 400);
        if (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80) {
          throw errorWithStatus("Seed participant years_experience must be between 0 and 80.", 400);
        }
        return {
          first_name: firstName,
          last_name: lastName,
          age,
          years_experience: yearsExperience,
          profession,
          profession_category: classifyProfession(profession),
        };
      });

      const title = normalizeText(body.title, 120) || "Seeded Group Formation";
      const targetGroupSize = Number.isInteger(body.target_group_size) ? body.target_group_size : 3;
      const publicNote = normalizeText(body.public_note, 240);
      const requestedJoinCode = normalizeText(body.join_code, 8).toUpperCase().replace(/[^A-Z2-9]/g, "");
      const joinCode = requestedJoinCode.length === 4 ? requestedJoinCode : makeJoinCode();
      const seedState = normalizeText(body.seed_state ?? body.state, 24) || "closed";
      if (seedState !== "collecting" && seedState !== "closed") {
        return badRequest("Seed state must be either collecting or closed.", 400);
      }
      const openedAt = new Date().toISOString();

      const { data: formation, error: formationCreateError } = await supabase
        .from("group_formations")
        .insert({
          title,
          join_code: joinCode,
          status: "collecting",
          opened_at: openedAt,
          public_note: publicNote,
          target_group_size: Math.min(8, Math.max(2, targetGroupSize)),
          settings: body.settings && typeof body.settings === "object" ? body.settings : {},
        })
        .select("*")
        .single();

      if (formationCreateError) {
        const message = formationCreateError.message.includes("group_formations_single_room_idx")
          ? "A group formation already exists. Reset it before seeding another one."
          : formationCreateError.message;
        return badRequest(message, 409);
      }

      const participantRows = cleanParticipants.map((participant: SeedParticipantRow) => ({
        formation_id: formation.id,
        ...participant,
      }));

      const { error: participantsInsertError } = await supabase
        .from("group_formation_participants")
        .insert(participantRows);

      if (participantsInsertError) {
        await supabase.from("group_formations").delete().eq("id", formation.id);
        return badRequest(participantsInsertError.message, 500);
      }

      if (seedState === "collecting") {
        const { data: participants, error: participantsError } = await supabase
          .from("group_formation_participants")
          .select("id, formation_id, first_name, last_name, age, years_experience, profession, profession_category, group_id, match_rank, created_at, updated_at")
          .eq("formation_id", formation.id)
          .order("created_at", { ascending: true });
        if (participantsError) {
          await supabase.from("group_formations").delete().eq("id", formation.id);
          return badRequest(participantsError.message, 500);
        }
        return json({ formation, participants: participants ?? [], groups: [] });
      }

      const matched = await matchAndCloseFormation(supabase, formation);
      return json(matched);
    }

    const { data: latestFormation, error: latestFormationError } = await supabase
      .from("group_formations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestFormationError) return badRequest(latestFormationError.message, 500);
    if (!latestFormation) return badRequest("No group formation exists.", 404);

    const activeFormation = latestFormation.closed_at ? null : latestFormation;

    if (action === "open" || action === "collect") {
      if (!activeFormation) return badRequest("No draft formation is available to open.", 404);
      if (activeFormation.status !== "draft") return badRequest("Only a draft formation can move to collecting.", 409);

      const { data, error } = await supabase
        .from("group_formations")
        .update({ status: "collecting", opened_at: new Date().toISOString() })
        .eq("id", activeFormation.id)
        .select("*")
        .single();

      if (error) return badRequest(error.message, 500);
      return json({ formation: data });
    }

    if (action === "close") {
      if (!activeFormation) return json({ formation: latestFormation });

      const { data, error } = await supabase
        .from("group_formations")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", activeFormation.id)
        .select("*")
        .single();

      if (error) return badRequest(error.message, 500);
      return json({ formation: data });
    }

    if (action === "reset") {
      if (body.confirm !== "DELETE_GROUP_FORMATION") {
        return badRequest("Reset requires confirm: DELETE_GROUP_FORMATION", 400);
      }

      const { error } = await supabase
        .from("group_formations")
        .delete()
        .eq("id", latestFormation.id);

      if (error) return badRequest(error.message, 500);
      return json({ deleted: latestFormation.id });
    }

    if (action === "clear_rate_limits") {
      const { data, error } = await supabase
        .from("group_formation_rate_limits")
        .delete()
        .eq("formation_id", latestFormation.id)
        .select("id");

      if (error) return badRequest(error.message, 500);
      return json({ formation: latestFormation, cleared: data?.length ?? 0 });
    }

    if (action === "delete_participants") {
      const participantIds = Array.isArray(body.participant_ids)
        ? body.participant_ids.map((id: unknown) => normalizeText(id, 80)).filter(Boolean)
        : [];
      if (!participantIds.length) return badRequest("Provide participant_ids to delete.", 400);

      const { data, error } = await supabase
        .from("group_formation_participants")
        .delete()
        .eq("formation_id", latestFormation.id)
        .in("id", participantIds)
        .select("id, first_name, last_name, profession, group_id");

      if (error) return badRequest(error.message, 500);
      const touchedGroupIds = Array.from(new Set((data ?? []).map((participant) => participant.group_id).filter(Boolean)));
      const emptyGroupIds = [];
      for (const groupId of touchedGroupIds) {
        const { count, error: countError } = await supabase
          .from("group_formation_group_participants")
          .select("participant_id", { count: "exact", head: true })
          .eq("group_id", groupId);
        if (countError) return badRequest(countError.message, 500);
        if ((count ?? 0) === 0) emptyGroupIds.push(groupId);
      }
      if (emptyGroupIds.length) {
        const { error: groupDeleteError } = await supabase
          .from("group_formation_groups")
          .delete()
          .in("id", emptyGroupIds);
        if (groupDeleteError) return badRequest(groupDeleteError.message, 500);
      }
      return json({ formation: latestFormation, deleted: data ?? [] });
    }

    if (action === "match") {
      if (!activeFormation) return badRequest("No collecting formation is available to match.", 404);
      if (activeFormation.status !== "collecting") return badRequest("Only a collecting formation can be matched.", 409);

      return json(await matchAndCloseFormation(supabase, activeFormation));
    }

    return badRequest("Unknown action.", 400);
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === "number" ? (error as { status: number }).status : 500;
    return badRequest(error instanceof Error ? error.message : "Unexpected error", status);
  }
});
