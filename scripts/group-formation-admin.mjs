import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline/promises";

const endpointPath = {
  admin: "group-formation-admin",
};

const seedFirstNames = [
  "Ada", "Grace", "Linus", "Radia", "Margaret", "Katherine", "Alan", "Barbara",
  "Evelyn", "Donald", "Frances", "Hedy", "Ken", "Mary", "Tim", "Anita",
  "Claude", "Sophie", "Maya", "Nadia", "Victor", "Elena", "Jonas", "Priya",
];

const seedLastNames = [
  "Lovelace", "Hopper", "Torvalds", "Perlman", "Hamilton", "Johnson", "Turing", "Liskov",
  "Boyd", "Knuth", "Allen", "Lamarr", "Thompson", "Wilkes", "Berners", "Borg",
  "Shannon", "Wilson", "Chen", "Rossi", "Muller", "Patel", "Garcia", "Novak",
];

const seedProfessions = [
  "frontend engineer",
  "backend engineer",
  "full stack developer",
  "mobile iOS engineer",
  "security engineer",
  "devops engineer",
  "data scientist",
  "machine learning researcher",
  "bioinformatics PhD student",
  "computer science undergraduate student",
  "self-taught career switcher",
  "product manager",
  "startup founder",
  "product designer",
  "ux researcher",
  "visual designer",
  "community organizer",
  "teacher and facilitator",
  "technical writer",
  "illustrator",
];

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function color(value, tint) {
  if (!process.stdout.isTTY) return value;
  return `${colors[tint] ?? ""}${value}${colors.reset}`;
}

function loadDotEnv(path = ".env") {
  const file = resolve(process.cwd(), path);
  if (!existsSync(file)) return;

  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function printHelp() {
  console.log(`${color("Group Formation Admin", "bold")}

Controls the Supabase Edge Functions for the live group formation tool.

${color("Required env", "cyan")}
  VITE_SUPABASE_URL or SUPABASE_URL
  GROUP_FORMATION_ADMIN_TOKEN  # required for admin commands

The script automatically reads .env if present.

${color("Commands", "cyan")}
  status
    Show the latest group formation state and code.

  participants
    List participants for the latest formation with IDs and group labels.

${color("Lifecycle states", "cyan")}
  draft: create [--title text] [--note text] [--size number] [--code ABCD] [--url https://site]
    Create the draft formation. Fails if any formation already exists.

  collecting: collect
    Open the draft formation so people can add/edit profiles.

  matching -> closed: match
    Run matching. The formation briefly enters matching, then closes when groups are written.

  closed: close
    Close the active formation without running matching.

${color("Testing", "cyan")}
  seed [--count number] [--state collecting|closed] [--title text] [--note text] [--size number] [--code ABCD] [--url https://site]
    Create randomized participants. Use --state collecting to keep profiles open, or --state closed to match and close immediately.
    Fails if any formation already exists.

${color("Maintenance", "cyan")}
  clear-rate-limits
    Clear participant creation rate limits for the latest formation.

  delete-participants --ids id1,id2 [--yes]
    Remove participants from the latest formation. Use participants first to inspect IDs.

  reset [--yes]
    Delete the latest formation and all its participants/groups.

${color("Examples", "cyan")}
  npm run group:admin -- status
  npm run group:admin -- participants
  npm run group:admin -- create --title "Test Formation" --note "opens at 19:00"
  npm run group:admin -- collect
  npm run group:admin -- match
  npm run group:admin -- close
  npm run group:admin -- clear-rate-limits
  npm run group:admin -- delete-participants --ids abc,def --yes
  npm run group:admin -- seed --count 18 --state collecting --size 3 --url http://127.0.0.1:5173
  npm run group:admin -- seed --count 18 --state closed --size 3 --url http://127.0.0.1:5173
  npm run group:admin -- reset --yes
`);
}

function parseArgs(argv) {
  const [command = "help", maybeJson, ...rest] = argv;
  const args = maybeJson?.startsWith("{") ? rest : [maybeJson, ...rest].filter(Boolean);
  const flags = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }

  const jsonPayload = maybeJson?.startsWith("{") ? JSON.parse(maybeJson) : {};
  return { command, flags, jsonPayload };
}

