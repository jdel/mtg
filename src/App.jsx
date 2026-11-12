import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Select,
  Table,
  Text,
  TextField,
  Theme,
} from "@radix-ui/themes";
import { ArrowDown, ArrowUp, Check, CircleHelp, Cog, Copy, Eye, ListFilter, Mail, Moon, Mountain, Search, Sun, Trash2, X } from "lucide-react";
import SortButton from "./components/SortButton.jsx";
import {
  SORT_COLUMNS,
  cardKey,
  interestMessage,
  matchesSearch,
  sortCards,
} from "./lib/catalog.js";

const CATALOG_URL = `${import.meta.env.BASE_URL}data/cards.json`;
const CONFIG_URL = `${import.meta.env.BASE_URL}config.json`;
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
const CARD_CAROUSEL_GAP = 24;
const TAP_MOVE_THRESHOLD = 8;
const SWIPE_THRESHOLD = 50;
const SWIPE_CLOSE_THRESHOLD = 80;

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
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAppData() {
      try {
        const [catalogResponse, configResponse] = await Promise.all(
          [CATALOG_URL, CONFIG_URL].map((url) => fetch(url, {
            cache: "no-cache",
            signal: controller.signal,
          })),
        );
        if (!catalogResponse.ok) {
          throw new Error(`Catalog request failed with ${catalogResponse.status}.`);
        }
        if (!configResponse.ok) {
          throw new Error(`Configuration request failed with ${configResponse.status}.`);
        }

        const [catalog, appConfig] = await Promise.all([
          catalogResponse.json(),
          configResponse.json(),
        ]);
        if (!Array.isArray(catalog)) throw new Error("Catalog response is not an array.");
        if (typeof appConfig.email !== "string" || !appConfig.email.trim()) {
          throw new Error("Configuration email is missing.");
        }
        setCards(catalog);
        setConfig({ email: appConfig.email.trim() });
      } catch (error) {
        if (error.name !== "AbortError") setLoadError(true);
      }
    }

    loadAppData();
    return () => controller.abort();
  }, []);

  if (loadError) {
    return <CatalogState title="Unable to load site">Refresh the page to try again.</CatalogState>;
  }
  if (!cards || !config) return <CatalogState title="Loading cards…" />;

  return <Catalog cards={cards} email={config.email} />;
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

