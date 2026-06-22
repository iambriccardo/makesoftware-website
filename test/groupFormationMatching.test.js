import assert from "node:assert/strict";
import test from "node:test";
import {
  assignParticipantToGroup,
  balancedCapacities,
  matchParticipants,
  normalizeProfession,
  professionCategory,
  professionKeywords,
} from "../supabase/functions/_shared/matching.js";

const professions = [
  ["React front-end engineer", "frontend"],
  ["Vue web developer", "frontend"],
  ["Backend API engineer", "backend"],
  ["Cloud infrastructure engineer", "backend"],
  ["Product designer", "design"],
  ["UX researcher", "design"],
  ["Founder / growth", "business"],
  ["Product manager", "business"],
  ["AI researcher", "research"],
  ["Machine learning scientist", "research"],
  ["Illustrator and writer", "creative"],
  ["Student learning to code", "learner"],
  ["Computer science student", "learner"],
  ["Teacher and community organizer", "community"],
  ["Cybersecurity analyst", "backend"],
  ["Ceramicist", "other"],
  ["Florist", "other"],
];

function participant(id, profession, age = 30, years_experience = 5) {
  return {
    id: `p-${id}`,
    first_name: `Person${id}`,
    last_name: "Test",
    age,
    years_experience,
    profession,
    profession_category: professionCategory(profession),
  };
}

function flatten(groups) {
  return groups.flatMap((group) => group.participants);
}

function assertEveryParticipantOnce(groups, participants) {
  const assigned = flatten(groups).map((item) => item.id).sort();
  assert.deepEqual(assigned, participants.map((item) => item.id).sort());
}

function assertBalanced(groups) {
  const sizes = groups.map((group) => group.participants.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `unbalanced sizes: ${sizes.join(", ")}`);
}

function categoryRepeats(groups) {
  return groups.reduce((total, group) => {
    const categories = group.participants.map((participant) => participant.profession_category);
    return total + categories.length - new Set(categories).size;
  }, 0);
}

function experiencedCount(group) {
  return group.participants.filter((participant) => participant.years_experience >= 7).length;
}

function disciplineCounts(group) {
  return group.participants.reduce((counts, participant) => {
    const discipline = participant.profession_category === "frontend" || participant.profession_category === "backend"
      ? "engineering"
      : participant.profession_category;
    counts[discipline] = (counts[discipline] || 0) + 1;
    return counts;
  }, {});
}

test("normalizes common profession aliases and keywords", () => {
  assert.equal(normalizeProfession("Senior Front-End Engineer"), "senior frontend engineer");
  assert.equal(normalizeProfession("  MSc, Computer-Science / AI   Student!! "), "msc cs ai student");
  assert.equal(professionCategory("React UI engineer"), "frontend");
  assert.equal(professionCategory("Product Designer / UX"), "design");
  assert.equal(professionCategory("ML research scientist"), "research");
  assert.equal(professionCategory("Computer Science undergraduate student"), "learner");
  assert.equal(professionCategory("Teacher, community organizer"), "community");
  assert.equal(professionCategory("QA / security engineer"), "backend");
  assert.equal(professionCategory("Ceramicist"), "other");
  assert.ok(professionKeywords("Full-stack TypeScript developer").includes("fullstack"));
  assert.ok(professionKeywords("  PhD, Bioinformatics & Data-Science ").includes("datascience"));
  assert.ok(!professionKeywords("Retail manager").includes("ai"));
});

test("classifies messy student and academic inputs without fragile punctuation", () => {
  const cases = [
    ["  BSc, software engineering student ", "learner"],
    ["High-school pupil; learning python", "learner"],
    ["Self-taught career switcher", "learner"],
    ["PhD computational biology researcher", "research"],
    ["M.Sc. statistics / data science", "research"],
    ["Program coordinator, nonprofit events", "community"],
  ];

  for (const [profession, expected] of cases) {
    assert.equal(professionCategory(profession), expected, profession);
  }
});

test("computes balanced capacities for uneven rooms", () => {
  assert.deepEqual(balancedCapacities(0, 3), []);
  assert.deepEqual(balancedCapacities(1, 3), [1]);
  assert.deepEqual(balancedCapacities(2, 3), [2]);
  assert.deepEqual(balancedCapacities(4, 3), [2, 2]);
  assert.deepEqual(balancedCapacities(5, 3), [3, 2]);
  assert.deepEqual(balancedCapacities(7, 3), [3, 2, 2]);
  assert.deepEqual(balancedCapacities(8, 3), [3, 3, 2]);
  assert.deepEqual(balancedCapacities(10, 4), [4, 3, 3]);
  assert.deepEqual(balancedCapacities(3, 0), [3]);
});

