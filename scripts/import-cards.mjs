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
const imageDirectory = path.join(projectRoot, "public", "cards");
const cacheKeyOnly = process.argv.includes("--cache-key");
const requestedFiles = process.argv
  .slice(2)
  .filter((argument) => argument !== "--cache-key")
  .map((file) => path.resolve(process.cwd(), file));
const catalogSources = [
  {
    directory: path.join(projectRoot, "trading"),
    label: "trading",
    outputPath: path.join(projectRoot, "public", "data", "trading.json"),
  },
  {
    directory: path.join(projectRoot, "searching"),
    label: "searching",
    outputPath: path.join(projectRoot, "public", "data", "searching.json"),
  },
];
async function readCachedScryfallMetadata() {
  const cachedCatalogs = await Promise.all(
    catalogSources.map(async ({ outputPath }) => {
      try {
        return JSON.parse(await readFile(outputPath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
    }),
  );

  return new Map(
    cachedCatalogs
      .flat()
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
}

async function readCatalog({ directory, label, outputPath }) {
  const inputPaths = label === "trading" && requestedFiles.length > 0
    ? requestedFiles
    : (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  const parsedCatalogs = await Promise.all(
    inputPaths.map(async (inputPath) => {
      const source = await readFile(inputPath, "utf8");
      return toCatalog(parseCsv(source));
    }),
  );

  return {
    cards: mergeCatalogs(parsedCatalogs.flat()),
    inputCount: inputPaths.length,
    label,
    outputPath,
  };
}

const catalogs = await Promise.all(catalogSources.map(readCatalog));
const allCards = catalogs.flatMap((catalog) => catalog.cards);
const scryfallIds = [...new Set(allCards.map((card) => card.scryfallId))];

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
  await Promise.all(
    catalogs.map(async ({ cards, outputPath }) => {
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
    }),
  );
  console.log(
    `Imported ${catalogs.map(({ cards, inputCount, label }) =>
      `${cards.length} ${label} rows from ${inputCount} CSV file${inputCount === 1 ? "" : "s"}`
    ).join(" and ")}; ` +
      `${missingImageIds.length} new images downloaded, ` +
      `${scryfallIds.length - missingImageIds.length} already cached; ` +
      `${staleImageCount} stale images removed; ` +
      `${missingMetadataIds.length} card records fetched from Scryfall.`,
  );
}
