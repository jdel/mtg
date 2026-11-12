import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeCatalogs, parseCsv, REQUIRED_COLUMNS, toCatalog } from "./catalog.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDirectories = ["trading", "searching"];

function escapeCsv(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function mergeDirectory(directoryName) {
  const directory = path.join(projectRoot, directoryName);
  const outputPath = path.join(directory, "Cards.csv");
  await rm(outputPath, { force: true });
  const inputPaths = (await readdir(directory))
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .sort()
    .map((file) => path.join(directory, file));

  if (inputPaths.length === 0) {
    console.log(`No CSV found in ${directoryName}/; skipping.`);
    return;
  }

  const catalogs = await Promise.all(
    inputPaths.map(async (inputPath) => {
      const source = await readFile(inputPath, "utf8");
      return toCatalog(parseCsv(source));
    }),
  );
  const cards = mergeCatalogs(catalogs.flat());
  const rows = cards.map((card) => [
    card.name,
    card.setCode,
    card.collectorNumber,
    card.foil ? "foil" : "normal",
    card.quantity,
    card.scryfallId,
    card.language,
  ]);
  const csv = [REQUIRED_COLUMNS, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  await mkdir(directory, { recursive: true });
  await writeFile(outputPath, `${csv}\n`);
  await Promise.all(
    inputPaths.filter((inputPath) => inputPath !== outputPath).map((inputPath) => rm(inputPath)),
  );
  console.log(
    `Merged ${inputPaths.length} CSV files into ${directoryName}/Cards.csv (${cards.length} cards).`,
  );
}

for (const directoryName of catalogDirectories) {
  await mergeDirectory(directoryName);
}
