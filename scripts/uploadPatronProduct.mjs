#!/usr/bin/env node
/**
 * GamePush v0.3.60 patron IAP product uploader.
 *
 * Phases:
 *  1. FetchProducts — find patron_support if it exists.
 *  2. Upload patron.png via multipart UploadImage mutation.
 *  3. CreateProduct (new) or UpdateProduct (existing), idempotent.
 *
 * Idempotent (re-runnable). Matches existing product by tag `patron_support`.
 *
 * v0.3.60 corrections (after introspection 2026-05-19):
 *  - Query is `FetchProducts` (NOT `FetchPayments` — does not exist).
 *  - Type wrapper is `ProductsList`, items are `Product`.
 *  - Mutations are `CreateProduct` / `UpdateProduct` (NOT *Payment).
 *  - `type` is enum `ProductType`: IN_GAME | CURRENCY_BUNDLE | VIP | SKIP_AD
 *    (NOT "PERMANENT" — used IN_GAME for solitaire-expedition).
 *  - No `isPublished` field — products are live by default after Create.
 *  - Price is `prices: PlatformSpecificFloatInput` per-platform map.
 *  - Many required NON_NULL fields (yandexId, beelineId, xsollaId,
 *    onestoreId, googlePlayId, gamePlatformId, isSubscription,
 *    period, trialPeriod) — pass safe defaults if not used.
 *  - Benefits intentionally NOT set (disableGameAds=false, currencyAccrual=0)
 *    because client-side PaymentsService.activatePatron already handles
 *    ad-gate + 300 coin bonus. Setting GP benefits would cause double credit.
 *
 * Usage:
 *   GP_API_SECRET=xxx node scripts/uploadPatronProduct.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const API_URL = "https://api.gamepush.com/gs/api/graphql";
const PROJECT_ID = 27547;
const API_SECRET = process.env.GP_API_SECRET;
const ICON_PATH = "public/assets/achievements/patron.png";
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_SECRET) {
  if (DRY_RUN) {
    console.warn("[dry-run] GP_API_SECRET not set — running in simulation mode, no network calls.");
  } else {
    console.error("Error: GP_API_SECRET environment variable is required.");
    console.error("Usage: GP_API_SECRET=xxx node scripts/uploadPatronProduct.mjs [--dry-run]");
    process.exit(1);
  }
}

// ----------------------------------------------------------------------
// Product spec
// ----------------------------------------------------------------------

const BASE_PRICE = 199;
const BASE_CURRENCY = "RUB";

const PRODUCT = {
  tag: "patron_support",
  type: "IN_GAME", // ProductType enum
  names: {
    ru: "Поддержать автора",
    en: "Support the author",
  },
  descriptions: {
    ru: "Спасибо за поддержку проекта. Игра становится без рекламы + 300 монет в благодарность.",
    en: "Thanks for supporting the project. The game becomes ad-free + 300 coins as thanks.",
  },
  // Platform-specific prices in base currency (RUB). All 38 platform slots
  // exist; we only set ones that practically take payments — others fall
  // back to basePrice automatically via GP currency conversion.
  prices: {
    YANDEX: BASE_PRICE,
    VK: BASE_PRICE,
    OK: BASE_PRICE,
    TELEGRAM: BASE_PRICE,
    VK_PLAY: BASE_PRICE,
    SMARTMARKET: BASE_PRICE,
    RUSTORE: BASE_PRICE,
    CUSTOM: BASE_PRICE,
    PARTNER: BASE_PRICE,
    NONE: BASE_PRICE,
  },
};

// Strips null/undefined fields and __typename from objects returned by GP fetch.
// GP returns null for every locale that wasn't filled — we only send actual values.
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
    variables: { input: { projectId: PROJECT_ID, file: null, tags: ["product"] } },
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

/** All required NON_NULL fields per CreateProductInput introspection. */
function baseInput(iconSrc) {
  return {
    type: PRODUCT.type,
    tag: PRODUCT.tag,
    icon: iconSrc,
    // External platform refs — empty defaults when not using those platforms.
    yandexId: "",
    beelineId: 0,
    xsollaId: "",
    onestoreId: "",
    googlePlayId: "",
    // 0 = any (no specific game platform binding).
    gamePlatformId: 0,
    names: PRODUCT.names,
    descriptions: PRODUCT.descriptions,
    prices: PRODUCT.prices,
    // Non-subscription one-shot product.
    isSubscription: false,
    period: 0,
    trialPeriod: 0,
    basePrice: BASE_PRICE,
    baseCurrency: BASE_CURRENCY,
    // baseRealPrice / baseRealCurrency optional на Create, NON_NULL на Update.
    // Включаем для обоих путей чтобы избежать асимметрии.
    baseRealPrice: BASE_PRICE,
    baseRealCurrency: BASE_CURRENCY,
  };
}

