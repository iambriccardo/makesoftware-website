const categoryKeywords = [
  ["frontend", [
    "frontend", "front end", "front-end", "react", "vue", "svelte", "web",
    "javascript", "typescript", "interface", "ui engineer",
  ]],
  ["backend", [
    "backend", "back end", "back-end", "api", "server", "platform", "infra",
    "infrastructure", "devops", "cloud", "database", "data engineer",
    "systems", "fullstack", "full stack", "mobile", "ios", "android",
    "game", "gameplay", "unity", "unreal", "qa", "quality assurance",
    "testing", "test automation", "security", "cybersecurity", "sre",
    "site reliability", "embedded", "robotics", "hardware", "firmware",
  ]],
  ["design", [
    "design", "designer", "ux", "ui", "brand", "branding", "visual",
    "product design", "user research", "figma", "interaction", "service design",
    "graphic", "motion design", "industrial design", "architecture",
  ]],
  ["research", [
    "data scientist", "scientist", "ml", "ai", "machine learning",
    "research", "researcher", "analytics", "analyst", "math", "mathematics",
    "statistics", "statistician", "physics", "biology", "bioinformatics",
    "chemistry", "computational", "economics", "psychology", "cognitive science",
    "phd", "doctorate", "doctoral",
  ]],
  ["business", [
    "founder", "ceo", "cofounder", "co-founder", "business", "sales",
    "marketing", "growth", "ops", "operator", "product manager", "pm",
    "strategy", "entrepreneur", "venture", "investor", "finance", "accounting",
    "operations", "partnerships", "customer success", "recruiting", "hr",
  ]],
  ["creative", [
    "artist", "music", "musician", "writer", "film", "creative",
    "illustrator", "illustration", "photo", "photographer", "content",
    "storytelling", "journalist", "editor", "copywriter", "podcast",
    "video", "animation", "3d", "sound", "producer", "performer",
  ]],
  ["learner", [
    "student", "learn", "learner", "junior", "beginner", "school",
    "university", "bootcamp", "college", "undergraduate", "graduate",
    "masters", "master", "msc", "bsc", "ba", "ma", "intern", "internship",
    "apprentice", "self taught", "self-taught", "career switcher",
    "high school", "pupil", "studying", "course", "class",
  ]],
  ["community", [
    "teacher", "educator", "mentor", "coach", "facilitator", "community",
    "organizer", "nonprofit", "ngo", "public sector", "policy", "social",
    "event", "events", "program manager", "program coordinator",
  ]],
];

const keywordAliases = new Map([
  ["front end", "frontend"],
  ["front-end", "frontend"],
  ["back end", "backend"],
  ["back-end", "backend"],
  ["full stack", "fullstack"],
  ["co-founder", "cofounder"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["quality assurance", "qa"],
  ["site reliability", "sre"],
  ["self taught", "selftaught"],
  ["self-taught", "selftaught"],
  ["career switcher", "careerswitcher"],
  ["high school", "highschool"],
  ["computer science", "cs"],
  ["data science", "datascience"],
  ["product management", "product manager"],
  ["programme manager", "program manager"],
  ["program management", "program manager"],
]);

const stopWords = new Set([
  "a", "an", "and", "at", "consultant", "developer", "engineer", "for",
  "freelance", "head", "lead", "manager", "of", "principal", "senior",
  "software", "staff", "the",
]);

let normalizedCategoryKeywords;
const professionKeywordCache = new Map();
const professionCategoryCache = new Map();

export function normalizeProfession(value) {
  let normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[._/\\,;:|()[\]{}<>]+/g, " ")
    .replace(/[-–—]+/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const [from, to] of keywordAliases.entries()) {
    normalized = normalized.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }

  return normalized;
}

