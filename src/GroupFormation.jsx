import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lockPageScroll } from "./scrollLock.js";
import { callGroupFormation, getRealtimeClient, groupFormationRealtimeTopic, hasRealtimeConfig } from "./supabaseClient.js";

const tokenKey = "make-software-group-formation-token";
const participantIdKey = "make-software-group-formation-participant-id";
const activeFormationIdKey = "make-software-group-formation-active-id";
const participantIdsByFormationKey = "make-software-group-formation-participants-by-formation";
const codeKey = "make-software-group-formation-code";
const layoutKey = "make-software-group-formation-layout";
const bubbleColors = ["#fff36e", "#63a7ff", "#ff8a2a", "#9bea68", "#c9cfff", "#ffb3c9", "#bde6ff", "#ffd0a1"];
const minBoardZoom = 0.68;
const maxBoardZoom = 1.75;
const boardBounds = { minLeft: 7, maxLeft: 93, minTop: 8, maxTop: 92 };
const newParticipantBounds = { minLeft: 18, maxLeft: 76, minTop: 38, maxTop: 62 };
const bubbleGap = { x: 7.2, y: 8.8 };
const groupAnchorBounds = { minLeft: 13, maxLeft: 87, minTop: 14, maxTop: 86 };
const groupBoxGap = { x: 4.2, y: 5.2 };

function makeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readStorageItem(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (_) {
    return "";
  }
}

function writeStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // The page still works for the current tab if browser storage is unavailable.
  }
}

function removeStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {
    // Storage cleanup is best-effort.
  }
}

function getParticipantToken() {
  const existing = readStorageItem(tokenKey);
  if (existing) return existing;
  const token = makeToken();
  writeStorageItem(tokenKey, token);
  return token;
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left || 1;
}

function spreadStep(count) {
  let step = Math.max(1, Math.round(count * 0.618));
  while (greatestCommonDivisor(step, count) !== 1) step += 1;
  return step;
}

function readJsonStorage(key, fallback) {
  try {
    const value = readStorageItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    writeStorageItem(key, JSON.stringify(value));
  } catch (_) {
    // Local layout persistence is a convenience only.
  }
}

function queryRoomCode() {
  try {
    return normalizeRoomCode(new URLSearchParams(window.location.search).get("code"));
  } catch (_) {
    return "";
  }
}

function removeRoomCodeFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("code")) return;
    url.searchParams.delete("code");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch (_) {
    // Query cleanup is only a UX nicety.
  }
}

function rememberFormation(formationId, code) {
  if (!formationId) return;
  writeStorageItem(activeFormationIdKey, formationId);
  if (code) {
    writeStorageItem(codeKey, code);
  }
}

function rememberParticipant(formationId, participantId) {
  if (!formationId || !participantId) return;
  writeStorageItem(participantIdKey, participantId);
  const participantsByFormation = readJsonStorage(participantIdsByFormationKey, {});
  writeJsonStorage(participantIdsByFormationKey, { ...participantsByFormation, [formationId]: participantId });
}

function forgetParticipant(formationId) {
  if (!formationId) return;
  const participantsByFormation = readJsonStorage(participantIdsByFormationKey, {});
  if (!participantsByFormation[formationId]) return;
  const { [formationId]: _removed, ...next } = participantsByFormation;
  writeJsonStorage(participantIdsByFormationKey, next);
  if (readStorageItem(activeFormationIdKey) === formationId) {
    removeStorageItem(participantIdKey);
  }
}

function forgetCurrentFormation() {
  const activeFormationId = readStorageItem(activeFormationIdKey);
  if (activeFormationId) {
    forgetParticipant(activeFormationId);
  }
  removeStorageItem(codeKey);
  removeStorageItem(activeFormationIdKey);
  removeStorageItem(participantIdKey);
}

function initialParticipantId() {
  const activeFormationId = readStorageItem(activeFormationIdKey);
  const participantsByFormation = readJsonStorage(participantIdsByFormationKey, {});
  return (activeFormationId && participantsByFormation[activeFormationId]) || readStorageItem(participantIdKey);
}

function selfBubbleLabel(currentParticipant, canEditProfile, status) {
  if (canEditProfile) return currentParticipant ? "edit your profile" : "add yourself";
  if (status === "closed") return currentParticipant ? "profile locked" : "join existing group";
  if (status === "matching") return "matching now";
  return "waiting to collect";
}

function selfBubbleInitial(currentParticipant) {
  if (!currentParticipant) return "+";
  return String(currentParticipant.first_name || "?").trim().slice(0, 1);
}

function actionLabel(currentParticipant, status) {
  if (currentParticipant) return "Update Profile";
  if (status === "closed") return "Join Existing Group";
  return "Join";
}

const formationPhases = [
  {
    status: "draft",
    label: "Draft",
    detail: "The organizer is preparing the group formation. You can look around, but profiles are not open yet.",
    next: "Next: collecting",
  },
  {
    status: "collecting",
    label: "Collecting",
    detail: "People can add or edit their profile. Matching has not run yet.",
    next: "Next: matching",
  },
  {
    status: "matching",
    label: "Matching",
    detail: "The system is allocating groups for diversity and knowledge sharing.",
    next: "Next: closed",
  },
  {
    status: "closed",
    label: "Closed",
    detail: "Groups are ready. Profiles are locked so the allocation stays stable.",
    next: "Groups visible",
  },
];

function phaseForStatus(status) {
  return formationPhases.find((phase) => phase.status === status) ?? formationPhases[0];
}

function normalizeRoomCode(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 4);
}

function displayName(participant) {
  return `${participant.first_name} ${participant.last_name}`.trim();
}

function groupForParticipant(groups, participant) {
  return groups.find((group) => group.id === participant.group_id);
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seededUnit(value, salt) {
  return (hashText(`${value}:${salt}`) % 1000) / 1000;
}

function fallbackGroupAnchor(index, total) {
  if (total <= 1) return { left: 50, top: 50 };
  const columns = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / columns);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    left: columns === 1 ? 50 : 26 + (column * 48) / (columns - 1),
    top: rows === 1 ? 50 : 31 + (row * 38) / (rows - 1),
  };
}

function organicGroupAnchor(group, index, total) {
  const anchor = fallbackGroupAnchor(index, total);
  return {
    left: Math.max(16, Math.min(84, anchor.left + (seededUnit(group.id, "x") - 0.5) * 7.2)),
    top: Math.max(18, Math.min(82, anchor.top + (seededUnit(group.id, "y") - 0.5) * 6.2)),
  };
}

