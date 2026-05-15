#!/usr/bin/env node
/**
 * GamePush v0.3.56 achievements uploader.
 *
 * Phases:
 *  1. Fetch current state of project's groups/achievements.
 *  2. Upload all 24 icons via multipart `UploadImage` mutation — capture URLs.
 *  3. Update 6 existing achievements with proper tag, maxProgress,
 *     isLockedVisible, icons, descriptions.
 *  4. Update 6 existing groups with tag.
 *  5. Create 14 new achievements (rest of the v0.3.56 set).
 *  6. Update each group's `achievements` list to include the new IDs.
 *
 * Idempotent (re-runnable). Matches existing items by name/rarity if
 * tag is empty; otherwise by tag.
 *
 * Usage:
 *   GP_API_SECRET=xxx node scripts/uploadAchievements.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const API_URL = "https://api.gamepush.com/gs/api/graphql";
const PROJECT_ID = 27547;
const API_SECRET = process.env.GP_API_SECRET;
const ICON_DIR = "dist/achievement-icons";
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_SECRET) {
  console.error("Missing GP_API_SECRET");
  process.exit(1);
}

// ----------------------------------------------------------------------
// Data — 6 groups + 20 achievements (with mapping to existing where known)
// ----------------------------------------------------------------------

const GROUPS = [
  { tag: "path", knownId: 1369 },
  { tag: "archive", knownId: 1370 },
  { tag: "voices", knownId: 1371 },
  { tag: "mastery", knownId: 1372 },
  { tag: "equipment", knownId: 1373 },
  { tag: "community", knownId: 1374 },
];

// `match.names.ru` is used to find pre-existing achievement and upgrade it.
const ACHIEVEMENTS = [
  // Path
  { tag: "first_win", group: "path", rare: "COMMON", hidden: false,
    names: { en: "First Layout", ru: "Первый расклад" },
    descriptions: { en: "The deal came together. The road opens.", ru: "Расклад сошёлся. Дорога открыта." } },
  { tag: "chapter_1_complete", group: "path", rare: "COMMON", hidden: false, maxProgress: 10,
    names: { en: "Line Restored", ru: "Линия восстановлена" },
    descriptions: { en: "All ten points of the first leg completed.", ru: "Десять точек первого участка пройдены." } },
  { tag: "chapter_2_complete", group: "path", rare: "UNCOMMON", hidden: false, maxProgress: 10,
    names: { en: "Beyond the Ridge", ru: "За хребтом" },
    descriptions: { en: "All ten points of the second leg completed.", ru: "Десять точек второго участка пройдены." } },
  { tag: "chapter_3_complete", group: "path", rare: "RARE", hidden: false, maxProgress: 10,
    names: { en: "Archive Complete", ru: "Архив собран" },
    descriptions: { en: "All ten points of the final leg completed.", ru: "Десять точек последнего участка пройдены." } },
  { tag: "epilogue", group: "path", rare: "LEGENDARY", hidden: true,
    names: { en: "On the Final Page", ru: "На последнем листе" },
    descriptions: { en: "The ending found. The story closes.", ru: "Финал найден. История закрыта." } },

  // Archive
  { tag: "first_artifact", group: "archive", rare: "COMMON", hidden: false,
    names: { en: "First Find", ru: "Первая находка" },
    descriptions: { en: "Your first artifact catalogued.", ru: "Первый артефакт занесён в опись." } },
  { tag: "first_entry", group: "archive", rare: "COMMON", hidden: false,
    names: { en: "Foreign Handwriting", ru: "Чужой почерк" },
    descriptions: { en: "First diary entry deciphered.", ru: "Открыта первая запись из чужого дневника." } },
  { tag: "all_artifacts", group: "archive", rare: "EPIC", hidden: true, maxProgress: 9,
    names: { en: "Complete Archive", ru: "Полный архив" },
    descriptions: { en: "All nine artifacts found and described.", ru: "Все девять артефактов найдены и описаны." } },

  // Voices
  { tag: "entries_voronov", group: "voices", rare: "RARE", hidden: false, maxProgress: 13,
    names: { en: "Adrian Cole's Voice", ru: "Голос Воронова" },
    descriptions: { en: "Thirteen entries from the expedition leader deciphered.", ru: "Тринадцать записей начальника экспедиции расшифрованы." } },
  { tag: "entries_levin", group: "voices", rare: "RARE", hidden: false, maxProgress: 6,
    names: { en: "Levin's Doubts", ru: "Сомнения Левина" },
    descriptions: { en: "Six entries from the archaeologist deciphered.", ru: "Шесть записей археолога прочитаны." } },
  { tag: "entries_mirskaya", group: "voices", rare: "UNCOMMON", hidden: false, maxProgress: 4,
    names: { en: "Mirskaya's Marks", ru: "Метки Мирской" },
    descriptions: { en: "Four entries from the cartographer deciphered.", ru: "Четыре записи картографа прочитаны." } },
  { tag: "entries_klimova", group: "voices", rare: "UNCOMMON", hidden: false, maxProgress: 4,
    names: { en: "Klimova's Archive", ru: "Архив Климовой" },
    descriptions: { en: "Four entries from the photographer-archivist deciphered.", ru: "Четыре записи фотографа-архивиста прочитаны." } },
  { tag: "entries_rudenko", group: "voices", rare: "UNCOMMON", hidden: false, maxProgress: 3,
    names: { en: "Rudenko's Corrections", ru: "Поправки Руденко" },
    descriptions: { en: "Three entries from the quartermaster deciphered.", ru: "Три записи квартирмейстера прочитаны." } },

  // Mastery
  { tag: "no_undo_win", group: "mastery", rare: "RARE", hidden: true,
    names: { en: "No Step Back", ru: "Без шага назад" },
    descriptions: { en: "Deal completed without using undo.", ru: "Партия пройдена без отмены ходов." } },
  { tag: "no_hint_win", group: "mastery", rare: "RARE", hidden: true,
    names: { en: "No Hints", ru: "Без подсказок" },
    descriptions: { en: "Deal completed without hints.", ru: "Партия пройдена без подсказок." } },

  // Equipment
  { tag: "coins_500", group: "equipment", rare: "UNCOMMON", hidden: false, maxProgress: 500,
    names: { en: "Halfway There", ru: "Половина пути" },
    descriptions: { en: "500 coins saved up.", ru: "Накоплено 500 монет." } },
  { tag: "coins_1000", group: "equipment", rare: "RARE", hidden: false, maxProgress: 1000,
    names: { en: "Full Pocket", ru: "Полный карман" },
    descriptions: { en: "1,000 coins saved up.", ru: "Накоплено 1000 монет." } },
  { tag: "coins_2000", group: "equipment", rare: "EPIC", hidden: false, maxProgress: 2000,
    names: { en: "Outfitted", ru: "Снаряжение готово" },
    descriptions: { en: "2,000 coins saved up.", ru: "Накоплено 2000 монет." } },

  // Community
  { tag: "first_share", group: "community", rare: "COMMON", hidden: false,
    names: { en: "Word Spread", ru: "Кому-то рассказано" },
    descriptions: { en: "Your first win shared.", ru: "Победой поделились впервые." } },
  { tag: "first_community_join", group: "community", rare: "COMMON", hidden: false,
    names: { en: "Joined In", ru: "В сообществе" },
    descriptions: { en: "Subscribed to the game community.", ru: "Подписка на сообщество игры оформлена." } },
];

// Strips null/undefined fields from a translations object so GraphQL
// doesn't complain about __typename and unset null locales. GP's fetch
// returns null for every locale that wasn't filled — we only want to
// send the ones with actual values.
function stripNulls(obj) {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && k !== "__typename") out[k] = v;
  }
  return out;
}

// ----------------------------------------------------------------------
// Transport
// ----------------------------------------------------------------------

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Secret": API_SECRET,
      "X-Project-ID": String(PROJECT_ID),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL: ${JSON.stringify(json.errors, null, 2)}`);
  }
  return json.data;
}

/** Multipart-upload an icon, return src URL. */
async function uploadIcon(filepath) {
  const buf = readFileSync(filepath);
  const operations = {
    query: `mutation Upload($input: UploadImageInput!) {
      UploadImage(input: $input) {
        __typename
        ... on Image { _id src }
        ... on Problem { message }
      }
    }`,
    variables: { input: { projectId: PROJECT_ID, file: null, tags: ["achievement"] } },
  };
  const form = new FormData();
  form.append("operations", JSON.stringify(operations));
  form.append("map", JSON.stringify({ "0": ["variables.input.file"] }));
  form.append("0", new Blob([buf], { type: "image/png" }), path.basename(filepath));

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "X-API-Secret": API_SECRET,
      "X-Project-ID": String(PROJECT_ID),
      "apollo-require-preflight": "true",
    },
    body: form,
  });
  const json = await res.json();
  if (json.errors) throw new Error(`Upload ${filepath}: ${JSON.stringify(json.errors)}`);
  const out = json.data.UploadImage;
  if (out.__typename !== "Image") {
    throw new Error(`Upload ${filepath}: ${out.message ?? JSON.stringify(out)}`);
  }
  return out.src;
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