function includesKeyword(normalizedProfession, normalizedKeyword) {
  if (!normalizedKeyword) return false;
  return new RegExp(`(^|\\s)${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(normalizedProfession);
}

function getNormalizedCategoryKeywords() {
  if (!normalizedCategoryKeywords) {
    normalizedCategoryKeywords = categoryKeywords.map(([category, keywords]) => [
      category,
      keywords.map((keyword) => normalizeProfession(keyword)),
    ]);
  }
  return normalizedCategoryKeywords;
}

function professionWords(profession) {
  return normalizeProfession(profession)
    .split(" ")
    .filter((word) => word && !stopWords.has(word));
}

export function professionKeywords(profession) {
  const normalized = normalizeProfession(profession);
  if (professionKeywordCache.has(normalized)) return professionKeywordCache.get(normalized);
  const words = professionWords(normalized);
  const found = new Set(words);

  for (const [, keywords] of getNormalizedCategoryKeywords()) {
    for (const normalizedKeyword of keywords) {
      if (includesKeyword(normalized, normalizedKeyword)) found.add(normalizedKeyword);
    }
  }

  const result = Array.from(found).sort();
  professionKeywordCache.set(normalized, result);
  return result;
}

export function professionCategory(profession) {
  const normalized = normalizeProfession(profession);
  if (professionCategoryCache.has(normalized)) return professionCategoryCache.get(normalized);
  for (const [category, keywords] of getNormalizedCategoryKeywords()) {
    if (keywords.some((keyword) => includesKeyword(normalized, keyword))) {
      professionCategoryCache.set(normalized, category);
      return category;
    }
  }
  professionCategoryCache.set(normalized, "other");
  return "other";
}

function ageBand(age) {
  if (age < 24) return "under-24";
  if (age < 31) return "24-30";
  if (age < 41) return "31-40";
  if (age < 56) return "41-55";
  return "56-plus";
}

function experienceBand(years) {
  if (years < 1) return "new";
  if (years < 3) return "1-2";
  if (years < 6) return "3-5";
  if (years < 11) return "6-10";
  return "11-plus";
}

function participantCategory(participant) {
  return participant.profession_category || professionCategory(participant.profession);
}

function participantDiscipline(participant) {
  const category = participantCategory(participant);
  if (category === "frontend" || category === "backend") return "engineering";
  return category;
}

function foundationRole(participant) {
  const discipline = participantDiscipline(participant);
  if (discipline === "engineering" || discipline === "design") return discipline;
  return null;
}

function participantKeywords(participant) {
  return professionKeywords(participant.profession);
}

function sharedKeywordCount(group, candidate) {
  const candidateKeywords = new Set(participantKeywords(candidate));
  return group.reduce((count, participant) => {
    const matches = participantKeywords(participant).filter((keyword) => candidateKeywords.has(keyword)).length;
    return count + matches;
  }, 0);
}

function participantRarityScore(participant, all) {
  const category = participantCategory(participant);
  const categoryCount = all.filter((item) => participantCategory(item) === category).length;
  const ageCount = all.filter((item) => ageBand(item.age) === ageBand(participant.age)).length;
  const experienceCount = all.filter((item) => experienceBand(item.years_experience) === experienceBand(participant.years_experience)).length;
  return categoryCount * 10 + ageCount + experienceCount;
}

function incrementalScore(group, candidate) {
  if (group.length === 0) return 0;

  const candidateCategory = participantCategory(candidate);
  const candidateDiscipline = participantDiscipline(candidate);
  const candidateFoundationRole = foundationRole(candidate);
  const sameCategory = group.filter((item) => participantCategory(item) === candidateCategory).length;
  const sameDiscipline = group.filter((item) => participantDiscipline(item) === candidateDiscipline).length;
  const sameFoundationRole = candidateFoundationRole
    ? group.filter((item) => foundationRole(item) === candidateFoundationRole).length
    : 0;
  const hasFoundationRole = group.some((item) => foundationRole(item));
  const sameAgeBand = group.filter((item) => ageBand(item.age) === ageBand(candidate.age)).length;
  const sameExperienceBand = group.filter((item) => experienceBand(item.years_experience) === experienceBand(candidate.years_experience)).length;
  const keywordOverlap = sharedKeywordCount(group, candidate);
  const ages = group.map((item) => item.age);
  const averageAge = ages.reduce((sum, value) => sum + value, 0) / ages.length;
  const ageDistance = Math.min(28, Math.abs(candidate.age - averageAge)) / 28;
  const years = group.map((item) => item.years_experience);
  const averageYears = years.reduce((sum, value) => sum + value, 0) / years.length;
  const experienceDistance = Math.min(18, Math.abs(candidate.years_experience - averageYears)) / 18;
  const categorySpread = new Set(group.map(participantCategory).concat(candidateCategory)).size;
  const disciplineSpread = new Set(group.map(participantDiscipline).concat(candidateDiscipline)).size;

  return (
    ageDistance * 3.5
    + experienceDistance * 2.8
    + categorySpread * 1.4
    + disciplineSpread * 1.9
    + (candidateFoundationRole && !hasFoundationRole ? 4.5 : 0)
    - sameCategory * 8
    - sameDiscipline * 5.2
    - sameFoundationRole * 7.5
    - keywordOverlap * 2.4
    - sameAgeBand * 1.2
    - sameExperienceBand * 1
  );
}

function repeatedCount(values) {
  return values.length - new Set(values).size;
}

function groupObjective(group) {
  const categories = group.map(participantCategory);
  const disciplines = group.map(participantDiscipline);
  const foundationRoles = group.map(foundationRole).filter(Boolean);
  const keywords = group.flatMap(participantKeywords);
  const ageBands = group.map((item) => ageBand(item.age));
  const experienceBands = group.map((item) => experienceBand(item.years_experience));

  return (
    repeatedCount(categories) * 13
    + repeatedCount(disciplines) * 8
    + repeatedCount(foundationRoles) * 11
    + (group.length > 1 && foundationRoles.length === 0 ? 8 : 0)
    + repeatedCount(keywords) * 1.8
    + repeatedCount(ageBands) * 0.8
    + repeatedCount(experienceBands) * 1.2
    - new Set(categories).size * 1.5
    - new Set(disciplines).size * 1.3
    - new Set(foundationRoles).size * 1.4
    - new Set(experienceBands).size
  );
}

function improveGroups(groups) {
  let improved = true;
  let pass = 0;

  while (improved && pass < 6) {
    improved = false;
    pass += 1;

    for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
        for (let leftParticipantIndex = 0; leftParticipantIndex < groups[leftIndex].length; leftParticipantIndex += 1) {
          for (let rightParticipantIndex = 0; rightParticipantIndex < groups[rightIndex].length; rightParticipantIndex += 1) {
            const before = groupObjective(groups[leftIndex]) + groupObjective(groups[rightIndex]);
            const nextLeft = [...groups[leftIndex]];
            const nextRight = [...groups[rightIndex]];
            [nextLeft[leftParticipantIndex], nextRight[rightParticipantIndex]] = [
              nextRight[rightParticipantIndex],
              nextLeft[leftParticipantIndex],
            ];
            const after = groupObjective(nextLeft) + groupObjective(nextRight);

            if (after + 0.001 < before) {
              groups[leftIndex] = nextLeft;
              groups[rightIndex] = nextRight;
              improved = true;
            }
          }
        }
      }
    }
  }

  return groups;
}

export function balancedCapacities(count, targetSize) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  if (safeCount === 0) return [];

  const safeTargetSize = Math.max(1, Math.floor(Number(targetSize) || 3));
  const groupCount = Math.max(1, Math.ceil(safeCount / safeTargetSize));
  const base = Math.floor(safeCount / groupCount);
  const extra = safeCount % groupCount;
  return Array.from({ length: groupCount }, (_, index) => base + (index < extra ? 1 : 0));
}

export function matchParticipants(participants, targetSize = 3) {
  const capacities = balancedCapacities(participants.length, targetSize);
  const groups = capacities.map(() => []);
  const ordered = [...participants].sort((a, b) => {
    const rarity = participantRarityScore(a, participants) - participantRarityScore(b, participants);
    if (rarity !== 0) return rarity;
    return b.years_experience - a.years_experience || b.age - a.age;
  });

  for (const participant of ordered) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    const hasEmptyGroup = groups.some((group) => group.length === 0);

    for (let index = 0; index < groups.length; index += 1) {
      if (groups[index].length >= capacities[index]) continue;
      if (hasEmptyGroup && groups[index].length > 0) continue;
      const fillPenalty = groups[index].length * 0.35;
      const score = incrementalScore(groups[index], participant) - fillPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    groups[bestIndex].push({
      ...participant,
      profession_category: participantCategory(participant),
    });
  }

  return improveGroups(groups).map((group, index) => ({
    group_number: index + 1,
    label: `Group ${index + 1}`,
    participants: group,
    score: {
      size: group.length,
      categories: Array.from(new Set(group.map(participantCategory))),
      age_bands: Array.from(new Set(group.map((item) => ageBand(item.age)))),
      experience_bands: Array.from(new Set(group.map((item) => experienceBand(item.years_experience)))),
      disciplines: Array.from(new Set(group.map(participantDiscipline))),
      foundation_roles: Array.from(new Set(group.map(foundationRole).filter(Boolean))),
      profession_keywords: Array.from(new Set(group.flatMap(participantKeywords))).sort(),
    },
  }));
}

export function assignParticipantToGroup(groups, candidate, targetSize = 3) {
  const availableGroups = groups.filter((group) => group.participants.length > 0);
  if (!availableGroups.length) return null;

  const safeTargetSize = Math.max(1, Math.floor(Number(targetSize) || 3));
  const underTargetGroups = availableGroups.filter((group) => group.participants.length < safeTargetSize);
  const candidateGroups = underTargetGroups.length ? underTargetGroups : availableGroups;
  const smallestSize = Math.min(...candidateGroups.map((group) => group.participants.length));
  const smallestGroups = candidateGroups.filter((group) => group.participants.length === smallestSize);
  let bestGroup = smallestGroups[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const group of smallestGroups) {
    const overTargetPressure = Math.max(0, group.participants.length + 1 - safeTargetSize) * 2.6;
    const score = incrementalScore(group.participants, candidate) - overTargetPressure;
    if (score > bestScore) {
      bestScore = score;
      bestGroup = group;
    }
  }

  return bestGroup;
}