function configFor(command) {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const adminToken = process.env.GROUP_FORMATION_ADMIN_TOKEN || "";

  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_URL.");
  }

  if (!adminToken) {
    throw new Error("Missing GROUP_FORMATION_ADMIN_TOKEN.");
  }

  return { supabaseUrl, adminToken };
}

function payloadFromCreateFlags(flags, jsonPayload = {}) {
  const payload = { ...jsonPayload };
  if (flags.title) payload.title = String(flags.title);
  if (flags.note) payload.public_note = String(flags.note);
  if (flags.size) payload.target_group_size = Number(flags.size);
  if (flags.code) payload.join_code = String(flags.code).toUpperCase();
  return payload;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function seedParticipant(index) {
  const firstName = seedFirstNames[index % seedFirstNames.length];
  const lastName = seedLastNames[(index * 7 + Math.floor(index / seedFirstNames.length)) % seedLastNames.length];
  const profession = randomItem(seedProfessions);
  const yearsExperience = Math.max(0, Math.min(32, Math.round(Math.random() * 22 + (index % 5) - 1)));
  const age = Math.max(18, Math.min(68, 20 + yearsExperience + Math.floor(Math.random() * 18)));
  return {
    first_name: firstName,
    last_name: lastName,
    age,
    years_experience: yearsExperience,
    profession,
  };
}

function seedParticipantsFromFlags(flags, jsonPayload = {}) {
  if (Array.isArray(jsonPayload.participants) && jsonPayload.participants.length) return jsonPayload.participants;
  const count = Number(flags.count ?? jsonPayload.count ?? 18);
  if (!Number.isInteger(count) || count < 2 || count > 80) {
    throw new Error("Seed count must be an integer between 2 and 80.");
  }
  return Array.from({ length: count }, (_, index) => seedParticipant(index));
}

function seedStateFromFlags(flags, jsonPayload = {}) {
  const state = String(flags.state ?? jsonPayload.seed_state ?? jsonPayload.state ?? "closed").trim().toLowerCase();
  if (state !== "collecting" && state !== "closed") {
    throw new Error("Seed state must be either collecting or closed.");
  }
  return state;
}

function idsFromFlags(flags, jsonPayload = {}) {
  const source = flags.ids ?? flags.id ?? jsonPayload.participant_ids ?? jsonPayload.ids ?? "";
  if (Array.isArray(source)) return source.map(String).map((id) => id.trim()).filter(Boolean);
  return String(source).split(/[,\s]+/).map((id) => id.trim()).filter(Boolean);
}

async function requestFunction({ supabaseUrl, adminToken }, functionName, body) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { "x-group-formation-admin-token": adminToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `Request failed with HTTP ${response.status}`);
  }
  return data;
}

function joinLink(url, code) {
  if (!url || !code) return "";
  const base = String(url).replace(/\/$/, "");
  return `${base}/group-formation?code=${encodeURIComponent(code)}`;
}

function summarize(data, options = {}) {
  const formation = data.formation;
  if (!formation) {
    console.log(color("No active group formation.", "yellow"));
    return;
  }

  console.log(`${color(formation.title, "bold")}
  status: ${color(formation.status, formation.status === "closed" ? "green" : "cyan")}
  group formation code: ${color(formation.join_code ?? "n/a", "yellow")}
  target group size: ${formation.target_group_size}
  people: ${data.participants?.length ?? "n/a"}
  groups: ${data.groups?.length ?? "n/a"}
  id: ${color(formation.id, "dim")}`);

  const link = joinLink(options.url, formation.join_code);
  if (link) console.log(`  invite link: ${color(link, "cyan")}`);
}

function participantName(participant) {
  return `${participant.first_name ?? ""} ${participant.last_name ?? ""}`.trim() || "Unnamed";
}

function printParticipants(data) {
  summarize(data);
  const groups = new Map((data.groups ?? []).map((group) => [group.id, group.label]));
  const participants = data.participants ?? [];
  if (!participants.length) {
    console.log(color("\nNo participants yet.", "yellow"));
    return;
  }

  console.log(color("\nParticipants", "cyan"));
  participants.forEach((participant, index) => {
    const groupLabel = participant.group_id ? groups.get(participant.group_id) ?? "unknown group" : "not matched";
    console.log(`${String(index + 1).padStart(2, " ")}. ${color(participantName(participant), "bold")}
    id: ${color(participant.id, "dim")}
    role: ${participant.profession_category ?? "other"} / ${participant.profession}
    age: ${participant.age}, experience: ${participant.years_experience}
    group: ${groupLabel}`);
  });
}