function clampBoardPosition(position, bounds = boardBounds) {
  return {
    left: clampValue(position.left, bounds.minLeft, bounds.maxLeft),
    top: clampValue(position.top, bounds.minTop, bounds.maxTop),
  };
}

function positionsCollide(a, b, gap = bubbleGap) {
  const dx = Math.abs(a.left - b.left) / gap.x;
  const dy = Math.abs(a.top - b.top) / gap.y;
  return Math.hypot(dx, dy) < 1;
}

function findOpenBoardPosition(seedBase, occupiedPositions, anchor = null, bounds = boardBounds) {
  const base = anchor
    ? clampBoardPosition(anchor)
    : {
      left: bounds.minLeft + seededUnit(seedBase, "left") * (bounds.maxLeft - bounds.minLeft),
      top: bounds.minTop + seededUnit(seedBase, "top") * (bounds.maxTop - bounds.minTop),
    };

  if (!occupiedPositions.some((position) => positionsCollide(base, position))) {
    return base;
  }

  for (let attempt = 1; attempt <= 180; attempt += 1) {
    const angle = (seededUnit(seedBase, `angle:${attempt}`) * Math.PI * 2) + attempt * 2.399963;
    const radius = anchor ? Math.min(28, 5 + attempt * 0.42) : 4 + attempt * 0.36;
    const candidate = anchor
      ? clampBoardPosition({
        left: base.left + Math.cos(angle) * radius,
        top: base.top + Math.sin(angle) * radius * 1.12,
      })
      : clampBoardPosition({
        left: bounds.minLeft + seededUnit(seedBase, `scan-left:${attempt}`) * (bounds.maxLeft - bounds.minLeft),
        top: bounds.minTop + seededUnit(seedBase, `scan-top:${attempt}`) * (bounds.maxTop - bounds.minTop),
      }, bounds);

    if (!occupiedPositions.some((position) => positionsCollide(candidate, position))) {
      return candidate;
    }
  }

  return base;
}

function resolveBoardCollisions(participants, positions) {
  const next = { ...positions };
  const ordered = [...participants]
    .filter((participant) => next[participant.id])
    .sort((a, b) => {
      const groupCompare = String(a.group_id ?? "").localeCompare(String(b.group_id ?? ""));
      if (groupCompare) return groupCompare;
      return String(a.created_at ?? a.id).localeCompare(String(b.created_at ?? b.id));
    });

  if (ordered.length < 2) return next;

  for (let pass = 0; pass < 72; pass += 1) {
    let moved = false;

    for (let index = 0; index < ordered.length; index += 1) {
      const a = ordered[index];
      for (let otherIndex = index + 1; otherIndex < ordered.length; otherIndex += 1) {
        const b = ordered[otherIndex];
        const aPosition = next[a.id];
        const bPosition = next[b.id];
        const dx = (aPosition.left - bPosition.left) / bubbleGap.x;
        const dy = (aPosition.top - bPosition.top) / bubbleGap.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= 1) continue;

        let unitX = dx / distance;
        let unitY = dy / distance;
        if (!Number.isFinite(unitX) || !Number.isFinite(unitY)) {
          const angle = seededUnit(`${a.id}:${b.id}`, `collision:${pass}`) * Math.PI * 2;
          unitX = Math.cos(angle);
          unitY = Math.sin(angle);
          distance = 0;
        }

        const push = (1 - distance) * 0.58;
        next[a.id] = clampBoardPosition({
          left: aPosition.left + unitX * bubbleGap.x * push,
          top: aPosition.top + unitY * bubbleGap.y * push,
        });
        next[b.id] = clampBoardPosition({
          left: bPosition.left - unitX * bubbleGap.x * push,
          top: bPosition.top - unitY * bubbleGap.y * push,
        });
        moved = true;
      }
    }

    if (!moved) break;
  }

  return next;
}

function groupLayoutMetrics(memberCount) {
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(memberCount || 1))));
  const rows = Math.max(1, Math.ceil((memberCount || 1) / columns));
  const stepX = memberCount <= 1 ? 0 : 7.7;
  const stepY = memberCount <= 1 ? 0 : 9.4;
  return {
    columns,
    rows,
    stepX,
    stepY,
    width: Math.max(15.5, (columns - 1) * stepX + 8.8),
    height: Math.max(18.2, (rows - 1) * stepY + 14.8),
  };
}

function resolveGroupAnchors(groupLayouts) {
  const next = groupLayouts.map((layout) => ({
    ...layout,
    anchor: clampBoardPosition(layout.anchor, groupAnchorBounds),
  }));

  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;

    for (let index = 0; index < next.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < next.length; otherIndex += 1) {
        const left = next[index];
        const right = next[otherIndex];
        const dx = right.anchor.left - left.anchor.left;
        const dy = right.anchor.top - left.anchor.top;
        const minX = (left.metrics.width + right.metrics.width) / 2 + groupBoxGap.x;
        const minY = (left.metrics.height + right.metrics.height) / 2 + groupBoxGap.y;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const separateHorizontally = overlapX / minX < overlapY / minY;
        const fallbackDirection = seededUnit(`${left.group.id}:${right.group.id}`, `group-separate:${pass}`) < 0.5 ? -1 : 1;

        if (separateHorizontally) {
          const direction = dx === 0 ? fallbackDirection : Math.sign(dx);
          const push = overlapX / 2 + 0.45;
          left.anchor = clampBoardPosition({ left: left.anchor.left - direction * push, top: left.anchor.top }, groupAnchorBounds);
          right.anchor = clampBoardPosition({ left: right.anchor.left + direction * push, top: right.anchor.top }, groupAnchorBounds);
        } else {
          const direction = dy === 0 ? fallbackDirection : Math.sign(dy);
          const push = overlapY / 2 + 0.45;
          left.anchor = clampBoardPosition({ left: left.anchor.left, top: left.anchor.top - direction * push }, groupAnchorBounds);
          right.anchor = clampBoardPosition({ left: right.anchor.left, top: right.anchor.top + direction * push }, groupAnchorBounds);
        }

        moved = true;
      }
    }

    if (!moved) break;
  }

  return new Map(next.map((layout) => [layout.group.id, layout]));
}

