import { adminClient, assignParticipantToGroup, badRequest, corsHeaders, json, normalizeText, professionCategory, publicParticipant, sha256 } from "../_shared/group-formation.ts";

const publicParticipantFields = "id, formation_id, first_name, last_name, age, years_experience, profession, profession_category, group_id, match_rank, created_at, updated_at";

function normalizeJoinCode(value: unknown) {
  return normalizeText(value, 12).toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 4);
}

function publicFormation(row: Record<string, unknown> | null) {
  if (!row) return null;
  const { join_code: _joinCode, ...rest } = row;
  return rest;
}

function rateLimitsDisabled() {
  const value = (Deno.env.get("GROUP_FORMATION_DISABLE_RATE_LIMITS") ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

async function assignClosedParticipant(supabase: ReturnType<typeof adminClient>, formation: Record<string, any>, participantPayload: Record<string, unknown>) {
  const [{ data: groups, error: groupsError }, { data: participants, error: participantsError }] = await Promise.all([
    supabase
      .from("group_formation_groups")
      .select("*")
      .eq("formation_id", formation.id)
      .order("group_number", { ascending: true }),
    supabase
      .from("group_formation_participants")
      .select(publicParticipantFields)
      .eq("formation_id", formation.id)
      .not("group_id", "is", null)
      .order("match_rank", { ascending: true }),
  ]);

  if (groupsError) throw new Error(groupsError.message);
  if (participantsError) throw new Error(participantsError.message);

  const groupModels = (groups ?? []).map((group) => ({
    ...group,
    participants: (participants ?? []).filter((participant) => participant.group_id === group.id),
  }));
  const assignedGroup = assignParticipantToGroup(groupModels, participantPayload, formation.target_group_size);
  if (!assignedGroup) {
    throw Object.assign(new Error("Groups are closed, but there are no existing groups to join yet. Ask the organizer to run matching first."), { status: 409 });
  }

  const maxRank = assignedGroup.participants.reduce((highest: number, participant: { match_rank?: number | null }) => (
    Math.max(highest, Number(participant.match_rank) || 0)
  ), 0);
  const rankFloor = Number(assignedGroup.group_number ?? 1) * 100 + assignedGroup.participants.length;

  return {
    groupId: assignedGroup.id,
    matchRank: Math.max(rankFloor, maxRank + 1),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = adminClient();

    if (req.method === "GET") {
      const token = normalizeText(req.headers.get("x-participant-token"), 160);
      const joinCode = normalizeJoinCode(req.headers.get("x-formation-code"));
      const { data: formation, error: formationError } = await supabase
        .from("group_formations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (formationError) return badRequest(formationError.message, 500);
      if (!joinCode) return json({ requires_code: true, formation: null, participants: [], groups: [], memberships: [] });
      if (!formation) return badRequest("This group formation code is invalid or no group formation is active.", 404);
      if (joinCode !== formation.join_code) return badRequest("This group formation code is invalid or no group formation is active.", 403);

      const [{ data: participants, error: participantsError }, { data: groups, error: groupsError }] = await Promise.all([
        supabase
          .from("group_formation_participants")
          .select(publicParticipantFields)
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
      const participantIds = (participants ?? []).map((participant) => participant.id);
      const { data: memberships, error: membershipsError } = participantIds.length
        ? await supabase
          .from("group_formation_group_participants")
          .select("*")
          .in("participant_id", participantIds)
        : { data: [], error: null };
      if (membershipsError) return badRequest(membershipsError.message, 500);

      let currentParticipant = null;
      if (token.length >= 32) {
        const pepper = Deno.env.get("GROUP_FORMATION_TOKEN_PEPPER") ?? "group-formation";
        const tokenHash = await sha256(`${pepper}:${formation.id}:${token}`);
        const { data: keyRow, error: keyError } = await supabase
          .from("group_formation_participant_keys")
          .select("participant_id")
          .eq("formation_id", formation.id)
          .eq("participant_token_hash", tokenHash)
          .maybeSingle();
        if (keyError) return badRequest(keyError.message, 500);
        if (keyRow) {
          const { data, error } = await supabase
            .from("group_formation_participants")
            .select(publicParticipantFields)
            .eq("id", keyRow.participant_id)
            .maybeSingle();
          if (error) return badRequest(error.message, 500);
          currentParticipant = data ? publicParticipant(data) : null;
        }
      }

      return json({
        formation: publicFormation(formation),
        participants: (participants ?? []).map(publicParticipant),
        groups: groups ?? [],
        memberships: memberships ?? [],
        current_participant: currentParticipant,
      });
    }

    if (req.method !== "POST") return badRequest("Method not allowed", 405);

    const body = await req.json().catch(() => ({}));
    const token = normalizeText(body.participant_token ?? req.headers.get("x-participant-token"), 160);
    const joinCode = normalizeJoinCode(body.join_code ?? req.headers.get("x-formation-code"));
    if (token.length < 32) return badRequest("Missing participant token.");
    if (!joinCode) return badRequest("Group formation code is required.", 403);

    const { data: formation, error: formationError } = await supabase
      .from("group_formations")
      .select("*")
      .eq("join_code", joinCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (formationError) return badRequest(formationError.message, 500);
    if (!formation) return badRequest("This group formation code is invalid or no group formation is active.", 403);

    const firstName = normalizeText(body.first_name, 80);
    const lastName = normalizeText(body.last_name, 80);
    const profession = normalizeText(body.profession, 120);
    const age = Number(body.age);
    const yearsExperience = Number(body.years_experience);

    if (!firstName || !lastName) return badRequest("First name and last name are required.");
    if (!Number.isInteger(age) || age < 13 || age > 120) return badRequest("Age must be between 13 and 120.");
    if (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80) return badRequest("Years of experience must be between 0 and 80.");
    if (profession.length < 2) return badRequest("Profession is required.");

    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    const forwardedIp = forwardedFor[forwardedFor.length - 1];
    const ip = req.headers.get("cf-connecting-ip") ?? forwardedIp ?? "unknown";
    const pepper = Deno.env.get("GROUP_FORMATION_TOKEN_PEPPER") ?? "group-formation";
    const tokenHash = await sha256(`${pepper}:${formation.id}:${token}`);
    const ipHash = await sha256(`${pepper}:ip:${ip}`);

    const participantPayload = {
      first_name: firstName,
      last_name: lastName,
      age,
      years_experience: yearsExperience,
      profession,
      profession_category: professionCategory(profession),
    };

    const { data: existingParticipant, error: existingParticipantError } = await supabase
      .from("group_formation_participant_keys")
      .select("participant_id")
      .eq("formation_id", formation.id)
      .eq("participant_token_hash", tokenHash)
      .maybeSingle();

    if (existingParticipantError) return badRequest(existingParticipantError.message, 500);

    if (existingParticipant) {
      if (formation.status !== "collecting") {
        return badRequest("Profiles are locked for this group formation. You can still view your existing group, but edits are closed.", 409);
      }

      const { data: participant, error: updateError } = await supabase
        .from("group_formation_participants")
        .update(participantPayload)
        .eq("id", existingParticipant.participant_id)
        .select(publicParticipantFields)
        .single();

      if (updateError) return badRequest(updateError.message, 500);
      return json({ formation: publicFormation(formation), participant: publicParticipant(participant) });
    }

    if (formation.status !== "collecting" && formation.status !== "closed") {
      return badRequest("This group formation is not accepting participant details right now.", 409);
    }

    let closedAssignment: { groupId: string; matchRank: number } | null = null;
    if (formation.status === "closed") {
      try {
        closedAssignment = await assignClosedParticipant(supabase, formation, participantPayload);
      } catch (error) {
        const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 500;
        return badRequest(error instanceof Error ? error.message : "Could not find a group to join.", status);
      }
    }

    if (!rateLimitsDisabled()) {
      const createAttemptSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { error: cleanupRateLimitError } = await supabase
        .from("group_formation_rate_limits")
        .delete()
        .eq("formation_id", formation.id)
        .eq("action", "participant_create")
        .lt("created_at", createAttemptSince);
      if (cleanupRateLimitError) return badRequest(cleanupRateLimitError.message, 500);

      const { count: createAttemptCount, error: createAttemptCountError } = await supabase
        .from("group_formation_rate_limits")
        .select("id", { count: "exact", head: true })
        .eq("formation_id", formation.id)
        .eq("action", "participant_create")
        .eq("ip_hash", ipHash)
        .gte("created_at", createAttemptSince);

      if (createAttemptCountError) return badRequest(createAttemptCountError.message, 500);
      if ((createAttemptCount ?? 0) >= 1) {
        return badRequest("This network already added a new participant for this group formation in the last hour. If this is you, refresh the page to edit your existing profile. If you need help, ask the organizer to clear the rate limit.", 429);
      }

      const { error: createAttemptError } = await supabase.from("group_formation_rate_limits").insert({
        formation_id: formation.id,
        token_hash: tokenHash,
        ip_hash: ipHash,
        action: "participant_create",
      });

      if (createAttemptError) return badRequest(createAttemptError.message, 500);
    }

    const { data: participant, error: insertError } = await supabase
      .from("group_formation_participants")
      .insert({
        formation_id: formation.id,
        group_id: closedAssignment?.groupId ?? null,
        match_rank: closedAssignment?.matchRank ?? null,
        ...participantPayload,
      })
      .select(publicParticipantFields)
      .single();

    if (insertError) return badRequest(insertError.message, 500);

    const { error: keyInsertError } = await supabase
      .from("group_formation_participant_keys")
      .insert({
        formation_id: formation.id,
        participant_id: participant.id,
        participant_token_hash: tokenHash,
        participant_ip_hash: ipHash,
      });

    if (keyInsertError) {
      await supabase.from("group_formation_participants").delete().eq("id", participant.id);
      if (keyInsertError.message.includes("participant_token")) {
        return badRequest("This browser already added a participant for this group formation. Refresh and edit your existing profile.", 409);
      }
      return badRequest(keyInsertError.message, 500);
    }

    if (closedAssignment) {
      const { error: membershipInsertError } = await supabase
        .from("group_formation_group_participants")
        .insert({
          group_id: closedAssignment.groupId,
          participant_id: participant.id,
        });

      if (membershipInsertError) {
        await supabase.from("group_formation_participants").delete().eq("id", participant.id);
        return badRequest(membershipInsertError.message, 500);
      }
    }

    return json({ formation: publicFormation(formation), participant: publicParticipant(participant) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unexpected error", 500);
  }
});
