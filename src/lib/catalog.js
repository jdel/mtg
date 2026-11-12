export const SORT_COLUMNS = {
  name: { label: "Name", type: "text" },
  setCode: { label: "Set code", type: "text" },
  collectorNumber: { label: "Number", type: "number" },
  quantity: { label: "Quantity", type: "number" },
  language: { label: "Language", type: "text" },
};

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCollector(value) {
  const normalized = normalizeText(value).replace(/\s+/g, "");
  return normalized.replace(/^(0+)(\d)/, "$2");
}

function normalizeCodeTerm(value) {
  const compact = normalizeText(value).replace(/\s+/g, "");
  const code = compact.match(/^([a-z]+)0*(\d.*)$/);
  return code ? `${code[1]}${normalizeCollector(code[2])}` : normalizeCollector(compact);
}

export function cardKey(card) {
  return JSON.stringify([card.name, card.setCode, card.collectorNumber, card.foil, card.language]);
}

function parseCardReference(query, setCodes) {
  const compactQuery = normalizeText(query).replace(/\s+/g, "");
  const normalizedSetCodes = setCodes
    .map((setCode) => normalizeText(setCode).replace(/\s+/g, ""))
    .filter(Boolean)
    .sort((first, second) => second.length - first.length);

  for (const setCode of normalizedSetCodes) {
    if (!compactQuery.startsWith(setCode)) continue;

    const collectorNumber = compactQuery.slice(setCode.length);
    if (/^\d+[a-z]?$/.test(collectorNumber)) {
      return { setCode, collectorNumber: normalizeCollector(collectorNumber) };
    }
  }

  return null;
}

export function matchesSearch(card, query, setCodes = []) {
  const terms = normalizeText(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const name = normalizeText(card.name);
  const secondaryName = normalizeText(card.secondaryName ?? "");
  const setCode = normalizeText(card.setCode);
  const collectorNumber = normalizeCollector(card.collectorNumber);
  const combinedCode = `${setCode}${collectorNumber}`;
  const cardReference = parseCardReference(query, setCodes);

  if (cardReference) {
    return setCode === cardReference.setCode && collectorNumber === cardReference.collectorNumber;
  }

  return terms.every((term) => {
    const normalizedTerm = normalizeCodeTerm(term);
    return (
      name.includes(term) ||
      secondaryName.includes(term) ||
      setCode.includes(term) ||
      collectorNumber.includes(normalizedTerm) ||
      combinedCode.includes(normalizedTerm)
    );
  });
}

export function parseMultipleSearch(value, cards) {
  const knownNames = [...new Map(
    cards.map((card) => [normalizeText(card.name), card.name]),
  ).entries()]
    .filter(([normalizedName]) => normalizedName)
    .sort((first, second) => second[0].length - first[0].length);
  const queries = new Map();

  for (const line of String(value).split(/\r?\n/)) {
    const withoutQuantity = line.replace(/^\s*\d+\s*x(?:\s+|$)/i, "");
    const normalizedLine = normalizeText(withoutQuantity);
    if (!normalizedLine) continue;

    const knownName = knownNames.find(
      ([normalizedName]) =>
        normalizedLine === normalizedName || normalizedLine.startsWith(`${normalizedName} `),
    );
    const query = knownName ? knownName[1] : withoutQuantity.trim();
    queries.set(normalizeText(query), query);
  }

  return [...queries.values()];
}

export function matchesMultipleSearch(card, queries, setCodes) {
  return queries === null || queries.some((query) => matchesSearch(card, query, setCodes));
}

export function sortCards(cards, sort) {
  const direction = sort.direction === "asc" ? 1 : -1;
  const type = SORT_COLUMNS[sort.column].type;

  return [...cards].sort((first, second) => {
    const left = first[sort.column];
    const right = second[sort.column];
    const comparison =
      type === "number" && sort.column === "quantity"
        ? left - right
        : String(left).localeCompare(String(right), undefined, {
            numeric: type === "number",
            sensitivity: "base",
          });
    return comparison * direction;
  });
}

export function selectionMessage(interestedCards, offeredCards) {
  const interestLines = interestedCards.map(
    (card) =>
      `- ${card.name} — ${card.setCode} #${card.collectorNumber}${card.foil ? " — FOIL" : ""} — available: ${card.quantity} — language: ${card.language.toUpperCase()}`,
  );
  const offerLines = offeredCards.map(
    (card) =>
      `- ${card.name} — ${card.setCode} #${card.collectorNumber}${card.foil ? " — FOIL" : ""} — wanted: ${card.quantity} — language: ${card.language.toUpperCase()}`,
  );
  const sections = [];

  if (interestLines.length > 0) {
    sections.push("I'm interested in these cards:", "", ...interestLines);
  }
  if (offerLines.length > 0) {
    if (sections.length > 0) sections.push("");
    sections.push("I have these cards you're looking for:", "", ...offerLines);
  }

  return [
    "Hi,",
    "",
    ...sections,
    "",
    "Let me know if you're interested.",
    "",
    "Thanks!",
  ].join("\n");
}