test("handles empty and smaller-than-target rooms", () => {
  assert.deepEqual(matchParticipants([], 3), []);

  const oneParticipant = [participant(1, "Backend engineer", 31, 7)];
  const oneGroup = matchParticipants(oneParticipant, 3);
  assert.deepEqual(oneGroup.map((group) => group.participants.length), [1]);
  assertEveryParticipantOnce(oneGroup, oneParticipant);

  const twoParticipants = [
    participant(1, "Backend engineer", 31, 7),
    participant(2, "Product designer", 24, 2),
  ];
  const twoGroups = matchParticipants(twoParticipants, 3);
  assert.deepEqual(twoGroups.map((group) => group.participants.length), [2]);
  assertEveryParticipantOnce(twoGroups, twoParticipants);
});

test("keeps groups near target size without creating avoidable tiny leftovers", () => {
  for (const [count, targetSize, expectedSizes] of [
    [3, 3, [3]],
    [4, 3, [2, 2]],
    [5, 3, [3, 2]],
    [6, 3, [3, 3]],
    [7, 3, [3, 2, 2]],
    [8, 3, [3, 3, 2]],
    [9, 3, [3, 3, 3]],
    [10, 3, [3, 3, 2, 2]],
  ]) {
    const participants = Array.from({ length: count }, (_, index) => (
      participant(index, professions[index % professions.length][0], 22 + index, index % 12)
    ));
    const groups = matchParticipants(participants, targetSize);
    assert.deepEqual(groups.map((group) => group.participants.length), expectedSizes, `count ${count}`);
    assertEveryParticipantOnce(groups, participants);
  }
});

test("builds balanced groups and assigns every participant once", () => {
  const participants = professions.slice(0, 10).map(([professionName], index) => (
    participant(index, professionName, 22 + index * 3, index)
  ));
  const groups = matchParticipants(participants, 3);

  assert.equal(groups.length, 4);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);
});

test("promotes category diversity when the room has enough variety", () => {
  const participants = [
    participant(1, "React engineer", 28, 5),
    participant(2, "Vue web engineer", 31, 4),
    participant(3, "Backend API engineer", 35, 9),
    participant(4, "Database engineer", 41, 12),
    participant(5, "Product designer", 29, 7),
    participant(6, "UX researcher", 33, 6),
    participant(7, "Founder", 38, 11),
    participant(8, "Growth marketer", 27, 5),
    participant(9, "AI researcher", 36, 10),
  ];

  const groups = matchParticipants(participants, 3);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);
  assert.ok(categoryRepeats(groups) <= 1, JSON.stringify(groups.map((group) => group.score.categories)));
});

test("spreads engineering and design across groups when foundational roles are available", () => {
  const participants = [
    participant(1, "React frontend engineer", 28, 5),
    participant(2, "Backend API engineer", 32, 8),
    participant(3, "Mobile iOS engineer", 26, 3),
    participant(4, "Cloud infrastructure engineer", 39, 12),
    participant(5, "Product designer", 29, 6),
    participant(6, "UX designer", 31, 7),
    participant(7, "Visual designer", 24, 2),
    participant(8, "Service designer", 36, 9),
    participant(9, "Founder", 42, 15),
    participant(10, "Teacher and community organizer", 34, 6),
    participant(11, "AI researcher", 37, 10),
    participant(12, "Illustrator writer", 27, 4),
  ];

  const groups = matchParticipants(participants, 3);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);

  for (const group of groups) {
    const counts = disciplineCounts(group);
    assert.equal(counts.engineering, 1, JSON.stringify(group.participants));
    assert.equal(counts.design, 1, JSON.stringify(group.participants));
  }
});

test("spreads overrepresented engineers instead of overclustering them", () => {
  const participants = [
    participant(1, "React frontend engineer", 28, 5),
    participant(2, "Backend API engineer", 32, 8),
    participant(3, "Mobile iOS engineer", 26, 3),
    participant(4, "Cloud infrastructure engineer", 39, 12),
    participant(5, "Full-stack developer", 29, 6),
    participant(6, "Product designer", 31, 7),
    participant(7, "Founder", 42, 15),
    participant(8, "Teacher", 34, 6),
  ];

  const groups = matchParticipants(participants, 3);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);

  const engineeringCounts = groups.map((group) => disciplineCounts(group).engineering || 0);
  assert.ok(Math.max(...engineeringCounts) <= 2, `engineering counts: ${engineeringCounts.join(", ")}`);
  assert.ok(engineeringCounts.filter((count) => count > 0).length >= 2, `engineering counts: ${engineeringCounts.join(", ")}`);
});