// ----------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------

(async () => {
  console.log(`Project ${PROJECT_ID} — ${DRY_RUN ? "DRY RUN (no network calls)" : "LIVE"}`);

  // -- Phase 1: fetch existing products ---------------------------------
  console.log("\n[1] Fetching existing products...");
  let existingProduct = null;

  if (DRY_RUN) {
    console.log("  [dry] would query FetchProducts for existing patron_support product");
  } else {
    const data = await gql(
      `query FetchProductsQuery($projectId: Int!) {
        FetchProducts(input: { projectId: $projectId }) {
          ... on ProductsList {
            items {
              id tag type
              names { ru en fr it de es zh pt ko ja tr ar hi id }
              descriptions { ru en fr it de es zh pt ko ja tr ar hi id }
              icon
            }
          }
          ... on Problem { message }
        }
      }`,
      { projectId: PROJECT_ID },
    );
    const list = data.FetchProducts;
    if (list.__typename === "Problem") {
      throw new Error(`FetchProducts: ${list.message}`);
    }
    const items = list.items ?? [];
    existingProduct = items.find((p) => p.tag === PRODUCT.tag) ?? null;
    console.log(`  Found ${items.length} product(s). patron_support: ${existingProduct ? `id=${existingProduct.id}` : "not found"}`);
  }

  // -- Phase 2: upload patron.png icon ----------------------------------
  console.log("\n[2] Uploading patron.png...");
  let iconSrc = null;

  if (DRY_RUN) {
    console.log(`  [dry] would upload ${ICON_PATH}`);
    iconSrc = "dry://patron.png";
  } else {
    iconSrc = await uploadIcon(ICON_PATH);
    console.log(`  uploaded → ${iconSrc}`);
  }

  // -- Phase 3: create or update product --------------------------------
  console.log("\n[3] Upserting patron_support product...");

  if (existingProduct) {
    // Merge: strip nulls from fetched localized fields, overlay our values.
    const mergedNames = { ...stripNulls(existingProduct.names), ...PRODUCT.names };
    const mergedDescriptions = { ...stripNulls(existingProduct.descriptions), ...PRODUCT.descriptions };
    const updateInput = {
      ...baseInput(iconSrc),
      id: existingProduct.id,
      names: mergedNames,
      descriptions: mergedDescriptions,
    };

    if (DRY_RUN) {
      console.log(`  [dry] would UpdateProduct id=${existingProduct.id}`);
      console.log("  [dry] input:", JSON.stringify(updateInput, null, 2));
    } else {
      const data = await gql(
        `mutation UpdateProductMutation($input: UpdateProductInput!) {
          UpdateProduct(input: $input) {
            __typename
            ... on Product { id tag }
            ... on Problem { message }
          }
        }`,
        { input: updateInput },
      );
      const r = data.UpdateProduct;
      if (r.__typename !== "Product") {
        throw new Error(`UpdateProduct failed: ${r.message ?? JSON.stringify(r)}`);
      }
      console.log(`  updated patron_support (id=${r.id})`);
    }
  } else {
    const createInput = {
      projectId: PROJECT_ID,
      ...baseInput(iconSrc),
    };

    if (DRY_RUN) {
      console.log("  [dry] would CreateProduct (product does not exist yet)");
      console.log("  [dry] input:", JSON.stringify(createInput, null, 2));
    } else {
      const data = await gql(
        `mutation CreateProductMutation($input: CreateProductInput!) {
          CreateProduct(input: $input) {
            __typename
            ... on Product { id tag }
            ... on Problem { message }
          }
        }`,
        { input: createInput },
      );
      const r = data.CreateProduct;
      if (r.__typename !== "Product") {
        throw new Error(`CreateProduct failed: ${r.message ?? JSON.stringify(r)}`);
      }
      console.log(`  created patron_support (id=${r.id})`);
    }
  }

  console.log("\nDONE.");
  if (DRY_RUN) {
    console.log("\nDry-run summary:");
    console.log("  Phase 1: FetchProducts — check for existing patron_support");
    console.log("  Phase 2: UploadImage — upload public/assets/achievements/patron.png");
    console.log("  Phase 3: CreateProduct or UpdateProduct — upsert (tag=patron_support, type=IN_GAME, basePrice=199 RUB)");
    console.log("\nRe-run without --dry-run and GP_API_SECRET set to apply changes.");
  }
})().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
