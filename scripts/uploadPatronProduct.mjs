#!/usr/bin/env node
/**
 * GamePush v0.3.60 patron IAP product uploader.
 *
 * Phases:
 *  1. Fetch existing payments/products — find patron_support if it exists.
 *  2. Upload patron.png via multipart UploadImage mutation.
 *  3. CreatePayment (new) or UpdatePayment (existing), idempotent.
 *
 * Idempotent (re-runnable). Matches existing product by tag `patron_support`.
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

const PRODUCT = {
  tag: "patron_support",
  names: {
    ru: "Поддержать автора",
    en: "Support the author",
  },
  descriptions: {
    ru: "Спасибо за поддержку проекта. Игра становится без рекламы + 300 монет в благодарность.",
    en: "Thanks for supporting the project. The game becomes ad-free + 300 coins as thanks.",
  },
  price: 199,
  // non-consumable / permanent — persists across sessions
  type: "PERMANENT",
  isPublished: true,
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
    variables: { input: { projectId: PROJECT_ID, file: null, tags: ["payment"] } },
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
  console.log(`Project ${PROJECT_ID} — ${DRY_RUN ? "DRY RUN (no network calls)" : "LIVE"}`);

  // -- Phase 1: fetch existing payments ---------------------------------
  console.log("\n[1] Fetching existing payments...");
  let existingProduct = null;

  if (DRY_RUN) {
    console.log("  [dry] would query FetchPayments for existing patron_support product");
  } else {
    const data = await gql(
      `query FetchPayments($projectId: Int!) {
        FetchPayments(input: { projectId: $projectId }) {
          ... on PaymentsList {
            items {
              id tag type price isPublished
              names { ru en fr de es pt tr }
              descriptions { ru en fr de es pt tr }
              icon
            }
          }
          ... on Problem { message }
        }
      }`,
      { projectId: PROJECT_ID },
    );
    const list = data.FetchPayments;
    if (list.__typename === "Problem") {
      throw new Error(`FetchPayments: ${list.message}`);
    }
    const items = list.items ?? [];
    existingProduct = items.find((p) => p.tag === PRODUCT.tag) ?? null;
    console.log(`  Found ${items.length} payment(s). patron_support: ${existingProduct ? `id=${existingProduct.id}` : "not found"}`);
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

  const productInput = {
    tag: PRODUCT.tag,
    type: PRODUCT.type,
    price: PRODUCT.price,
    names: PRODUCT.names,
    descriptions: PRODUCT.descriptions,
    icon: iconSrc,
    isPublished: PRODUCT.isPublished,
  };

  if (existingProduct) {
    // Merge: strip nulls from fetched data, overlay our updates
    const mergedNames = { ...stripNulls(existingProduct.names), ...PRODUCT.names };
    const mergedDescriptions = { ...stripNulls(existingProduct.descriptions), ...PRODUCT.descriptions };
    const updateInput = {
      id: existingProduct.id,
      tag: PRODUCT.tag,
      type: PRODUCT.type,
      price: PRODUCT.price,
      names: mergedNames,
      descriptions: mergedDescriptions,
      icon: iconSrc,
      isPublished: PRODUCT.isPublished,
    };

    if (DRY_RUN) {
      console.log(`  [dry] would UpdatePayment id=${existingProduct.id}`);
      console.log("  [dry] input:", JSON.stringify(updateInput, null, 2));
    } else {
      const data = await gql(
        `mutation UpdatePayment($input: UpdatePaymentInput!) {
          UpdatePayment(input: $input) {
            __typename
            ... on Payment { id tag }
            ... on Problem { message }
          }
        }`,
        { input: updateInput },
      );
      const r = data.UpdatePayment;
      if (r.__typename !== "Payment") {
        throw new Error(`UpdatePayment failed: ${r.message ?? JSON.stringify(r)}`);
      }
      console.log(`  updated patron_support (id=${r.id})`);
    }
  } else {
    const createInput = {
      projectId: PROJECT_ID,
      ...productInput,
    };

    if (DRY_RUN) {
      console.log("  [dry] would CreatePayment (product does not exist yet)");
      console.log("  [dry] input:", JSON.stringify(createInput, null, 2));
    } else {
      const data = await gql(
        `mutation CreatePayment($input: CreatePaymentInput!) {
          CreatePayment(input: $input) {
            __typename
            ... on Payment { id tag }
            ... on Problem { message }
          }
        }`,
        { input: createInput },
      );
      const r = data.CreatePayment;
      if (r.__typename !== "Payment") {
        throw new Error(`CreatePayment failed: ${r.message ?? JSON.stringify(r)}`);
      }
      console.log(`  created patron_support (id=${r.id})`);
    }
  }

  console.log("\nDONE.");
  if (DRY_RUN) {
    console.log("\nDry-run summary:");
    console.log("  Phase 1: FetchPayments — check for existing patron_support product");
    console.log("  Phase 2: UploadImage — upload public/assets/achievements/patron.png");
    console.log("  Phase 3: CreatePayment or UpdatePayment — upsert product (tag=patron_support, type=PERMANENT, price=199)");
    console.log("\nRe-run without --dry-run and GP_API_SECRET set to apply changes.");
  }
})().catch((err) => {
  console.error("\nFATAL:", err.message);
  process.exit(1);
});