(async () => {
  console.log(`Project ${PROJECT_ID} — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  // -- Phase 1: fetch existing state ---------------------------------
  console.log("\n[1] Fetching current state...");
  const existing = await gql(
    `query Existing($projectId: Int!) {
      FetchAchievementsGroups(input: { projectId: $projectId }) {
        ... on AchievementsGroupsList {
          items {
            id tag achievements
            names { en fr it de es zh pt ko ja ru tr ar hi id }
            descriptions { en fr it de es zh pt ko ja ru tr ar hi id }
          }
        }
      }
      FetchAchievements(input: { projectId: $projectId }) {
        ... on AchievementsList { items { id tag rare maxProgress isLockedVisible names { ru en } } }
      }
    }`,
    { projectId: PROJECT_ID },
  );
  const existingGroups = existing.FetchAchievementsGroups?.items ?? [];
  const existingAches = existing.FetchAchievements?.items ?? [];
  console.log(`  Groups: ${existingGroups.length}, Achievements: ${existingAches.length}`);

  // Match existing achievements to our spec by ru name (since they have no tags).
  const matchByRu = (ru) => existingAches.find((a) => a.names?.ru?.trim() === ru);

  // -- Phase 2: upload icons ----------------------------------------
  console.log("\n[2] Uploading icons...");
  const iconUrls = {};
  for (const a of ACHIEVEMENTS) {
    const main = path.join(ICON_DIR, `${a.tag}.png`);
    if (!existsSync(main)) {
      console.warn(`  ! missing ${main}`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry] ${a.tag}.png`);
      iconUrls[a.tag] = `dry://${a.tag}.png`;
    } else {
      iconUrls[a.tag] = await uploadIcon(main);
      console.log(`  ✓ ${a.tag} → ${iconUrls[a.tag]}`);
    }
    if (a.hidden) {
      const locked = path.join(ICON_DIR, `${a.tag}_locked.png`);
      if (existsSync(locked)) {
        if (DRY_RUN) {
          console.log(`  [dry] ${a.tag}_locked.png`);
          iconUrls[`${a.tag}_locked`] = `dry://${a.tag}_locked.png`;
        } else {
          iconUrls[`${a.tag}_locked`] = await uploadIcon(locked);
          console.log(`  ✓ ${a.tag}_locked → ${iconUrls[`${a.tag}_locked`]}`);
        }
      }
    }
  }

  // -- Phase 3: update groups with tags ------------------------------
  console.log("\n[3] Updating group tags...");
  const groupIdByTag = {};
  for (const g of GROUPS) {
    const existing = existingGroups.find((eg) => eg.id === g.knownId);
    if (!existing) {
      console.warn(`  ! group id=${g.knownId} not found, skipping`);
      continue;
    }
    groupIdByTag[g.tag] = existing.id;
    if (existing.tag === g.tag) {
      console.log(`  = ${g.tag} (id=${existing.id}) already tagged`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  [dry] would tag group ${existing.id} as "${g.tag}"`);
      continue;
    }
    await gql(
      `mutation Upd($input: UpdateAchievementsGroupInput!) {
        UpdateAchievementsGroup(input: $input) { __typename ... on Problem { message } }
      }`,
      {
        input: {
          id: existing.id,
          tag: g.tag,
          names: stripNulls(existing.names),
          descriptions: stripNulls(existing.descriptions),
          achievements: existing.achievements ?? [],
        },
      },
    );
    console.log(`  ✓ tagged group ${existing.id} as "${g.tag}"`);
  }

  // -- Phase 4: upsert achievements ----------------------------------
  console.log("\n[4] Upserting achievements...");
  const createdIdByTag = {};
  for (const a of ACHIEVEMENTS) {
    const groupId = groupIdByTag[a.group];
    const matched = matchByRu(a.names.ru);
    const input = {
      tag: a.tag,
      rare: a.rare,
      names: a.names,
      descriptions: a.descriptions,
      isPublished: true,
      // GP semantic: isLockedVisible=false ⇒ achievement hidden until unlocked.
      isLockedVisible: !a.hidden,
      isLockedDescriptionVisible: !a.hidden,
      maxProgress: a.maxProgress ?? 0,
      progressStep: a.maxProgress ? 1 : 0,
    };
    // GP requires both icon and lockedIcon always set on Create/Update.
    // For non-hidden achievements without a separate _locked.png we reuse
    // the main icon URL — GP will still treat the achievement as visible
    // when locked (isLockedVisible flag controls visibility, not the icon).
    if (iconUrls[a.tag]) input.icon = iconUrls[a.tag];
    input.lockedIcon = iconUrls[`${a.tag}_locked`] ?? iconUrls[a.tag];

    if (matched) {
      if (DRY_RUN) {
        console.log(`  [dry] update ${a.tag} (existing id=${matched.id})`);
        createdIdByTag[a.tag] = matched.id;
        continue;
      }
      await gql(
        `mutation Upd($input: UpdateAchievementInput!) {
          UpdateAchievement(input: $input) { __typename ... on Problem { message } }
        }`,
        { input: { id: matched.id, ...input } },
      );
      createdIdByTag[a.tag] = matched.id;
      console.log(`  ↻ updated ${a.tag} (id=${matched.id})`);
    } else {
      if (DRY_RUN) {
        console.log(`  [dry] create ${a.tag}`);
        continue;
      }
      const out = await gql(
        `mutation Cr($input: CreateAchievementInput!) {
          CreateAchievement(input: $input) {
            __typename
            ... on Achievement { id tag }
            ... on Problem { message }
          }
        }`,
        { input: { projectId: PROJECT_ID, ...input } },
      );
      const r = out.CreateAchievement;
      if (r.__typename !== "Achievement") {
        console.error(`  ✗ create ${a.tag} failed: ${r.message ?? JSON.stringify(r)}`);
        continue;
      }
      createdIdByTag[a.tag] = r.id;
      console.log(`  + created ${a.tag} (id=${r.id})`);
    }
  }

  // -- Phase 5: rewire groups → achievement ids ----------------------
  console.log("\n[5] Wiring groups → achievement IDs...");
  const groupTargets = {};
  for (const g of GROUPS) groupTargets[g.tag] = [];
  for (const a of ACHIEVEMENTS) {
    const id = createdIdByTag[a.tag];
    if (id != null) groupTargets[a.group].push(id);
  }
  for (const g of GROUPS) {
    const id = groupIdByTag[g.tag];
    if (id == null) continue;
    const want = groupTargets[g.tag];
    if (DRY_RUN) {
      console.log(`  [dry] group ${g.tag} → ${JSON.stringify(want)}`);
      continue;
    }
    const groupState = existingGroups.find((eg) => eg.id === id);
    await gql(
      `mutation Upd($input: UpdateAchievementsGroupInput!) {
        UpdateAchievementsGroup(input: $input) { __typename ... on Problem { message } }
      }`,
      {
        input: {
          id,
          tag: g.tag,
          names: stripNulls(groupState?.names ?? {}),
          descriptions: stripNulls(groupState?.descriptions ?? {}),
          achievements: want,
        },
      },
    );
    console.log(`  ✓ group ${g.tag} ← [${want.join(", ")}]`);
  }

  console.log("\nDONE.");
})().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