function groupedBoardPositions(participants, groups, localPositions) {
  if (!groups.length) return resolveBoardCollisions(participants, localPositions);

  const next = { ...localPositions };
  const groupLayouts = groups.map((group, groupIndex) => {
    const members = participants
      .filter((participant) => participant.group_id === group.id)
      .sort((a, b) => (a.match_rank ?? 9999) - (b.match_rank ?? 9999) || String(a.created_at).localeCompare(String(b.created_at)));
    return {
      group,
      members,
      anchor: localPositions[`group:${group.id}`] ?? organicGroupAnchor(group, groupIndex, groups.length),
      metrics: groupLayoutMetrics(members.length),
    };
  });
  const resolvedGroups = resolveGroupAnchors(groupLayouts);

  for (const group of groups) {
    const layout = resolvedGroups.get(group.id);
    if (!layout) continue;
    const { anchor, members, metrics } = layout;
    const { columns, rows, stepX, stepY } = metrics;

    for (const [memberIndex, participant] of members.entries()) {
      const column = memberIndex % columns;
      const row = Math.floor(memberIndex / columns);
      const seed = hashText(`${group.id}-${participant.id}`);
      const jitterX = members.length <= 1 ? 0 : ((seed % 17) - 8) * 0.12;
      const jitterY = members.length <= 1 ? 0 : (((seed * 7) % 17) - 8) * 0.11;
      next[participant.id] = {
        left: Math.max(8, Math.min(92, anchor.left + (column - (columns - 1) / 2) * stepX + jitterX)),
        top: Math.max(10, Math.min(90, anchor.top + (row - (rows - 1) / 2) * stepY + jitterY)),
      };
    }
  }

  return resolveBoardCollisions(participants, next);
}

function formFromParticipant(participant) {
  if (!participant) return { first_name: "", last_name: "", age: "", years_experience: "", profession: "" };
  return {
    first_name: participant.first_name ?? "",
    last_name: participant.last_name ?? "",
    age: participant.age == null ? "" : String(participant.age),
    years_experience: participant.years_experience == null ? "" : String(participant.years_experience),
    profession: participant.profession ?? "",
  };
}

function validateParticipantForm(form) {
  const firstName = String(form.first_name ?? "").trim();
  const lastName = String(form.last_name ?? "").trim();
  const profession = String(form.profession ?? "").trim();
  const age = Number(form.age);
  const yearsExperience = Number(form.years_experience);

  if (!firstName || !lastName || !profession || String(form.age ?? "").trim() === "" || String(form.years_experience ?? "").trim() === "") {
    return { valid: false, message: "Fill in first name, last name, age, years of experience, and profession." };
  }
  if (!Number.isInteger(age) || age < 13 || age > 120) {
    return { valid: false, message: "Age must be a whole number between 13 and 120." };
  }
  if (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80) {
    return { valid: false, message: "Years of experience must be a whole number between 0 and 80." };
  }
  if (profession.length < 2) {
    return { valid: false, message: "Profession needs at least two characters." };
  }

  return {
    valid: true,
    value: {
      first_name: firstName,
      last_name: lastName,
      age,
      years_experience: yearsExperience,
      profession,
    },
  };
}

