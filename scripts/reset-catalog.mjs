import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(projectRoot, "public", "data", "cards.json");
const imageDirectory = path.join(projectRoot, "public", "cards");

await rm(catalogPath, { force: true });
await rm(imageDirectory, { force: true, recursive: true });

console.log("Removed the generated catalog and card-image cache.");
