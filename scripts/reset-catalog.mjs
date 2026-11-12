import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDirectory = path.join(projectRoot, "public", "data");
const imageDirectory = path.join(projectRoot, "public", "cards");

await rm(catalogDirectory, { force: true, recursive: true });
await rm(imageDirectory, { force: true, recursive: true });

console.log("Removed the generated catalogs and card-image cache.");