test("spreads repeated frontend keywords instead of clustering them", () => {
  const participants = [
    participant(1, "React frontend engineer", 29, 5),
    participant(2, "React UI engineer", 34, 8),
    participant(3, "Vue frontend developer", 26, 3),
    participant(4, "Backend API engineer", 38, 11),
    participant(5, "Product designer", 31, 6),
    participant(6, "Founder", 42, 14),
  ];

  const groups = matchParticipants(participants, 3);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);

  const frontendCounts = groups.map((group) => (
    group.participants.filter((item) => item.profession_category === "frontend").length
  ));
  assert.ok(Math.max(...frontendCounts) <= 2, `frontend counts: ${frontendCounts.join(", ")}`);
});

test("mixes experience levels for knowledge sharing when possible", () => {
  const participants = [
    participant(1, "Senior backend engineer", 42, 15),
    participant(2, "Senior product designer", 39, 13),
    participant(3, "Founder", 36, 11),
    participant(4, "Junior React developer", 23, 1),
    participant(5, "Student learning ML", 21, 0),
    participant(6, "Beginner artist", 25, 0),
  ];

  const groups = matchParticipants(participants, 3);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);
  assert.ok(groups.every((group) => experiencedCount(group) >= 1), JSON.stringify(groups.map((group) => group.participants)));
});

test("falls back to age and experience spread for unknown professions", () => {
  const participants = [
    participant(1, "Ceramicist", 22, 0),
    participant(2, "Luthier", 24, 2),
    participant(3, "Community organizer", 29, 4),
    participant(4, "Archivist", 37, 9),
    participant(5, "Chef", 45, 18),
    participant(6, "Florist", 52, 25),
  ];

  const groups = matchParticipants(participants, 3);
  assertBalanced(groups);
  assertEveryParticipantOnce(groups, participants);
  assert.ok(groups.every((group) => group.score.experience_bands.length > 1), JSON.stringify(groups.map((group) => group.score)));
});

test("is deterministic for the same input", () => {
  const participants = professions.map(([professionName], index) => (
    participant(index, professionName, 20 + (index % 8) * 4, index % 12)
  ));
  assert.deepEqual(matchParticipants(participants, 4), matchParticipants(participants, 4));
});

test("generated rooms stay balanced and preserve diversity better than naive ordering", () => {
  for (let seed = 0; seed < 80; seed += 1) {
    const count = 6 + (seed % 15);
    const participants = Array.from({ length: count }, (_, index) => {
      const [professionName] = professions[(index * 7 + seed * 3) % professions.length];
      return participant(
        `${seed}-${index}`,
        professionName,
        18 + ((index * 5 + seed * 2) % 44),
        (index * 3 + seed) % 18
      );
    });

    const groups = matchParticipants(participants, 3 + (seed % 2));
    assertBalanced(groups);
    assertEveryParticipantOnce(groups, participants);

    const naiveGroups = balancedCapacities(participants.length, 3 + (seed % 2)).map(() => []);
    participants.forEach((item, index) => {
      naiveGroups[index % naiveGroups.length].push(item);
    });
    const naiveRepeats = categoryRepeats(naiveGroups.map((items, index) => ({
      group_number: index + 1,
      participants: items,
    })));

    assert.ok(
      categoryRepeats(groups) <= naiveRepeats,
      `seed ${seed} repeated more categories than naive assignment`
    );
  }
});

test("assigns a late participant without moving existing groups", () => {
  const participants = [
    participant(1, "React engineer", 28, 5),
    participant(2, "Product designer", 35, 9),
    participant(3, "Backend API engineer", 41, 12),
    participant(4, "Founder", 31, 7),
    participant(5, "UX researcher", 27, 4),
  ];
  const groups = matchParticipants(participants, 2);
  const before = groups.map((group) => group.participants.map((item) => item.id));
  const lateParticipant = participant(99, "Machine learning scientist", 33, 8);
  const assignedGroup = assignParticipantToGroup(groups, lateParticipant, 2);

  assert.ok(assignedGroup);
  assert.ok(groups.some((group) => group.group_number === assignedGroup.group_number));
  assert.deepEqual(groups.map((group) => group.participants.map((item) => item.id)), before);
});

test("late participant assignment prefers smaller groups", () => {
  const groups = [
    {
      group_number: 1,
      participants: [
        participant(1, "React engineer", 28, 5),
        participant(2, "Backend engineer", 35, 9),
        participant(3, "Founder", 41, 14),
      ],
    },
    {
      group_number: 2,
      participants: [
        participant(4, "Product designer", 29, 6),
      ],
    },
  ];
  const assignedGroup = assignParticipantToGroup(groups, participant(99, "UX researcher", 30, 7), 3);
  assert.equal(assignedGroup.group_number, 2);
});
