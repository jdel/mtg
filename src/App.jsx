import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Table,
  Text,
  TextField,
  Theme,
} from "@radix-ui/themes";
import { ArrowDown, ArrowUp, Check, Cog, Copy, ListFilter, Mail, Moon, Mountain, Search, Sun, Trash2, X } from "lucide-react";
import SortButton from "./components/SortButton.jsx";
import {
  SORT_COLUMNS,
  cardKey,
  interestMessage,
  matchesSearch,
  sortCards,
} from "./lib/catalog.js";

const EMAIL = "i.am@fkn.ninja";
const CATALOG_URL = `${import.meta.env.BASE_URL}data/cards.json`;
const COLOR_FILTERS = [
  { value: "W", label: "White" },
  { value: "U", label: "Blue" },
  { value: "B", label: "Black" },
  { value: "R", label: "Red" },
  { value: "G", label: "Green" },
];
const TYPE_FILTERS = [
  { value: "artifact", label: "Artifact", Icon: Cog },
  { value: "land", label: "Land", Icon: Mountain },
];
const THEME_STORAGE_KEY = "mtg-card-list-theme";
const SELECTION_STORAGE_KEY = "mtg-card-list-selection";
const PREVIEW_WIDTH = 244;
const PREVIEW_HEIGHT = 340;
const PREVIEW_OFFSET = 18;
const PREVIEW_MARGIN = 12;
const COMPACT_VIEW_QUERY = "(max-width: 899px)";
const RESULT_BATCH_SIZE = 60;

function preferredAppearance() {
  const savedAppearance = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedAppearance === "light" || savedAppearance === "dark") return savedAppearance;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isMobileViewport() {
  return window.matchMedia(COMPACT_VIEW_QUERY).matches;
}

function storedSelection(cardKeys) {
  const selection = new Set();

  try {
    const storedKeys = JSON.parse(window.localStorage.getItem(SELECTION_STORAGE_KEY) ?? "[]");
    if (Array.isArray(storedKeys)) {
      for (const key of storedKeys) {
        if (typeof key === "string" && cardKeys.has(key)) selection.add(key);
      }
    }
  } catch {
    // Invalid stored data is replaced with an empty selection below.
  }

  window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify([...selection]));
  return selection;
}

