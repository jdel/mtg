const REQUIRED_COLUMNS = [
  "Name",
  "Set code",
  "Collector number",
  "Foil",
  "Quantity",
  "Scryfall ID",
  "Language",
];

export function parseCsv(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("CSV ended inside a quoted value.");
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

export function toCatalog(rows) {
  if (rows.length < 2) {
    throw new Error("The CSV must contain a header and at least one card.");
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  const indexes = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, headers.indexOf(column)]),
  );
  const missing = REQUIRED_COLUMNS.filter((column) => indexes[column] === -1);

  if (missing.length > 0) {
    throw new Error(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  }

  const cards = [];

  for (const [rowIndex, row] of rows.slice(1).entries()) {
    if (row.every((cell) => cell.trim() === "")) continue;

    if (REQUIRED_COLUMNS.some((column) => row[indexes[column]] === undefined)) {
      throw new Error(`Missing required value on CSV row ${rowIndex + 2}.`);
    }

    const quantityValue = row[indexes.Quantity].trim();
    const quantity = Number(quantityValue);
    if (quantityValue === "" || !Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Invalid quantity on CSV row ${rowIndex + 2}.`);
    }

    const finish = row[indexes.Foil].trim().toLowerCase();
    const card = {
      name: row[indexes.Name].trim(),
      setCode: row[indexes["Set code"]].trim().toUpperCase(),
      collectorNumber: row[indexes["Collector number"]].trim(),
      foil: finish !== "normal",
      quantity,
      scryfallId: row[indexes["Scryfall ID"]].trim().toLowerCase(),
      language: row[indexes.Language].trim(),
    };

    if (
      !card.name ||
      !card.setCode ||
      !card.collectorNumber ||
      !finish ||
      !card.scryfallId ||
      !card.language
    ) {
      throw new Error(`Missing required value on CSV row ${rowIndex + 2}.`);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(card.scryfallId)) {
      throw new Error(`Invalid Scryfall ID on CSV row ${rowIndex + 2}.`);
    }

    cards.push(card);
  }

  if (cards.length === 0) {
    throw new Error("The CSV must contain a header and at least one card.");
  }

  return mergeCatalogs(cards);
}

export function mergeCatalogs(cards) {
  const merged = new Map();

  for (const card of cards) {
    const key = JSON.stringify([
      card.name,
      card.setCode,
      card.collectorNumber,
      card.foil,
      card.language,
    ]);
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, quantity: existing.quantity + card.quantity } : card);
  }

  return [...merged.values()].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: "base" }),
  );
}