async function confirmReset() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(color("Delete the active formation and all groups/participants? Type DELETE to confirm: ", "yellow"));
    return answer.trim() === "DELETE";
  } finally {
    rl.close();
  }
}

async function confirmDeleteParticipants(participantIds) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(color(`Delete ${participantIds.length} participant(s)? Type DELETE to confirm: `, "yellow"));
    return answer.trim() === "DELETE";
  } finally {
    rl.close();
  }
}

async function main() {
  loadDotEnv();
  const { command, flags, jsonPayload } = parseArgs(process.argv.slice(2));

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const config = configFor(command);

  if (command === "status") {
    const data = await requestFunction(config, endpointPath.admin, { action: "status" });
    summarize(data, flags);
    return;
  }

  if (command === "participants") {
    const data = await requestFunction(config, endpointPath.admin, { action: "status" });
    printParticipants(data);
    return;
  }

  if (command === "create") {
    const payload = payloadFromCreateFlags(flags, jsonPayload);
    const data = await requestFunction(config, endpointPath.admin, { action: "create", ...payload });
    console.log(color("Created draft formation.", "green"));
    summarize(data, flags);
    return;
  }

  if (command === "seed") {
    const payload = payloadFromCreateFlags(flags, jsonPayload);
    const participants = seedParticipantsFromFlags(flags, jsonPayload);
    const seedState = seedStateFromFlags(flags, jsonPayload);
    const data = await requestFunction(config, endpointPath.admin, {
      action: "seed",
      ...payload,
      seed_state: seedState,
      participants,
    });
    console.log(color(
      seedState === "closed"
        ? `Seeded ${participants.length} participant(s), matched groups, and closed the formation.`
        : `Seeded ${participants.length} participant(s) and left the formation collecting.`,
      "green"
    ));
    summarize(data, flags);
    return;
  }

  if (["collect", "match", "close"].includes(command)) {
    const data = await requestFunction(config, endpointPath.admin, { action: command, ...jsonPayload });
    const labels = {
      collect: "Collecting participants.",
      match: "Matched groups and closed the group formation.",
      close: "Closed formation.",
    };
    console.log(color(labels[command], "green"));
    summarize(data, flags);
    return;
  }

  if (command === "clear-rate-limits") {
    const data = await requestFunction(config, endpointPath.admin, { action: "clear_rate_limits" });
    console.log(color(`Cleared ${data.cleared ?? 0} rate-limit rows.`, "green"));
    summarize(data, flags);
    return;
  }

  if (command === "delete-participants") {
    const participantIds = idsFromFlags(flags, jsonPayload);
    if (!participantIds.length) {
      const data = await requestFunction(config, endpointPath.admin, { action: "status" });
      printParticipants(data);
      throw new Error("Pass participant IDs with --ids id1,id2.");
    }

    const confirmed = flags.yes || await confirmDeleteParticipants(participantIds);
    if (!confirmed) {
      console.log(color("Delete cancelled.", "yellow"));
      return;
    }

    const data = await requestFunction(config, endpointPath.admin, {
      action: "delete_participants",
      participant_ids: participantIds,
    });
    console.log(color(`Deleted ${data.deleted?.length ?? 0} participant(s).`, "green"));
    for (const participant of data.deleted ?? []) {
      console.log(`  - ${participantName(participant)} ${color(participant.id, "dim")}`);
    }
    return;
  }

  if (command === "reset") {
    const confirmed = flags.yes || await confirmReset();
    if (!confirmed) {
      console.log(color("Reset cancelled.", "yellow"));
      return;
    }
    const data = await requestFunction(config, endpointPath.admin, {
      action: "reset",
      confirm: "DELETE_GROUP_FORMATION",
    });
    console.log(`${color("Deleted active formation.", "green")} ${color(data.deleted, "dim")}`);
    return;
  }

  throw new Error(`Unknown command: ${command}. Run: npm run group:admin -- help`);
}

main().catch((error) => {
  console.error(color(`Error: ${error.message}`, "red"));
  process.exit(1);
});