function App() {
  const [cards, setCards] = useState(null);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      try {
        const response = await fetch(CATALOG_URL, {
          cache: "no-cache",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Catalog request failed with ${response.status}.`);

        const catalog = await response.json();
        if (!Array.isArray(catalog)) throw new Error("Catalog response is not an array.");
        setCards(catalog);
      } catch (error) {
        if (error.name !== "AbortError") setCatalogError(true);
      }
    }

    loadCatalog();
    return () => controller.abort();
  }, []);

  if (catalogError) {
    return <CatalogState title="Unable to load cards">Refresh the page to try again.</CatalogState>;
  }
  if (!cards) return <CatalogState title="Loading cards…" />;

  return <Catalog cards={cards} />;
}

function CatalogState({ children, title }) {
  return (
    <Theme
      accentColor="grass"
      appearance={preferredAppearance()}
      className="app-theme"
      grayColor="sage"
      panelBackground="solid"
      radius="large"
      scaling="100%"
    >
      <main className="catalog-state" role={children ? "alert" : "status"}>
        <Heading size="5">{title}</Heading>
        {children && <Text color="gray">{children}</Text>}
      </main>
    </Theme>
  );
}

function Catalog({ cards }) {
  const setCodes = useMemo(() => [...new Set(cards.map((card) => card.setCode))].sort(), [cards]);
  const cardKeys = useMemo(() => new Set(cards.map(cardKey)), [cards]);
  const [appearance, setAppearance] = useState(preferredAppearance);
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState("");
  const [foilOnly, setFoilOnly] = useState(false);
  const [cardFilters, setCardFilters] = useState(new Set());
  const [sort, setSort] = useState({ column: "name", direction: "asc" });
  const [selected, setSelected] = useState(() => storedSelection(cardKeys));
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(null);
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [loadedResults, setLoadedResults] = useState({ key: "", count: RESULT_BATCH_SIZE });
  const loadMoreRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.colorScheme = appearance;
  }, [appearance]);

  useEffect(() => {
    window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify([...selected]));
  }, [selected]);

  useEffect(() => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return undefined;

    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const followSystemAppearance = (event) => setAppearance(event.matches ? "dark" : "light");
    preference.addEventListener("change", followSystemAppearance);
    return () => preference.removeEventListener("change", followSystemAppearance);
  }, []);

  useEffect(() => {
    const viewport = window.matchMedia(COMPACT_VIEW_QUERY);
    const followViewport = (event) => {
      setIsMobile(event.matches);
      if (event.matches) setPreview(null);
    };
    viewport.addEventListener("change", followViewport);
    return () => viewport.removeEventListener("change", followViewport);
  }, []);

  const visibleCards = useMemo(
    () =>
      sortCards(
        cards.filter(
          (card) =>
            matchesSearch(card, query) &&
            card.setCode.includes(setFilter.trim().toUpperCase()) &&
            (!foilOnly || card.foil) &&
            [...cardFilters].every((filter) => {
              if (filter === "artifact") return card.typeLine.includes("Artifact");
              if (filter === "land") return card.typeLine.includes("Land");
              return card.colors.includes(filter);
            }),
        ),
        sort,
      ),
    [cardFilters, cards, foilOnly, query, setFilter, sort],
  );
  const resultKey = [
    query,
    setFilter,
    foilOnly,
    [...cardFilters].sort().join(","),
    sort.column,
    sort.direction,
  ].join("\u0000");
  const loadedCount = loadedResults.key === resultKey
    ? loadedResults.count
    : RESULT_BATCH_SIZE;
  const renderedCards = visibleCards.slice(0, loadedCount);
  const hasMoreResults = renderedCards.length < visibleCards.length;
  const selectedCards = cards.filter((card) => selected.has(cardKey(card)));

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMoreResults) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setLoadedResults((current) => {
          const currentCount = current.key === resultKey
            ? current.count
            : RESULT_BATCH_SIZE;
          return {
            key: resultKey,
            count: Math.min(currentCount + RESULT_BATCH_SIZE, visibleCards.length),
          };
        });
      },
      { rootMargin: "800px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreResults, isMobile, resultKey, visibleCards.length]);

  function toggleSort(column) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function toggleCard(card, checked) {
    const key = cardKey(card);
    setSelected((current) => {
      const next = new Set(current);
      checked ? next.add(key) : next.delete(key);
      return next;
    });
  }

  function toggleCardFilter(filter) {
    setCardFilters((current) => {
      const next = new Set(current);
      next.has(filter) ? next.delete(filter) : next.add(filter);
      return next;
    });
  }

  function toggleAppearance() {
    setAppearance((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }

  function movePreview(card, event) {
    if (window.matchMedia(COMPACT_VIEW_QUERY).matches || window.matchMedia("(hover: none)").matches) {
      setPreview(null);
      return;
    }

    const fitsRight = event.clientX + PREVIEW_OFFSET + PREVIEW_WIDTH <= window.innerWidth - PREVIEW_MARGIN;
    const fitsBelow = event.clientY + PREVIEW_OFFSET + PREVIEW_HEIGHT <= window.innerHeight - PREVIEW_MARGIN;
    const left = fitsRight
      ? event.clientX + PREVIEW_OFFSET
      : event.clientX - PREVIEW_OFFSET - PREVIEW_WIDTH;
    const top = fitsBelow
      ? event.clientY + PREVIEW_OFFSET
      : event.clientY - PREVIEW_OFFSET - PREVIEW_HEIGHT;

    setPreview({
      card,
      left: Math.max(PREVIEW_MARGIN, left),
      top: Math.max(PREVIEW_MARGIN, top),
    });
  }

  async function copyInterestList() {
    await navigator.clipboard.writeText(interestMessage(selectedCards));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent(
    `Card interest — ${selectedCards.length} card${selectedCards.length === 1 ? "" : "s"}`,
  )}&body=${encodeURIComponent(interestMessage(selectedCards))}`;

  return (
    <Theme
      accentColor="grass"
      appearance={appearance}
      className="app-theme"
      grayColor="sage"
      panelBackground="solid"
      radius="large"
      scaling="100%"
    >
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-summary">
            <Text as="p" className="eyebrow">BROWSE</Text>
            <Text as="p" className="topbar-count" color="gray" size="2">
              {visibleCards.length} of {cards.length} cards
            </Text>
          </div>
          <div className="topbar-actions">
            <Button
              aria-label="Remove all selected cards"
              className="clear-selection"
              color="red"
              disabled={selectedCards.length === 0}
              onClick={() => setSelected(new Set())}
              size="3"
              variant="soft"
            >
              <Trash2 aria-hidden="true" size={17} />
              <span className="clear-selection-label">Remove all</span>
            </Button>
            <InterestDialog
              copied={copied}
              copyInterestList={copyInterestList}
              mailto={mailto}
              selectedCards={selectedCards}
            />
            <IconButton
              aria-label={`Switch to ${appearance === "dark" ? "light" : "dark"} theme`}
              color="gray"
              highContrast
              onClick={toggleAppearance}
              size="3"
              variant="soft"
            >
              {appearance === "dark" ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
            </IconButton>
          </div>
        </div>
      </header>

      <div className="site-shell">
        <main>
          <section className="catalog" aria-label="Available cards">
            <Flex align="end" className="catalog-toolbar" gap="4" justify="between" wrap="wrap">
              <div className="filters">
                <TextField.Root
                  aria-label="Search cards"
                  className="search-input"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or card number, e.g. TRK 110"
                  size="3"
                  value={query}
                >
                  <TextField.Slot><Search aria-hidden="true" size={20} /></TextField.Slot>
                  {query && (
                    <TextField.Slot>
                      <IconButton
                        aria-label="Clear search"
                        color="gray"
                        onClick={() => setQuery("")}
                        size="1"
                        variant="ghost"
                      >
                        <X size={16} />
                      </IconButton>
                    </TextField.Slot>
                  )}
                </TextField.Root>

                <TextField.Root
                  aria-label="Filter by set code"
                  autoComplete="off"
                  className="set-filter-input"
                  list="set-code-options"
                  onChange={(event) => setSetFilter(event.target.value)}
                  placeholder="All set codes"
                  size="3"
                  value={setFilter}
                >
                  <TextField.Slot><ListFilter aria-hidden="true" size={18} /></TextField.Slot>
                  {setFilter && (
                    <TextField.Slot>
                      <IconButton
                        aria-label="Clear set filter"
                        color="gray"
                        onClick={() => setSetFilter("")}
                        size="1"
                        variant="ghost"
                      >
                        <X size={16} />
                      </IconButton>
                    </TextField.Slot>
                  )}
                </TextField.Root>
                <datalist id="set-code-options">
                  {setCodes.map((setCode) => <option key={setCode} value={setCode} />)}
                </datalist>

                <div className="mobile-filter-row">
                  <div aria-label="Filter by color and type" className="card-filters" role="group">
                    {COLOR_FILTERS.map(({ value, label }) => (
                      <IconButton
                        aria-label={label}
                        aria-pressed={cardFilters.has(value)}
                        className="card-filter-button"
                        color="gray"
                        key={value}
                        onClick={() => toggleCardFilter(value)}
                        size="2"
                        title={label}
                        variant="ghost"
                      >
                        <img
                          alt=""
                          aria-hidden="true"
                          className="filter-symbol"
                          src={`${import.meta.env.BASE_URL}symbols/${value}.svg`}
                        />
                      </IconButton>
                    ))}
                    {TYPE_FILTERS.map(({ value, label, Icon }) => (
                      <IconButton
                        aria-label={label}
                        aria-pressed={cardFilters.has(value)}
                        className="card-filter-button"
                        color="gray"
                        key={value}
                        onClick={() => toggleCardFilter(value)}
                        size="2"
                        title={label}
                        variant="ghost"
                      >
                        <Icon aria-hidden="true" className="filter-type-icon" size={22} />
                      </IconButton>
                    ))}
                    <button
                      aria-label="Foil only"
                      aria-pressed={foilOnly}
                      className="card-filter-button foil-filter-button"
                      onClick={() => setFoilOnly((current) => !current)}
                      title="Foil only"
                      type="button"
                    >
                      <img
                        alt=""
                        aria-hidden="true"
                        className="filter-foil-icon"
                        src={`${import.meta.env.BASE_URL}symbols/foil.png`}
                      />
                    </button>
                  </div>

                  <div className="mobile-sort-control">
                    <select
                      aria-label="Sort cards by"
                      className="mobile-sort-select"
                      onChange={(event) =>
                        setSort((current) => ({
                          column: event.target.value,
                          direction: current.column === event.target.value ? current.direction : "asc",
                        }))
                      }
                      value={sort.column}
                    >
                      {Object.entries(SORT_COLUMNS).map(([column, config]) => (
                        <option key={column} value={column}>{config.label}</option>
                      ))}
                    </select>
                    <IconButton
                      aria-label={`Sort ${sort.direction === "asc" ? "descending" : "ascending"}`}
                      color="gray"
                      onClick={() => toggleSort(sort.column)}
                      size="2"
                      variant="soft"
                    >
                      {sort.direction === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </IconButton>
                  </div>
                </div>
              </div>

            </Flex>

            {visibleCards.length === 0 ? (
              <div className="table-frame">
                <div className="empty-state">
                  <Search aria-hidden="true" size={24} />
                  <Heading as="h3" size="4">No matching cards</Heading>
                  <Text color="gray" size="2">Try a name, set code, or collector number.</Text>
                  <Button
                    color="gray"
                    onClick={() => {
                      setQuery("");
                      setSetFilter("");
                      setFoilOnly(false);
                      setCardFilters(new Set());
                    }}
                    variant="soft"
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
            ) : isMobile ? (
              <div aria-label="Cards" aria-multiselectable="true" className="mobile-card-list" role="listbox">
                {renderedCards.map((card) => {
                  const key = cardKey(card);
                  const isSelected = selected.has(key);
                  return (
                    <div
                      aria-selected={isSelected}
                      className={`mobile-card${isSelected ? " selected-card" : ""}`}
                      key={key}
                      onClick={() => toggleCard(card, !isSelected)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleCard(card, !isSelected);
                        }
                      }}
                      role="option"
                      tabIndex={0}
                    >
                      <span className="card-title mobile-card-title">
                        <span className="card-name">
                          {card.name}
                          {card.foil && (
                            <img
                              alt="Foil"
                              className="foil-icon"
                              src={`${import.meta.env.BASE_URL}symbols/foil.png`}
                              title="Foil"
                            />
                          )}
                        </span>
                        {card.secondaryName && (
                          <span className="secondary-card-name">{card.secondaryName}</span>
                        )}
                      </span>
                      <div className="mobile-card-meta">
                        <span className="collector-number">#{card.collectorNumber}</span>
                        <Badge className="mobile-card-set" color="gray" highContrast>{card.setCode}</Badge>
                        <span>{card.language.toUpperCase()}</span>
                        <span className="mobile-card-quantity">x{String(card.quantity).padStart(2, "0")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="table-frame">
                <Table.Root className="card-table" variant="surface">
                <Table.Header>
                  <Table.Row>
                    {Object.entries(SORT_COLUMNS).map(([column, config]) => (
                      <Table.ColumnHeaderCell
                        aria-sort={
                          sort.column === column
                            ? sort.direction === "asc" ? "ascending" : "descending"
                            : "none"
                        }
                        key={column}
                      >
                        <SortButton
                          active={sort.column === column}
                          direction={sort.direction}
                          onClick={() => toggleSort(column)}
                        >
                          {config.label}
                        </SortButton>
                      </Table.ColumnHeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {renderedCards.map((card) => {
                    const key = cardKey(card);
                    const isSelected = selected.has(key);
                    return (
                      <Table.Row
                        aria-selected={isSelected}
                        className={isSelected ? "selected-row" : undefined}
                        key={key}
                        onClick={() => toggleCard(card, !isSelected)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleCard(card, !isSelected);
                          }
                        }}
                        onMouseEnter={(event) => movePreview(card, event)}
                        onMouseLeave={() => setPreview(null)}
                        onMouseMove={(event) => movePreview(card, event)}
                        tabIndex={0}
                      >
                        <Table.RowHeaderCell>
                          <span className="card-title">
                            <span className="card-name">
                              {card.name}
                              {card.foil && (
                                <img
                                  alt="Foil"
                                  className="foil-icon"
                                  src={`${import.meta.env.BASE_URL}symbols/foil.png`}
                                  title="Foil"
                                />
                              )}
                            </span>
                            {card.secondaryName && (
                              <span className="secondary-card-name">{card.secondaryName}</span>
                            )}
                          </span>
                        </Table.RowHeaderCell>
                        <Table.Cell><Badge color="gray" highContrast>{card.setCode}</Badge></Table.Cell>
                        <Table.Cell className="collector-number">#{card.collectorNumber}</Table.Cell>
                        <Table.Cell className="quantity-cell">
                          <span className="mobile-cell-label">Qty</span>
                          {card.quantity}
                        </Table.Cell>
                        <Table.Cell className="language-cell">{card.language.toUpperCase()}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
                </Table.Root>
              </div>
            )}
            {hasMoreResults && (
              <div aria-hidden="true" className="load-more-sentinel" ref={loadMoreRef} />
            )}
          </section>
        </main>
        <footer className="site-footer">
          <a
            className="github-link"
            href="https://github.com/jdel/mtg"
            rel="noreferrer"
            target="_blank"
          >
            <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297z"
                fill="currentColor"
              />
            </svg>
            View on GitHub
          </a>
        </footer>
      </div>

      {preview && (
        <div
          aria-hidden="true"
          className="card-preview"
          style={{ left: preview.left, top: preview.top }}
        >
          <img
            alt=""
            height={PREVIEW_HEIGHT}
            src={`${import.meta.env.BASE_URL}${preview.card.image}`}
            width={PREVIEW_WIDTH}
          />
        </div>
      )}
    </Theme>
  );
}

function InterestDialog({
  copied,
  copyInterestList,
  mailto,
  selectedCards,
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button
          aria-label={`Review ${selectedCards.length} selected card${selectedCards.length === 1 ? "" : "s"}`}
          className="interest-trigger"
          disabled={selectedCards.length === 0}
          size="3"
        >
          <Mail aria-hidden="true" size={17} />
          <span className="interest-label">I’m interested</span>
          <Badge className="interest-count" color="gray" highContrast radius="full" variant="solid">
            {selectedCards.length}
          </Badge>
        </Button>
      </Dialog.Trigger>
      <Dialog.Content className="interest-dialog" maxWidth="540px">
        <Dialog.Title>Interested cards</Dialog.Title>
        <Dialog.Description color="gray" size="2">
          Review your selection, then send a prefilled email or copy the list.
        </Dialog.Description>

        <div className="interest-list">
          {selectedCards.map((card) => (
            <div className="interest-item" key={cardKey(card)}>
              <Text as="p" weight="medium">{card.name}</Text>
              <Text as="p" color="gray" size="2">
                {card.setCode} #{card.collectorNumber} · {card.language.toUpperCase()}
                {card.foil ? " · Foil" : ""} · {card.quantity} available
              </Text>
            </div>
          ))}
        </div>
        <Flex className="interest-actions" gap="3" mt="5" wrap="wrap">
          <Button asChild size="3">
            <a href={mailto}>
              <Mail aria-hidden="true" size={17} />
              Send email
            </a>
          </Button>
          <Button color="gray" onClick={copyInterestList} size="3" variant="soft">
            {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
            {copied ? "Copied" : "Copy list"}
          </Button>
        </Flex>
        <Dialog.Close>
          <IconButton aria-label="Close interest list" className="dialog-close" color="gray" variant="ghost">
            <X size={18} />
          </IconButton>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export default App;