function markdownSafe(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function groupMarkdown(formation, groups, participants) {
  const title = markdownSafe(formation?.title) || "Make Software Group Formation";
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const lines = [
    `# ${title}`,
    "",
    `Exported ${generatedAt}.`,
    "",
    "Groups are a suggested starting point for the group formation. Organizers and participants can still adjust them after the fact.",
    "",
  ];

  if (!groups.length) {
    lines.push("No groups have been formed yet.");
    return lines.join("\n");
  }

  for (const group of groups) {
    const members = participants.filter((participant) => participant.group_id === group.id);
    lines.push(`## ${markdownSafe(group.label) || `Group ${group.group_number}`}`);
    lines.push("");
    if (!members.length) {
      lines.push("- No assigned participants yet.");
    } else {
      for (const participant of members) {
        const name = markdownSafe(displayName(participant)) || "Unnamed participant";
        const profession = markdownSafe(participant.profession_category || participant.profession);
        lines.push(`- ${profession ? `${name} - ${profession}` : name}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function downloadMarkdownFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function bubbleColorForParticipant(participant) {
  const seed = participant.id || `${participant.first_name}:${participant.last_name}:${participant.created_at}`;
  return bubbleColors[hashText(seed) % bubbleColors.length];
}

function bubbleColorMapForParticipants(participants, formationId = "") {
  const colorMap = new Map();
  const colorStride = spreadStep(bubbleColors.length);
  const offset = hashText(formationId || participants[0]?.formation_id || "group-formation") % bubbleColors.length;
  const orderedParticipants = [...participants].sort((a, b) => (
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || String(a.id ?? "").localeCompare(String(b.id ?? ""))
  ));

  orderedParticipants.forEach((participant, index) => {
    if (!participant.id) return;
    colorMap.set(participant.id, bubbleColors[(offset + index * colorStride) % bubbleColors.length]);
  });

  return colorMap;
}

function GroupBubble({ participant, index, color, position, selected, owned, onSelect }) {
  const bubbleColor = color || bubbleColorForParticipant(participant);

  return (
    <motion.button
      type="button"
      className={`formation-bubble${selected ? " is-selected" : ""}${participant.group_id ? " is-grouped" : ""}${owned ? " is-owned" : ""}`}
      style={{ "--bubble-color": bubbleColor, "--bubble-delay": `${index * -0.37}s` }}
      layout
      initial={{ opacity: 0, scale: 0.42, y: 18, left: `${position.left}%`, top: `${position.top}%` }}
      animate={{ opacity: 1, scale: selected ? 1.08 : 1, y: 0, left: `${position.left}%`, top: `${position.top}%` }}
      exit={{ opacity: 0, scale: 0.62 }}
      transition={{ type: "spring", stiffness: 170, damping: 10.8, mass: 0.92 }}
      onClick={() => onSelect(participant.id)}
      aria-pressed={selected}
      data-participant-id={participant.id}
    >
      <span className="formation-bubble-shine" aria-hidden="true" />
      <strong>{displayName(participant)}</strong>
      {owned ? <em>you</em> : null}
    </motion.button>
  );
}

function GroupClusterAreas({ groups, participants, positions }) {
  return groups.map((group) => {
    const members = participants.filter((participant) => participant.group_id === group.id && positions[participant.id]);
    if (!members.length) return null;
    const xs = members.map((participant) => positions[participant.id].left);
    const ys = members.map((participant) => positions[participant.id].top);
    const minLeft = Math.max(2, Math.min(...xs) - 4.4);
    const minTop = Math.max(2, Math.min(...ys) - 7.6);
    const maxLeft = Math.min(98, Math.max(...xs) + 4.4);
    const maxTop = Math.min(97, Math.max(...ys) + 5.3);
    return (
      <motion.div
        key={group.id}
        className="formation-cluster-area"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{
          opacity: 1,
          scale: 1,
          left: `${minLeft}%`,
          top: `${minTop}%`,
          width: `${Math.max(15.5, maxLeft - minLeft)}%`,
          height: `${Math.max(18.2, maxTop - minTop)}%`,
        }}
        transition={{ type: "spring", stiffness: 142, damping: 13, mass: 0.95 }}
        aria-hidden="true"
      >
        <span>{group.label}</span>
      </motion.div>
    );
  });
}

function ParticipantDetails({ participant, groups }) {
  if (!participant) return null;
  return (
    <>
      <h2>{displayName(participant)}</h2>
      <dl>
        <div><dt>Age</dt><dd>{participant.age}</dd></div>
        <div><dt>Experience</dt><dd>{participant.years_experience} years</dd></div>
        <div><dt>Profession</dt><dd>{participant.profession}</dd></div>
        <div><dt>Group</dt><dd>{groupForParticipant(groups, participant)?.label ?? "not matched yet"}</dd></div>
      </dl>
    </>
  );
}

function FormationToast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.aside
          key={toast.id}
          className={`formation-toast is-${toast.type}`}
          initial={{ opacity: 0, y: 28, scale: 0.88, rotate: -1.4 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: 18, scale: 0.9, rotate: 1.2 }}
          transition={{ type: "spring", stiffness: 190, damping: 18, mass: 0.85 }}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
        >
          <span className="formation-toast-dot" aria-hidden="true" />
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.detail}</p>
          </div>
          <button className="formation-close-button" type="button" onClick={onClose} aria-label="Dismiss message" />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function PrivacyButton({ mode, onClick }) {
  return (
    <motion.div className={`formation-privacy-entry${mode ? ` is-${mode}` : ""}`} layout>
      <motion.button
        type="button"
        className="formation-privacy-button"
        layout
        initial={{ opacity: 0, y: 12, scale: 0.86 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={onClick}
      >
        Privacy note
      </motion.button>
    </motion.div>
  );
}

function FormationStatusChip({ status }) {
  const currentPhase = phaseForStatus(status);

  return (
    <div className={`formation-status-chip is-${currentPhase.status}`} tabIndex={0}>
      <span className="formation-status-dot" aria-hidden="true" />
      <span>{currentPhase.label}</span>
      <div className="formation-status-popover" role="tooltip">
        <strong>{currentPhase.label}</strong>
        <p>{currentPhase.detail}</p>
        <div className="formation-phase-list" aria-label="Group formation phases">
          {formationPhases.map((phase, index) => (
            <span
              key={phase.status}
              className={`formation-phase-chip is-${phase.status}${phase.status === currentPhase.status ? " is-current" : ""}`}
              style={{ "--phase-index": index }}
            >
              {phase.label}
            </span>
          ))}
        </div>
        <small>{currentPhase.next}</small>
      </div>
    </div>
  );
}

export default function GroupFormationView({ onNavigateHome }) {
  const queryFormationCode = queryRoomCode();
  const savedFormationCode = normalizeRoomCode(readStorageItem(codeKey));
  const initialFormationCode = queryFormationCode || savedFormationCode;
  const initialCodeInput = queryFormationCode || "";
  const shouldAutoEnterRoom = !queryFormationCode && savedFormationCode.length === 4;
  const [formation, setFormation] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(() => shouldAutoEnterRoom);
  const [toast, setToast] = useState(null);
  const [formationCode, setFormationCode] = useState(initialFormationCode);
  const [codeInput, setCodeInput] = useState(initialCodeInput);
  const [accessGranted, setAccessGranted] = useState(() => shouldAutoEnterRoom);
  const [sidebarTab, setSidebarTab] = useState("profile");
  const [form, setForm] = useState({ first_name: "", last_name: "", age: "", years_experience: "", profession: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState(initialParticipantId);
  const [participantToken, setParticipantToken] = useState("");
  const [localPositions, setLocalPositions] = useState(() => readJsonStorage(layoutKey, {}));
  const [realtimeStatus, setRealtimeStatus] = useState(hasRealtimeConfig() ? "connecting" : "fallback");
  const groupsRef = useRef([]);
  const stageRef = useRef(null);
  const boardPlaneRef = useRef(null);
  const zoomLabelRef = useRef(null);
  const zoomOutRef = useRef(null);
  const zoomInRef = useRef(null);
  const panRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const boardZoomRef = useRef(1);
  const toastIdRef = useRef(0);
  const realtimeNoticeShownRef = useRef(false);
  const snapshotInFlightRef = useRef(false);
  const snapshotQueuedRef = useRef(false);
  const pendingFocusParticipantIdRef = useRef("");
  const restoringStoredFormationRef = useRef(shouldAutoEnterRoom);

  const showToast = useCallback((type, title, detail) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, type, title, detail });
  }, []);

  useEffect(() => {
    setParticipantToken(getParticipantToken());
  }, []);

  useEffect(() => {
    const nextCode = queryRoomCode();
    if (!nextCode) return;
    setCodeInput(nextCode);
    if (!accessGranted) {
      setFormationCode(nextCode);
    }
  }, [accessGranted]);

  useEffect(() => {
    writeJsonStorage(layoutKey, localPositions);
  }, [localPositions]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), toast.type === "error" ? 8200 : 4800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!privacyOpen) return undefined;
    return lockPageScroll();
  }, [privacyOpen]);

  const ensureBoardPositions = useCallback((nextParticipants, nextGroups) => {
    setLocalPositions((current) => {
      const next = { ...current };
      let changed = false;

      for (const [groupIndex, group] of nextGroups.entries()) {
        const key = `group:${group.id}`;
        if (!next[key]) {
          next[key] = organicGroupAnchor(group, groupIndex, nextGroups.length);
          changed = true;
        }
      }

      for (const participant of nextParticipants) {
        // Positions are intentionally client-local. Realtime UPDATEs can change
        // profile details or group assignment, but an existing participant id
        // must keep the same local board position in this browser.
        if (next[participant.id]) continue;
        const groupPosition = participant.group_id ? next[`group:${participant.group_id}`] : null;
        const occupiedPositions = nextParticipants
          .filter((otherParticipant) => otherParticipant.id !== participant.id && next[otherParticipant.id])
          .map((otherParticipant) => next[otherParticipant.id]);
        next[participant.id] = findOpenBoardPosition(
          `${participant.id}:${participant.created_at ?? ""}`,
          occupiedPositions,
          groupPosition,
          groupPosition ? boardBounds : newParticipantBounds
        );
        changed = true;
      }

      return changed ? next : current;
    });
  }, []);

  const selectedParticipant = useMemo(
    () => participants.find((participant) => participant.id === selectedId) ?? null,
    [participants, selectedId]
  );

  const currentParticipant = useMemo(
    () => participants.find((participant) => participant.id === currentParticipantId) ?? null,
    [currentParticipantId, participants]
  );

  const boardPositions = useMemo(
    () => groupedBoardPositions(participants, groups, localPositions),
    [groups, localPositions, participants]
  );

  const bubbleColorMap = useMemo(
    () => bubbleColorMapForParticipants(participants, formation?.id),
    [formation?.id, participants]
  );

  const currentParticipantGroup = useMemo(
    () => (currentParticipant ? groupForParticipant(groups, currentParticipant) : null),
    [currentParticipant, groups]
  );

  const currentGroupMembers = useMemo(
    () => currentParticipantGroup
      ? participants
        .filter((participant) => participant.group_id === currentParticipantGroup.id)
        .sort((a, b) => (a.match_rank ?? 9999) - (b.match_rank ?? 9999) || String(a.created_at).localeCompare(String(b.created_at)))
      : [],
    [currentParticipantGroup, participants]
  );

  const canEditProfile = formation?.status === "collecting";
  const canLateJoinClosedFormation = formation?.status === "closed" && !currentParticipant;
  const canSubmitProfile = canEditProfile || canLateJoinClosedFormation;
  const canExportGroups = groups.length > 0;
  const canShowYourGroup = Boolean(groups.length && currentParticipantGroup);
  const showFormation = accessGranted && Boolean(formation?.id);

  const loadSnapshot = useCallback(async () => {
    if (snapshotInFlightRef.current) {
      snapshotQueuedRef.current = true;
      return;
    }
    snapshotInFlightRef.current = true;
    let cancelQueuedSnapshot = false;

    if (!formationCode || formationCode.length !== 4) {
      setLoading(false);
      snapshotInFlightRef.current = false;
      return;
    }

    try {
      const token = participantToken || getParticipantToken();
      const snapshot = await callGroupFormation(undefined, token, formationCode);
      const nextFormation = snapshot.formation;
      if (!nextFormation?.id) {
        throw new Error("This group formation code is invalid or no group formation is active.");
      }
      setFormation(nextFormation);
      const nextParticipants = snapshot.participants ?? [];
      const nextGroups = snapshot.groups ?? [];
      setParticipants(nextParticipants);
      setGroups(nextGroups);
      ensureBoardPositions(nextParticipants, nextGroups);
      if (nextFormation?.id) rememberFormation(nextFormation.id, formationCode);
      if (nextFormation?.id && snapshot.current_participant?.id) {
        rememberParticipant(nextFormation.id, snapshot.current_participant.id);
        setCurrentParticipantId(snapshot.current_participant.id);
      } else if (nextFormation?.id) {
        forgetParticipant(nextFormation.id);
        setCurrentParticipantId("");
      }
      setAccessGranted(true);
      restoringStoredFormationRef.current = false;
    } catch (error) {
      const wasRestoringStoredFormation = restoringStoredFormationRef.current;
      if (wasRestoringStoredFormation) {
        forgetCurrentFormation();
        setFormationCode(queryRoomCode() || "");
        setCodeInput(queryRoomCode() || "");
        setCurrentParticipantId("");
        snapshotQueuedRef.current = false;
        cancelQueuedSnapshot = true;
      }
      restoringStoredFormationRef.current = false;
      setAccessGranted(false);
      setFormation(null);
      setParticipants([]);
      setGroups([]);
      showToast(
        "error",
        wasRestoringStoredFormation ? "Saved group formation expired" : "Could not load group formation",
        wasRestoringStoredFormation
          ? "That saved meetup code no longer works. Enter a current group formation code to join."
          : error instanceof Error ? error.message : "Could not load group formation."
      );
    } finally {
      setLoading(false);
      snapshotInFlightRef.current = false;
      if (snapshotQueuedRef.current && !cancelQueuedSnapshot) {
        snapshotQueuedRef.current = false;
        window.setTimeout(loadSnapshot, 0);
      }
    }
  }, [ensureBoardPositions, formationCode, participantToken, showToast]);

  useEffect(() => {
    if (!currentParticipant) return;
    setForm((current) => {
      if (formOpen) return current;
      return formFromParticipant(currentParticipant);
    });
  }, [currentParticipant, formOpen]);

  useEffect(() => {
    if (sidebarTab === "group" && !canShowYourGroup) {
      setSidebarTab("profile");
    }
  }, [canShowYourGroup, sidebarTab]);

  useEffect(() => {
    if (!accessGranted || !formationCode) return undefined;
    loadSnapshot();
    const timer = window.setInterval(loadSnapshot, 30000);
    return () => {
      window.clearInterval(timer);
    };
  }, [accessGranted, formationCode, loadSnapshot]);

  useEffect(() => {
    if (!accessGranted || !formation?.id) return undefined;

    const realtime = getRealtimeClient();
    if (!realtime) {
      setRealtimeStatus("fallback");
      if (!realtimeNoticeShownRef.current) {
        realtimeNoticeShownRef.current = true;
        showToast(
          "error",
          "Realtime is not configured",
          "Set VITE_SUPABASE_PUBLISHABLE_KEY so this page can receive live group formation updates. A slower safety refresh is active."
        );
      }
      return undefined;
    }

    const channel = realtime
      .channel(groupFormationRealtimeTopic(formation.id), { config: { private: false } })
      .on("broadcast", { event: "changed" }, (message) => {
        if (message.payload?.formation_id !== formation.id) return;
        loadSnapshot();
      })
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("fallback");
          showToast(
            "error",
            "Realtime sync paused",
            error?.message ? `Live updates paused: ${error.message}` : "Live updates paused. A slower safety refresh is active."
          );
        }
        if (status === "CLOSED") setRealtimeStatus("fallback");
      });

    setRealtimeStatus("connecting");
    return () => {
      realtime.removeChannel(channel);
    };
  }, [accessGranted, formation?.id, loadSnapshot, showToast]);

  const submitCode = async (event) => {
    event.preventDefault();
    restoringStoredFormationRef.current = false;
    const nextCode = normalizeRoomCode(codeInput);
    setToast(null);
    if (nextCode.length !== 4) {
      showToast("error", "Code needed", "Enter the four-character group formation code from the organizer.");
      return;
    }
    setFormationCode(nextCode);
    setCodeInput(nextCode);
    setLoading(true);
    try {
      const token = participantToken || getParticipantToken();
      const snapshot = await callGroupFormation(undefined, token, nextCode);
      const nextFormation = snapshot.formation;
      if (!nextFormation?.id) {
        throw new Error("This group formation code is invalid or no group formation is active.");
      }
      setFormation(nextFormation);
      const nextParticipants = snapshot.participants ?? [];
      const nextGroups = snapshot.groups ?? [];
      setParticipants(nextParticipants);
      setGroups(nextGroups);
      ensureBoardPositions(nextParticipants, nextGroups);
      if (nextFormation?.id) rememberFormation(nextFormation.id, nextCode);
      if (nextFormation?.id && snapshot.current_participant?.id) {
        rememberParticipant(nextFormation.id, snapshot.current_participant.id);
        setCurrentParticipantId(snapshot.current_participant.id);
      } else if (nextFormation?.id) {
        forgetParticipant(nextFormation.id);
        setCurrentParticipantId("");
      }
      setAccessGranted(true);
      removeRoomCodeFromUrl();
    } catch (error) {
      setAccessGranted(false);
      setFormation(null);
      setParticipants([]);
      setGroups([]);
      showToast("error", "Group formation code did not work", error instanceof Error ? error.message : "That group formation code did not work.");
    } finally {
      setLoading(false);
    }
  };

  const submitParticipant = async (event) => {
    event.preventDefault();
    setToast(null);
    if (!canSubmitProfile) {
      showToast(
        "error",
        currentParticipant ? "Profile edits are closed" : "Group formation is not collecting",
        currentParticipant
          ? "Your group is visible, but profile changes are locked after groups are closed."
          : "This group formation is not accepting participant details right now."
      );
      return;
    }

    const validation = validateParticipantForm(form);
    if (!validation.valid) {
      showToast("error", "Profile details needed", validation.message);
      return;
    }

    try {
      const payload = {
        ...validation.value,
        participant_token: participantToken || getParticipantToken(),
      };
      const response = await callGroupFormation(payload, payload.participant_token, formationCode);
      setFormation(response.formation);
      setParticipants((current) => {
        const next = current.filter((participant) => participant.id !== response.participant.id);
        const updated = [...next, response.participant].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        ensureBoardPositions(updated, groupsRef.current);
        return updated;
      });
      setCurrentParticipantId(response.participant.id);
      rememberParticipant(response.formation?.id, response.participant.id);
      setSelectedId(response.participant.id);
      setFormOpen(false);
      pendingFocusParticipantIdRef.current = response.participant.id;
      showToast(
        "success",
        currentParticipant ? "Profile updated" : "You are in",
        currentParticipant
          ? "Your details were saved."
          : formation?.status === "closed"
            ? "You were added to the best existing group."
            : "You are on the board."
      );
    } catch (error) {
      showToast("error", "Could not save profile", error instanceof Error ? error.message : "Could not join.");
    }
  };

  const exportGroups = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadMarkdownFile(`make-software-groups-${date}.md`, groupMarkdown(formation, groups, participants));
  };

  const enterGroupFormationCode = () => {
    setAccessGranted(false);
    setFormation(null);
    setFormationCode("");
    setCodeInput("");
    setParticipants([]);
    setGroups([]);
    setSelectedId(null);
    setCurrentParticipantId("");
    setForm(formFromParticipant(null));
    setFormOpen(false);
    setToast(null);
    restoringStoredFormationRef.current = false;
    forgetCurrentFormation();
    removeRoomCodeFromUrl();
  };

  const selectParticipant = useCallback((participantId) => {
    setSelectedId((current) => (current === participantId ? null : participantId));
  }, []);

  const applyBoardZoom = useCallback((nextZoom) => {
    const zoom = Number(clampValue(nextZoom, minBoardZoom, maxBoardZoom).toFixed(4));
    boardZoomRef.current = zoom;
    boardPlaneRef.current?.style.setProperty("--board-zoom", String(zoom));
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(zoom * 100)}%`;
    if (zoomOutRef.current) zoomOutRef.current.disabled = zoom <= minBoardZoom + 0.01;
    if (zoomInRef.current) zoomInRef.current.disabled = zoom >= maxBoardZoom - 0.01;
    return zoom;
  }, []);

  const setZoomAroundPoint = useCallback((nextZoom, point) => {
    const stage = stageRef.current;
    const currentZoom = boardZoomRef.current;
    const zoom = clampValue(nextZoom, minBoardZoom, maxBoardZoom);
    if (Math.abs(zoom - currentZoom) < 0.001) return;
    if (!stage) {
      applyBoardZoom(zoom);
      return;
    }

    const rect = stage.getBoundingClientRect();
    const localX = point ? point.x - rect.left : rect.width / 2;
    const localY = point ? point.y - rect.top : rect.height / 2;
    const contentX = (stage.scrollLeft + localX) / currentZoom;
    const contentY = (stage.scrollTop + localY) / currentZoom;

    const appliedZoom = applyBoardZoom(zoom);
    stage.scrollLeft = contentX * appliedZoom - localX;
    stage.scrollTop = contentY * appliedZoom - localY;
  }, [applyBoardZoom]);

  useEffect(() => {
    if (!showFormation) return;
    window.requestAnimationFrame(() => applyBoardZoom(boardZoomRef.current));
  }, [applyBoardZoom, showFormation]);

  const zoomBoardBy = useCallback((delta) => {
    setZoomAroundPoint(boardZoomRef.current + delta);
  }, [setZoomAroundPoint]);

  const resetBoardGesture = useCallback((stage) => {
    panRef.current = null;
    pinchRef.current = null;
    activePointersRef.current.clear();
    stage?.classList.remove("is-panning");
  }, []);

  const centerParticipantOnBoard = useCallback((participantId) => {
    const stage = stageRef.current;
    if (!stage || !participantId) return;

    const focus = () => {
      const bubble = Array.from(stage.querySelectorAll(".formation-bubble"))
        .find((node) => node instanceof HTMLElement && node.dataset.participantId === participantId);
      if (!(bubble instanceof HTMLElement)) return;

      const stageRect = stage.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const bubbleCenterX = bubbleRect.left + bubbleRect.width / 2;
      const bubbleCenterY = bubbleRect.top + bubbleRect.height / 2;
      const stageCenterX = stageRect.left + stageRect.width / 2;
      const stageCenterY = stageRect.top + stageRect.height / 2;

      stage.scrollTo({
        left: stage.scrollLeft + bubbleCenterX - stageCenterX,
        top: stage.scrollTop + bubbleCenterY - stageCenterY,
        behavior: "smooth",
      });
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(focus));
    window.setTimeout(focus, 420);
  }, []);

  useEffect(() => {
    const participantId = pendingFocusParticipantIdRef.current;
    if (!participantId || !boardPositions[participantId]) return;
    pendingFocusParticipantIdRef.current = "";
    centerParticipantOnBoard(participantId);
  }, [boardPositions, centerParticipantOnBoard]);

  const clearSelectionFromBackground = useCallback((event) => {
    if (!selectedId) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".formation-bubble")) return;
    if (target.closest(".formation-zoom-controls")) return;
    if (target.closest("button, input, textarea, select, a")) return;
    setSelectedId(null);
  }, [selectedId]);

  const startBoardPan = useCallback((event) => {
    const stage = stageRef.current;
    if (!stage) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".formation-zoom-controls")) return;
    const interactiveTarget = target.closest("button, input, textarea, select, a");

    if (event.pointerType === "touch") {
      if (interactiveTarget) return;
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stage.setPointerCapture?.(event.pointerId);

      if (activePointersRef.current.size === 2) {
        const pointers = Array.from(activePointersRef.current.values());
        pinchRef.current = {
          distance: Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y),
          zoom: boardZoomRef.current,
        };
        panRef.current = null;
        stage.classList.add("is-panning");
        event.preventDefault();
        return;
      }
    }

    if (event.button !== 0) return;
    if (interactiveTarget) return;
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: stage.scrollLeft,
      top: stage.scrollTop,
    };
    stage.setPointerCapture?.(event.pointerId);
    stage.classList.add("is-panning");
    event.preventDefault();
  }, []);

  const moveBoardPan = useCallback((event) => {
    const stage = stageRef.current;
    if (event.pointerType === "touch" && activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchRef.current;
      if (pinch && activePointersRef.current.size >= 2) {
        const pointers = Array.from(activePointersRef.current.values()).slice(0, 2);
        const distance = Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
        const midpoint = {
          x: (pointers[0].x + pointers[1].x) / 2,
          y: (pointers[0].y + pointers[1].y) / 2,
        };
        if (pinch.distance > 0) {
          setZoomAroundPoint(pinch.zoom * (distance / pinch.distance), midpoint);
        }
        event.preventDefault();
        return;
      }
    }

    const pan = panRef.current;
    if (!pan || !stage || pan.pointerId !== event.pointerId) return;
    stage.scrollLeft = pan.left - (event.clientX - pan.x);
    stage.scrollTop = pan.top - (event.clientY - pan.y);
  }, [setZoomAroundPoint]);

  const stopBoardPan = useCallback((event) => {
    const pan = panRef.current;
    const stage = stageRef.current;
    if (!stage) return;

    if (event.pointerType === "touch") {
      activePointersRef.current.delete(event.pointerId);
      stage.releasePointerCapture?.(event.pointerId);
      if (activePointersRef.current.size < 2) {
        pinchRef.current = null;
      }
      if (!pan || pan.pointerId === event.pointerId) {
        panRef.current = null;
        stage.classList.remove("is-panning");
      }
      return;
    }

    if (!pan || pan.pointerId !== event.pointerId) return;
    stage.releasePointerCapture?.(event.pointerId);
    stage.classList.remove("is-panning");
    panRef.current = null;
  }, []);

  useEffect(() => {
    if (!showFormation) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;

    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const nextZoom = boardZoomRef.current * (event.deltaY > 0 ? 0.92 : 1.08);
      setZoomAroundPoint(nextZoom, { x: event.clientX, y: event.clientY });
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      resetBoardGesture(stage);
    };
  }, [resetBoardGesture, setZoomAroundPoint, showFormation]);

  return (
    <main className="formation-page">
      {!showFormation ? (
        <section className="formation-code-gate" aria-labelledby="formation-code-title">
          <button className="formation-home-button" type="button" onClick={onNavigateHome}>Make Software</button>
          <motion.form
            className="formation-code-card"
            onSubmit={submitCode}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            <span className="formation-kicker">Group Formation Code</span>
            <h1 id="formation-code-title">Enter the group formation code</h1>
            <input
              value={codeInput}
              onChange={(event) => setCodeInput(normalizeRoomCode(event.target.value))}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              maxLength={4}
            />
            <button type="submit" disabled={loading}>{loading ? "Checking" : "Enter Group Formation"}</button>
          </motion.form>
          <PrivacyButton mode="code-gate" onClick={() => setPrivacyOpen(true)} />
        </section>
      ) : null}
      {showFormation ? (
      <>
      <section className="formation-shell" aria-labelledby="formation-title">
        <div className="formation-topbar">
          <button className="formation-home-button" type="button" onClick={onNavigateHome}>Make Software</button>
          <div className="formation-room-actions">
            <FormationStatusChip status={formation?.status} />
            <span className={`formation-live-pill is-${realtimeStatus}`}>{realtimeStatus === "connected" ? "live realtime" : realtimeStatus === "connecting" ? "syncing" : "refresh backup"}</span>
            <span className="formation-live-pill">code {formationCode}</span>
            <button className="formation-home-button" type="button" onClick={enterGroupFormationCode}>Enter group formation code</button>
          </div>
        </div>

        <div className="formation-live-area" onClickCapture={clearSelectionFromBackground}>
          <div
            ref={stageRef}
            className="formation-stage"
            aria-label="Live participants"
            onPointerDown={startBoardPan}
            onPointerMove={moveBoardPan}
            onPointerUp={stopBoardPan}
            onPointerCancel={stopBoardPan}
          >
            <div className="formation-zoom-controls" aria-label="Board zoom controls">
              <button ref={zoomOutRef} type="button" onClick={() => zoomBoardBy(-0.12)} aria-label="Zoom out">-</button>
              <span ref={zoomLabelRef}>100%</span>
              <button ref={zoomInRef} type="button" onClick={() => zoomBoardBy(0.12)} aria-label="Zoom in">+</button>
            </div>
            <div ref={boardPlaneRef} className="formation-board-plane">
              <div className="formation-board-content">
                <GroupClusterAreas groups={groups} participants={participants} positions={boardPositions} />
                <AnimatePresence>
                  {participants.map((participant, index) => (
                    <GroupBubble
                      key={participant.id}
                      participant={participant}
                      index={index}
                      color={bubbleColorMap.get(participant.id)}
                      position={boardPositions[participant.id] ?? { left: 50, top: 50 }}
                      selected={selectedParticipant?.id === participant.id}
                      owned={participant.id === currentParticipantId}
                      onSelect={selectParticipant}
                    />
                  ))}
                </AnimatePresence>
                {!participants.length ? <div className="formation-empty">people will appear here</div> : null}
              </div>
            </div>
          </div>

          <aside className="formation-inspector">
            {selectedParticipant ? (
              <>
                <span className="formation-kicker">Selected</span>
                <ParticipantDetails participant={selectedParticipant} groups={groups} />
              </>
            ) : (
              <>
                <div className="formation-sidebar-tabs" role="tablist" aria-label="Your group formation details">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sidebarTab === "profile"}
                    className={sidebarTab === "profile" ? "is-active" : ""}
                    onClick={() => setSidebarTab("profile")}
                  >
                    Your profile
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sidebarTab === "group"}
                    className={sidebarTab === "group" ? "is-active" : ""}
                    onClick={() => setSidebarTab("group")}
                    disabled={!canShowYourGroup}
                  >
                    Your group
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {sidebarTab === "group" && canShowYourGroup ? (
                    <motion.div
                      key="your-group"
                      className="formation-sidebar-panel"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <span className="formation-kicker">{currentParticipantGroup.label}</span>
                      <h2>Your group</h2>
                      <ul className="formation-group-roster">
                        {currentGroupMembers.map((participant) => (
                          <li key={participant.id}>
                            <strong>{displayName(participant)}</strong>
                            {participant.id === currentParticipantId ? <span>you</span> : null}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="your-profile"
                      className="formation-sidebar-panel"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      {currentParticipant ? (
                        <>
                          <span className="formation-kicker">Your profile</span>
                          <ParticipantDetails participant={currentParticipant} groups={groups} />
                        </>
                      ) : (
                        <>
                          <span className="formation-kicker">Your profile</span>
                          <h2>Not in yet</h2>
                          <p>
                            {canEditProfile
                              ? "Add yourself from the button below, then your details and group will show here."
                              : formation?.status === "closed"
                                ? "Groups are ready. Join from the button below and the system will place you into an existing group."
                                : "Profiles are only open while the group formation is collecting."}
                          </p>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            <div className="formation-inspector-actions">
              <button type="button" className="formation-export-button" onClick={exportGroups} disabled={!canExportGroups}>
                Export groups
              </button>
              <p>{canExportGroups ? "Downloads a Markdown roster with names and broad roles." : "Exports unlock once groups exist."}</p>
            </div>
          </aside>
        </div>
      </section>
      <PrivacyButton mode="floating" onClick={() => setPrivacyOpen(true)} />
      </>
      ) : null}
      <AnimatePresence>
        {privacyOpen ? (
          <motion.div
            className="formation-privacy-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button className="formation-privacy-backdrop" type="button" onClick={() => setPrivacyOpen(false)} aria-label="Close privacy note" />
            <motion.section
              key="privacy-panel"
              className="formation-privacy-panel"
              initial={{ opacity: 0, y: 22, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 170, damping: 18, mass: 0.8 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="formation-privacy-title"
            >
              <div className="formation-privacy-heading">
                <span className="formation-kicker">Privacy</span>
                <button className="formation-close-button" type="button" onClick={() => setPrivacyOpen(false)} aria-label="Close privacy note" />
              </div>
              <h2 id="formation-privacy-title">A small note on your data</h2>
              <p>
                While the meetup is running, the details you add here can be seen by anyone with the group formation code.
                This tool uses Supabase to save them for the session.
              </p>
              <p>
                Your details are kept only for the meetup and only while they are needed for the groups. When the groups are no
                longer needed, the details will be deleted. After that, this tool does not keep a copy and the data cannot be
                recovered.
              </p>
              <p>
                If you want more privacy, use an alias or a name that people in the session can still recognize.
              </p>
              <p>
                Age, experience, and profession details help make better group suggestions. The groups are suggestions, not fixed
                assignments.
              </p>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {showFormation ? (
      <motion.div className={`formation-self-dock${formOpen ? " is-open" : ""}`} layout>
        <AnimatePresence mode="popLayout">
          {formOpen ? (
            <motion.form
              key="profile-form"
              className="formation-profile-form"
              onSubmit={submitParticipant}
              layout
              initial={{ opacity: 0, y: 22, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.9 }}
            >
              <div className="formation-profile-heading">
                <span className="formation-kicker">{currentParticipant ? "Edit Profile" : formation?.status === "closed" ? "Join Existing Group" : "Join Formation"}</span>
                <button className="formation-close-button" type="button" onClick={() => setFormOpen(false)} aria-label="Close profile form" />
              </div>
              <input value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} placeholder="First name" autoComplete="given-name" disabled={!canSubmitProfile} required maxLength={80} />
              <input value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} placeholder="Last name" autoComplete="family-name" disabled={!canSubmitProfile} required maxLength={80} />
              <input value={form.age} onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))} placeholder="Age" type="number" inputMode="numeric" min="13" max="120" step="1" disabled={!canSubmitProfile} required />
              <input value={form.years_experience} onChange={(event) => setForm((current) => ({ ...current, years_experience: event.target.value }))} placeholder="Years experience" type="number" inputMode="numeric" min="0" max="80" step="1" disabled={!canSubmitProfile} required />
              <input value={form.profession} onChange={(event) => setForm((current) => ({ ...current, profession: event.target.value }))} placeholder="Profession" autoComplete="organization-title" disabled={!canSubmitProfile} required minLength={2} maxLength={120} />
              <button type="submit" disabled={!canSubmitProfile}>{actionLabel(currentParticipant, formation?.status)}</button>
            </motion.form>
          ) : (
            <motion.button
              key="profile-bubble"
              type="button"
              className={`formation-self-bubble${currentParticipant ? " has-profile" : ""}`}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.82 }}
              onClick={() => {
                if (currentParticipant) setForm(formFromParticipant(currentParticipant));
                setFormOpen(true);
              }}
              disabled={!canSubmitProfile}
            >
              <span>{selfBubbleInitial(currentParticipant)}</span>
              <strong>{selfBubbleLabel(currentParticipant, canEditProfile, formation?.status)}</strong>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      ) : null}
      <FormationToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
