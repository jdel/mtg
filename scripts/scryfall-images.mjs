import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SCRYFALL_COLLECTION_URL = "https://api.scryfall.com/cards/collection";
const SCRYFALL_BATCH_SIZE = 75;
const DOWNLOAD_BATCH_SIZE = 12;
const REQUEST_HEADERS = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "Content-Type": "application/json",
  "User-Agent": "mtg-card-list-importer/1.0 (https://github.com/jdel/mtg)",
};

function imagePath(imageDirectory, scryfallId) {
  return path.join(imageDirectory, `${scryfallId}.webp`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function fetchScryfallCards(ids) {
  const cardsById = new Map();

  for (let index = 0; index < ids.length; index += SCRYFALL_BATCH_SIZE) {
    const batch = ids.slice(index, index + SCRYFALL_BATCH_SIZE);
    const response = await fetch(SCRYFALL_COLLECTION_URL, {
      method: "POST",
      headers: REQUEST_HEADERS,
      body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
    });

    if (!response.ok) {
      throw new Error(`Scryfall lookup failed with ${response.status} ${response.statusText}.`);
    }

    const result = await response.json();
    for (const card of result.data) cardsById.set(card.id, card);

    if (result.not_found.length > 0) {
      const missingIds = result.not_found.map((identifier) => identifier.id).join(", ");
      throw new Error(`Scryfall could not find: ${missingIds}`);
    }

    if (index + SCRYFALL_BATCH_SIZE < ids.length) {
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
  }

  return cardsById;
}

function displayImageUrl(card) {
  return card.image_uris?.display ?? card.card_faces?.[0]?.image_uris?.display;
}

async function downloadImage(imageDirectory, id, url) {
  const response = await fetch(url, {
    headers: {
      Accept: "image/webp,*/*;q=0.8",
      "User-Agent": REQUEST_HEADERS["User-Agent"],
    },
  });

  if (!response.ok) {
    throw new Error(`Image download failed for ${id} with ${response.status} ${response.statusText}.`);
  }

  await writeFile(
    imagePath(imageDirectory, id),
    Buffer.from(await response.arrayBuffer()),
    { flag: "wx" },
  );
}

export async function findMissingImageIds(scryfallIds, imageDirectory) {
  await mkdir(imageDirectory, { recursive: true });

  const missingIds = [];
  for (const id of scryfallIds) {
    if (!(await exists(imagePath(imageDirectory, id)))) missingIds.push(id);
  }

  return missingIds;
}

export async function cacheMissingImages(missingIds, cardsById, imageDirectory) {
  if (missingIds.length === 0) return;

  console.log(`Downloading ${missingIds.length} new card images from Scryfall...`);
  const downloads = missingIds.map((id) => {
    const url = displayImageUrl(cardsById.get(id));
    if (!url) throw new Error(`Scryfall has no display image for ${id}.`);
    return { id, url };
  });

  for (let index = 0; index < downloads.length; index += DOWNLOAD_BATCH_SIZE) {
    await Promise.all(
      downloads
        .slice(index, index + DOWNLOAD_BATCH_SIZE)
        .map(({ id, url }) => downloadImage(imageDirectory, id, url)),
    );
    const completed = Math.min(index + DOWNLOAD_BATCH_SIZE, downloads.length);
    const percentage = Math.round((completed / downloads.length) * 100);
    console.log(`Downloaded ${completed}/${downloads.length} card images (${percentage}%)...`);
  }
}

export async function removeStaleImages(scryfallIds, imageDirectory) {
  const expectedImages = new Set(scryfallIds.map((id) => `${id}.webp`));
  const staleImages = (await readdir(imageDirectory)).filter(
    (file) => file.endsWith(".webp") && !expectedImages.has(file),
  );
  await Promise.all(
    staleImages.map((file) => rm(path.join(imageDirectory, file), { force: true })),
  );
  return staleImages.length;
}