function Catalog({ cards, email }) {
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
  const [imagePreviewCard, setImagePreviewCard] = useState(null);
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
      else setImagePreviewCard(null);
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
  const imagePreviewIndex = imagePreviewCard
    ? visibleCards.findIndex((card) => cardKey(card) === cardKey(imagePreviewCard))
    : -1;

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

  function navigateImagePreview(direction) {
    setImagePreviewCard((current) => {
      if (!current) return null;

      const currentKey = cardKey(current);
      const currentIndex = visibleCards.findIndex((card) => cardKey(card) === currentKey);
      const nextCard = visibleCards[currentIndex + direction];
      return nextCard ?? current;
    });
  }

  async function copyInterestList() {
    await navigator.clipboard.writeText(interestMessage(selectedCards));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const mailto = `mailto:${email}?subject=${encodeURIComponent(
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
            <HelpDialog />
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

                <div className="mobile-select-row">
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

                  <div className="mobile-sort-control">
                    <Select.Root
                      onValueChange={(value) =>
                        setSort((current) => ({
                          column: value,
                          direction: current.column === value ? current.direction : "asc",
                        }))
                      }
                      size="3"
                      value={sort.column}
                    >
                      <Select.Trigger aria-label="Sort cards by" className="mobile-sort-select" />
                      <Select.Content position="popper">
                        {Object.entries(SORT_COLUMNS).map(([column, config]) => (
                          <Select.Item key={column} value={column}>{config.label}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
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
              <div aria-label="Cards" className="mobile-card-list" role="list">
                {renderedCards.map((card) => {
                  const key = cardKey(card);
                  const isSelected = selected.has(key);
                  return (
                    <div
                      className={`mobile-card${isSelected ? " selected-card" : ""}`}
                      key={key}
                      role="listitem"
                    >
                      <IconButton
                        aria-label={`View image of ${card.name}`}
                        className="mobile-card-image-button"
                        color="gray"
                        onClick={() => setImagePreviewCard(card)}
                        size="3"
                        variant="ghost"
                      >
                        <Eye aria-hidden="true" size={20} />
                      </IconButton>
                      <button
                        aria-pressed={isSelected}
                        className="mobile-card-selection"
                        onClick={() => toggleCard(card, !isSelected)}
                        type="button"
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
                        <span className="mobile-card-meta">
                          <span className="collector-number">#{card.collectorNumber}</span>
                          <Badge className="mobile-card-set" color="gray" highContrast>{card.setCode}</Badge>
                          <span>{card.language.toUpperCase()}</span>
                          <span className="mobile-card-quantity">x{String(card.quantity).padStart(2, "0")}</span>
                        </span>
                      </button>
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
          <span className="ai-credit">
            <svg
              aria-hidden="true"
              className="slop-stamp"
              viewBox="0 0 84 28"
            >
              <g fill="none" stroke="currentColor" transform="rotate(-3 42 14)">
                <rect height="25" rx="5" strokeWidth="1.8" width="81" x="1.5" y="1.5" />
                <rect height="20" rx="3.5" strokeDasharray="1.5 2.2" strokeWidth="1.2" width="76" x="4" y="4" />
              </g>
              <g fill="currentColor" textAnchor="middle" transform="rotate(-3 42 14)">
                <text x="42" y="17">100% SLOP</text>
              </g>
            </svg>
          </span>
          <a
            className="github-link"
            href="https://github.com/jdel/mtg"
            rel="noreferrer"
            target="_blank"
          >
            Fork me
            <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297z"
                fill="currentColor"
              />
            </svg>
          </a>
          <a
            aria-label="Magic: The Gathering card designs and related materials are property of Wizards of the Coast"
            className="wizards-notice"
            href="https://company.wizards.com/en/legal/fancontentpolicy"
            rel="noreferrer"
            target="_blank"
          >
            Card designs © Wizards
          </a>
          <IconButton
            aria-label="Scroll to top of card list"
            className="scroll-top-button"
            color="gray"
            onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })}
            size="1"
            variant="ghost"
          >
            <ArrowUp aria-hidden="true" size={15} />
          </IconButton>
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
      <CardImageDialog
        card={imagePreviewCard}
        canNavigateNext={imagePreviewIndex >= 0 && imagePreviewIndex < visibleCards.length - 1}
        canNavigatePrevious={imagePreviewIndex > 0}
        isAdded={imagePreviewCard ? selected.has(cardKey(imagePreviewCard)) : false}
        nextCard={imagePreviewIndex >= 0 ? visibleCards[imagePreviewIndex + 1] : null}
        nextCardIsAdded={imagePreviewIndex >= 0 && imagePreviewIndex < visibleCards.length - 1
          ? selected.has(cardKey(visibleCards[imagePreviewIndex + 1]))
          : false}
        onOpenChange={(open) => {
          if (!open) setImagePreviewCard(null);
        }}
        onNavigate={navigateImagePreview}
        onToggle={(card, added) => toggleCard(card, added)}
        previousCard={imagePreviewIndex > 0 ? visibleCards[imagePreviewIndex - 1] : null}
        previousCardIsAdded={imagePreviewIndex > 0 ? selected.has(cardKey(visibleCards[imagePreviewIndex - 1])) : false}
      />
    </Theme>
  );
}

function CardImageDialog({
  canNavigateNext,
  canNavigatePrevious,
  card,
  isAdded,
  nextCard,
  nextCardIsAdded,
  onNavigate,
  onOpenChange,
  onToggle,
  previousCard,
  previousCardIsAdded,
}) {
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const swipeAxis = useRef(null);
  const swipeStart = useRef(null);
  const ignoreClickUntil = useRef(0);
  const isOpen = Boolean(card);

  useEffect(() => {
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
  }, [isOpen]);

  function cancelSwipe() {
    swipeAxis.current = null;
    swipeStart.current = null;
    setDragX(0);
    setDragY(0);
    setIsDragging(false);
  }

  function finishSwipe(event) {
    if (!swipeStart.current) return;

    const distanceX = event.clientX - swipeStart.current.x;
    const distanceY = event.clientY - swipeStart.current.y;
    const axis = swipeAxis.current ?? (Math.abs(distanceY) > Math.abs(distanceX) ? "vertical" : "horizontal");
    swipeAxis.current = null;
    swipeStart.current = null;

    if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) >= TAP_MOVE_THRESHOLD) {
      ignoreClickUntil.current = performance.now() + 300;
    }

    if (axis === "vertical") {
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
      if (distanceY >= SWIPE_CLOSE_THRESHOLD) onOpenChange(false);
      return;
    }
    if (Math.abs(distanceX) < SWIPE_THRESHOLD) {
      cancelSwipe();
      return;
    }

    const direction = distanceX < 0 ? 1 : -1;
    const canNavigate = direction > 0 ? canNavigateNext : canNavigatePrevious;
    if (!canNavigate) {
      cancelSwipe();
      return;
    }

    const dialogWidth = event.currentTarget.closest(".card-image-dialog").getBoundingClientRect().width;
    const carouselDistance = dialogWidth + CARD_CAROUSEL_GAP;
    setDragX((direction > 0 ? carouselDistance : -carouselDistance) + distanceX);
    setDragY(0);
    setIsDragging(true);
    onNavigate(direction);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setDragX(0);
        setIsDragging(false);
      });
    });
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={Boolean(card)}>
      {card && (
        <Dialog.Content
          className={`card-image-dialog${isDragging ? " is-dragging" : ""}`}
          maxWidth="420px"
          style={{
            "--card-carousel-gap": `${CARD_CAROUSEL_GAP}px`,
            transform: `translate(${dragX}px, ${dragY}px)`,
          }}
        >
          {previousCard && (
            <CardImageDialogNeighbor
              card={previousCard}
              isAdded={previousCardIsAdded}
              position="previous"
            />
          )}
          {nextCard && (
            <CardImageDialogNeighbor
              card={nextCard}
              isAdded={nextCardIsAdded}
              position="next"
            />
          )}
          <Dialog.Title className="card-image-dialog-title">{card.name}</Dialog.Title>
          <div className="card-image-dialog-subtitle">
            <Dialog.Description className="card-image-dialog-meta" color="gray" size="2">
              <CardImageDialogMeta card={card} />
            </Dialog.Description>
            {isAdded && <Badge color="grass">Added</Badge>}
          </div>
          <button
            aria-label={`${isAdded ? "Remove" : "Add"} ${card.name} ${isAdded ? "from" : "to"} the interest list`}
            aria-pressed={isAdded}
            className="card-image-dialog-button"
            onClick={() => {
              if (performance.now() < ignoreClickUntil.current) return;
              onToggle(card, !isAdded);
            }}
            onPointerCancel={cancelSwipe}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse") return;
              swipeAxis.current = null;
              swipeStart.current = { x: event.clientX, y: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!swipeStart.current) return;

              const distanceX = event.clientX - swipeStart.current.x;
              const distanceY = event.clientY - swipeStart.current.y;
              if (!swipeAxis.current) {
                if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < TAP_MOVE_THRESHOLD) return;
                swipeAxis.current = Math.abs(distanceY) > Math.abs(distanceX)
                  ? "vertical"
                  : "horizontal";
              }

              if (swipeAxis.current === "vertical") {
                setDragX(0);
                setDragY(distanceY);
              } else {
                setDragX(distanceX);
                setDragY(0);
              }
              setIsDragging(true);
            }}
            onPointerUp={finishSwipe}
            type="button"
          >
            <img
              alt={`${card.name} card`}
              className="card-image-dialog-image"
              draggable="false"
              src={`${import.meta.env.BASE_URL}${card.image}`}
            />
          </button>
        </Dialog.Content>
      )}
    </Dialog.Root>
  );
}

function CardImageDialogNeighbor({ card, isAdded, position }) {
  return (
    <div
      aria-hidden="true"
      className={`card-image-dialog-neighbor ${position}`}
    >
      <Heading as="div" mb="3" size="5" trim="start">{card.name}</Heading>
      <div className="card-image-dialog-subtitle">
        <Text as="div" className="card-image-dialog-meta" color="gray" size="2">
          <CardImageDialogMeta card={card} />
        </Text>
        {isAdded && <Badge color="grass">Added</Badge>}
      </div>
      <img
        alt=""
        className="card-image-dialog-neighbor-image"
        draggable="false"
        src={`${import.meta.env.BASE_URL}${card.image}`}
      />
    </div>
  );
}

function CardImageDialogMeta({ card }) {
  return (
    <>
      <span className="collector-number">#{card.collectorNumber}</span>
      <Badge className="mobile-card-set" color="gray" highContrast>{card.setCode}</Badge>
      <span>{card.language.toUpperCase()}</span>
      <span className="mobile-card-quantity">x{String(card.quantity).padStart(2, "0")}</span>
      {card.foil && (
        <img
          alt="Foil"
          className="foil-icon"
          src={`${import.meta.env.BASE_URL}symbols/foil.png`}
          title="Foil"
        />
      )}
    </>
  );
}

function HelpDialog() {
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);

  function resetDrag() {
    dragStart.current = null;
    setDragY(0);
    setIsDragging(false);
  }

  function changeOpen(nextOpen) {
    if (nextOpen) resetDrag();
    else {
      dragStart.current = null;
      setIsDragging(false);
    }
    setOpen(nextOpen);
  }

  return (
    <Dialog.Root onOpenChange={changeOpen} open={open}>
      <Dialog.Trigger>
        <IconButton
          aria-label="How card requests work"
          color="gray"
          highContrast
          size="3"
          variant="soft"
        >
          <CircleHelp aria-hidden="true" size={18} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content
        className={`help-dialog${isDragging ? " is-dragging" : ""}`}
        maxWidth="460px"
        onPointerCancel={resetDrag}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          dragStart.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragStart.current) return;

          const distanceX = event.clientX - dragStart.current.x;
          const distanceY = event.clientY - dragStart.current.y;
          if (distanceY <= 0 || Math.abs(distanceX) >= distanceY) return;
          setDragY(distanceY);
          setIsDragging(true);
        }}
        onPointerUp={(event) => {
          if (!dragStart.current) return;

          const distanceX = event.clientX - dragStart.current.x;
          const distanceY = event.clientY - dragStart.current.y;
          dragStart.current = null;
          if (distanceY >= SWIPE_CLOSE_THRESHOLD && distanceY > Math.abs(distanceX)) {
            changeOpen(false);
          } else {
            setDragY(0);
            setIsDragging(false);
          }
        }}
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <Dialog.Title className="visually-hidden">How card requests work</Dialog.Title>
        <Dialog.Description as="div" className="help-dialog-copy" size="3">
          <p>This is not a marketplace and only aims to facilitate in-person deals.</p>
          <p>
            Select the cards you&apos;re interested in, click I&apos;m interested, then send an
            email or copy the list to send with your preferred channel.
          </p>
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Root>
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
            <span className="copy-interest-label">
              <span>{copied ? "Copied" : "Copy list"}</span>
            </span>
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
