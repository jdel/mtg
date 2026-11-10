import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { mergeCatalogs, parseCsv, toCatalog } from "./catalog.mjs";
import {
  cacheMissingImages,
  fetchScryfallCards,
  findMissingImageIds,
  removeStaleImages,
} from "./scryfall-images.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importDirectory = path.join(projectRoot, "import");
const outputPath = path.join(projectRoot, "public", "data", "cards.json");
const imageDirectory = path.join(projectRoot, "public", "cards");
const cacheKeyOnly = process.argv.includes("--cache-key");

async function readCachedScryfallMetadata() {
  try {
    const cachedCards = JSON.parse(await readFile(outputPath, "utf8"));
    return new Map(
      cachedCards
        .filter(
          (card) =>
            Object.hasOwn(card, "secondaryName") &&
            Array.isArray(card.colors) &&
            typeof card.typeLine === "string",
        )
        .map((card) => [
          card.scryfallId,
          {
            secondaryName: card.secondaryName,
            colors: card.colors,
            typeLine: card.typeLine,
          },
        ]),
    );
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
}

async function findInputs() {
  const requestedFiles = process.argv.slice(2).filter((argument) => argument !== "--cache-key");
  if (requestedFiles.length > 0) {
    return requestedFiles.map((file) => path.resolve(process.cwd(), file));
  }

  const csvFiles = (await readdir(importDirectory))
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .sort();

  if (csvFiles.length === 0) {
    console.warn("No CSV found in import/. Generating an empty catalog.");
  }

  return csvFiles.map((file) => path.join(importDirectory, file));
}

const inputPaths = await findInputs();
const catalogs = await Promise.all(
  inputPaths.map(async (inputPath) => {
    const source = await readFile(inputPath, "utf8");
    return toCatalog(parseCsv(source));
  }),
);
const cards = mergeCatalogs(catalogs.flat());
const scryfallIds = [...new Set(cards.map((card) => card.scryfallId))];

if (cacheKeyOnly) {
  const cacheKey = createHash("sha256")
    .update(scryfallIds.toSorted().join("\n"))
    .digest("hex");
  process.stdout.write(cacheKey);
} else {
  const scryfallMetadata = await readCachedScryfallMetadata();
  const missingImageIds = await findMissingImageIds(scryfallIds, imageDirectory);
  const missingMetadataIds = scryfallIds.filter((id) => !scryfallMetadata.has(id));
  const lookupIds = [...new Set([...missingImageIds, ...missingMetadataIds])];
  const scryfallCards = await fetchScryfallCards(lookupIds);

  for (const id of missingMetadataIds) {
    const scryfallCard = scryfallCards.get(id);
    const colors =
      scryfallCard.colors ??
      [...new Set(scryfallCard.card_faces?.flatMap((face) => face.colors ?? []) ?? [])];
    scryfallMetadata.set(id, {
      secondaryName: scryfallCard.flavor_name ?? null,
      colors,
      typeLine: scryfallCard.type_line,
    });
  }

  await cacheMissingImages(missingImageIds, scryfallCards, imageDirectory);
  const staleImageCount = await removeStaleImages(scryfallIds, imageDirectory);
  const cardsWithImages = cards.map((card) => {
    const metadata = scryfallMetadata.get(card.scryfallId);
    return {
      ...card,
      secondaryName: metadata.secondaryName,
      colors: metadata.colors,
      typeLine: metadata.typeLine,
      image: `cards/${card.scryfallId}.webp`,
    };
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(cardsWithImages, null, 2)}\n`);

  console.log(
    `Imported ${cards.length} catalog rows from ${inputPaths.length} CSV files; ` +
      `${missingImageIds.length} new images downloaded, ` +
      `${scryfallIds.length - missingImageIds.length} already cached; ` +
      `${staleImageCount} stale images removed; ` +
      `${missingMetadataIds.length} card records fetched from Scryfall.`,
  );
}
