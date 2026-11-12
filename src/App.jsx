import { useEffect, useMemo, useRef, useState } from "react";
import { Heading, Text, Theme } from "@radix-ui/themes";
import CardImageDialog from "./components/CardImageDialog.jsx";
import CardResults from "./components/CardResults.jsx";
import CatalogHeader from "./components/CatalogHeader.jsx";
import CatalogToolbar from "./components/CatalogToolbar.jsx";
import GuidedTour from "./components/GuidedTour.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import {
  cardKey,
  matchesMultipleSearch,
  matchesSearch,
  parseMultipleSearch,
  selectionMessage,
  sortCards,
} from "./lib/catalog.js";
import { APP_BASE_URL } from "./lib/app.js";

const TRADING_CATALOG_URL = `${APP_BASE_URL}data/trading.json`;
const SEARCHING_CATALOG_URL = `${APP_BASE_URL}data/searching.json`;
const CONFIG_URL = `${APP_BASE_URL}config.json`;
const THEME_STORAGE_KEY = "mtg-card-list-theme";
const TRADING_SELECTION_STORAGE_KEY = "mtg-card-list-trading-selection";
const SEARCHING_SELECTION_STORAGE_KEY = "mtg-card-list-searching-selection";
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

function storedSelection(cardKeys, storageKey) {
  const selection = new Set();

  try {
    const storedKeys = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (Array.isArray(storedKeys)) {
      for (const key of storedKeys) {
        if (typeof key === "string" && cardKeys.has(key)) selection.add(key);
      }
    }
  } catch {
    // Invalid stored data is replaced with an empty selection below.
  }

  window.localStorage.setItem(storageKey, JSON.stringify([...selection]));
  return selection;
}

function App() {
  const [tradingCards, setTradingCards] = useState(null);
  const [searchingCards, setSearchingCards] = useState(null);
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAppData() {
      try {
        const [tradingResponse, searchingResponse, configResponse] = await Promise.all(
          [TRADING_CATALOG_URL, SEARCHING_CATALOG_URL, CONFIG_URL].map((url) => fetch(url, {
            cache: "no-cache",
            signal: controller.signal,
          })),
        );
        if (!tradingResponse.ok) {
          throw new Error(`Trading catalog request failed with ${tradingResponse.status}.`);
        }
        if (!searchingResponse.ok) {
          throw new Error(`Searching catalog request failed with ${searchingResponse.status}.`);
        }
        if (!configResponse.ok) {
          throw new Error(`Configuration request failed with ${configResponse.status}.`);
        }

        const [tradingCatalog, searchingCatalog, appConfig] = await Promise.all([
          tradingResponse.json(),
          searchingResponse.json(),
          configResponse.json(),
        ]);
        if (!Array.isArray(tradingCatalog)) throw new Error("Trading catalog response is not an array.");
        if (!Array.isArray(searchingCatalog)) throw new Error("Searching catalog response is not an array.");
        if (typeof appConfig.email !== "string" || !appConfig.email.trim()) {
          throw new Error("Configuration email is missing.");
        }
        setTradingCards(tradingCatalog);
        setSearchingCards(searchingCatalog);
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
  if (!tradingCards || !searchingCards || !config) return <CatalogState title="Loading cards…" />;

  return <Catalog email={config.email} searchingCards={searchingCards} tradingCards={tradingCards} />;
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

function Catalog({ email, searchingCards, tradingCards }) {
  const tradingCardKeys = useMemo(() => new Set(tradingCards.map(cardKey)), [tradingCards]);
  const searchingCardKeys = useMemo(() => new Set(searchingCards.map(cardKey)), [searchingCards]);
  const [appearance, setAppearance] = useState(preferredAppearance);
  const [catalogMode, setCatalogMode] = useState(
    () => document.body.dataset.catalogMode ?? "trading",
  );
  const [query, setQuery] = useState("");
  const [multipleSearchText, setMultipleSearchText] = useState("");
  const [multipleSearchQueries, setMultipleSearchQueries] = useState(null);
  const [setFilter, setSetFilter] = useState("");
  const [foilOnly, setFoilOnly] = useState(false);
  const [cardFilters, setCardFilters] = useState(new Set());
  const [sort, setSort] = useState({ column: "name", direction: "asc" });
  const [tradingSelection, setTradingSelection] = useState(
    () => storedSelection(tradingCardKeys, TRADING_SELECTION_STORAGE_KEY),
  );
  const [searchingSelection, setSearchingSelection] = useState(
    () => storedSelection(searchingCardKeys, SEARCHING_SELECTION_STORAGE_KEY),
  );
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imagePreviewCard, setImagePreviewCard] = useState(null);
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [loadedResults, setLoadedResults] = useState({ key: "", count: RESULT_BATCH_SIZE });
  const [tour, setTour] = useState(null);
  const loadMoreRef = useRef(null);

  const isSearching = catalogMode === "searching";
  const cards = isSearching ? searchingCards : tradingCards;
  const selected = isSearching ? searchingSelection : tradingSelection;
  const setSelected = isSearching ? setSearchingSelection : setTradingSelection;
  const setCodes = useMemo(() => [...new Set(cards.map((card) => card.setCode))].sort(), [cards]);
  const activeMultipleSearchQueries = isSearching ? null : multipleSearchQueries;
  const accentColor = isSearching ? "orange" : "grass";
  const selectionBadgeLabel = isSearching ? "Got it" : "Interested";
  const selectionListName = isSearching ? "cards I can offer" : "interest list";

  useEffect(() => {
    document.documentElement.style.colorScheme = appearance;
  }, [appearance]);

  useEffect(() => {
    window.localStorage.setItem(TRADING_SELECTION_STORAGE_KEY, JSON.stringify([...tradingSelection]));
  }, [tradingSelection]);

  useEffect(() => {
    window.localStorage.setItem(SEARCHING_SELECTION_STORAGE_KEY, JSON.stringify([...searchingSelection]));
  }, [searchingSelection]);

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

  useEffect(() => {
    setCopied(false);
    setPreview(null);
    setImagePreviewCard(null);
  }, [catalogMode]);

  const visibleCards = useMemo(
    () => sortCards(
      cards.filter(
        (card) =>
          matchesSearch(card, query, setCodes) &&
          matchesMultipleSearch(card, activeMultipleSearchQueries, setCodes) &&
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
    [activeMultipleSearchQueries, cardFilters, cards, foilOnly, query, setCodes, setFilter, sort],
  );
  const resultKey = [
    catalogMode,
    query,
    activeMultipleSearchQueries === null
      ? "multiple-inactive"
      : `multiple:${activeMultipleSearchQueries.join(",")}`,
    setFilter,
    foilOnly,
    [...cardFilters].sort().join(","),
    sort.column,
    sort.direction,
  ].join("\u0000");
  const loadedCount = loadedResults.key === resultKey ? loadedResults.count : RESULT_BATCH_SIZE;
  const renderedCards = visibleCards.slice(0, loadedCount);
  const hasMoreResults = renderedCards.length < visibleCards.length;
  const activeSelectedCards = cards.filter((card) => selected.has(cardKey(card)));
  const interestedCards = tradingCards.filter((card) => tradingSelection.has(cardKey(card)));
  const offeredCards = searchingCards.filter((card) => searchingSelection.has(cardKey(card)));
  const messageCardCount = interestedCards.length + offeredCards.length;
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
          const currentCount = current.key === resultKey ? current.count : RESULT_BATCH_SIZE;
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

  function changeSortColumn(column) {
    setSort((current) => ({
      column,
      direction: current.column === column ? current.direction : "asc",
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

  function removeMessageCard(card, selectionName) {
    const updateSelection = selectionName === "interest" ? setTradingSelection : setSearchingSelection;
    const key = cardKey(card);
    updateSelection((current) => {
      const next = new Set(current);
      next.delete(key);
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

  function changeQuery(nextQuery) {
    setQuery(nextQuery);
    if (nextQuery) {
      setMultipleSearchText("");
      setMultipleSearchQueries(null);
    }
  }

  function applyMultipleSearch(value) {
    setQuery("");
    setMultipleSearchText(value);
    setMultipleSearchQueries(parseMultipleSearch(value, tradingCards));
  }

  function clearMultipleSearch() {
    setMultipleSearchText("");
    setMultipleSearchQueries(null);
  }

  function clearFilters() {
    setQuery("");
    clearMultipleSearch();
    setSetFilter("");
    setFoilOnly(false);
    setCardFilters(new Set());
  }

  function startTour() {
    setTour({
      stepIndex: 0,
      snapshot: {
        cardFilters: new Set(cardFilters),
        catalogMode,
        foilOnly,
        loadedResults,
        multipleSearchQueries,
        multipleSearchText,
        query,
        setFilter,
      },
    });
    setCatalogMode("trading");
    setQuery("");
    setMultipleSearchText("");
    setMultipleSearchQueries(null);
    setSetFilter("");
    setFoilOnly(false);
    setCardFilters(new Set());
    setLoadedResults({ key: "", count: RESULT_BATCH_SIZE });
    setPreview(null);
    setImagePreviewCard(null);
  }

  function endTour() {
    if (!tour) return;

    const { snapshot } = tour;
    setCatalogMode(snapshot.catalogMode);
    setQuery(snapshot.query);
    setMultipleSearchText(snapshot.multipleSearchText);
    setMultipleSearchQueries(snapshot.multipleSearchQueries);
    setSetFilter(snapshot.setFilter);
    setFoilOnly(snapshot.foilOnly);
    setCardFilters(snapshot.cardFilters);
    setLoadedResults(snapshot.loadedResults);
    setTour(null);
  }

  function advanceTour() {
    if (!tour) return;
    if (tour.stepIndex === 3) setCatalogMode("searching");
    setTour({ ...tour, stepIndex: tour.stepIndex + 1 });
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
    const left = fitsRight ? event.clientX + PREVIEW_OFFSET : event.clientX - PREVIEW_OFFSET - PREVIEW_WIDTH;
    const top = fitsBelow ? event.clientY + PREVIEW_OFFSET : event.clientY - PREVIEW_OFFSET - PREVIEW_HEIGHT;

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
      return visibleCards[currentIndex + direction] ?? current;
    });
  }

  async function copyMessage() {
    const message = selectionMessage(interestedCards, offeredCards);
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const message = selectionMessage(interestedCards, offeredCards);
  const mailto = `mailto:${email}?subject=${encodeURIComponent(
    `Card message — ${messageCardCount} card${messageCardCount === 1 ? "" : "s"}`,
  )}&body=${encodeURIComponent(message)}`;

  return (
    <Theme
      accentColor={accentColor}
      appearance={appearance}
      className="app-theme"
      grayColor="sage"
      panelBackground="solid"
      radius="large"
      scaling="100%"
    >
      <CatalogHeader
        accentColor={accentColor}
        activeSelectionCount={activeSelectedCards.length}
        appearance={appearance}
        cardCount={cards.length}
        copied={copied}
        copyMessage={copyMessage}
        interestedCards={interestedCards}
        isSearching={isSearching}
        mailto={mailto}
        onClearSelection={() => setSelected(new Set())}
        onModeChange={() => setCatalogMode(isSearching ? "trading" : "searching")}
        onRemoveMessageCard={removeMessageCard}
        onStartTour={startTour}
        onToggleAppearance={toggleAppearance}
        offeredCards={offeredCards}
        selectionListName={selectionListName}
        visibleCardCount={visibleCards.length}
      />

      <div className="site-shell">
        <main>
          <section className="catalog" aria-label={isSearching ? "Searching cards" : "Trading cards"}>
            <CatalogToolbar
              cardFilters={cardFilters}
              foilOnly={foilOnly}
              onCardFilterToggle={toggleCardFilter}
              onFoilToggle={() => setFoilOnly((current) => !current)}
              onMultipleSearchApply={applyMultipleSearch}
              onMultipleSearchClear={clearMultipleSearch}
              onQueryChange={changeQuery}
              onSetFilterChange={setSetFilter}
              onSortColumnChange={changeSortColumn}
              onSortDirectionToggle={() => toggleSort(sort.column)}
              query={query}
              setCodes={setCodes}
              setFilter={setFilter}
              showMultipleSearch={!isSearching}
              sort={sort}
              multipleSearchActive={multipleSearchQueries !== null}
              multipleSearchText={multipleSearchText}
            />
            <CardResults
              cards={renderedCards}
              hasMoreResults={hasMoreResults}
              isMobile={isMobile}
              loadMoreRef={loadMoreRef}
              onClearFilters={clearFilters}
              onPreviewClose={() => setPreview(null)}
              onPreviewMove={movePreview}
              onPreviewOpen={setImagePreviewCard}
              onSelect={toggleCard}
              onSort={toggleSort}
              selected={selected}
              sort={sort}
            />
          </section>
        </main>
        <SiteFooter />
      </div>

      {preview && (
        <div aria-hidden="true" className="card-preview" style={{ left: preview.left, top: preview.top }}>
          <img
            alt=""
            height={PREVIEW_HEIGHT}
            src={`${APP_BASE_URL}${preview.card.image}`}
            width={PREVIEW_WIDTH}
          />
        </div>
      )}
      <CardImageDialog
        accentColor={accentColor}
        card={imagePreviewCard}
        canNavigateNext={imagePreviewIndex >= 0 && imagePreviewIndex < visibleCards.length - 1}
        canNavigatePrevious={imagePreviewIndex > 0}
        isAdded={imagePreviewCard ? selected.has(cardKey(imagePreviewCard)) : false}
        nextCard={imagePreviewIndex >= 0 ? visibleCards[imagePreviewIndex + 1] : null}
        nextCardIsAdded={imagePreviewIndex >= 0 && imagePreviewIndex < visibleCards.length - 1
          ? selected.has(cardKey(visibleCards[imagePreviewIndex + 1]))
          : false}
        onNavigate={navigateImagePreview}
        onOpenChange={(open) => {
          if (!open) setImagePreviewCard(null);
        }}
        onToggle={toggleCard}
        previousCard={imagePreviewIndex > 0 ? visibleCards[imagePreviewIndex - 1] : null}
        previousCardIsAdded={imagePreviewIndex > 0
          ? selected.has(cardKey(visibleCards[imagePreviewIndex - 1]))
          : false}
        selectionBadgeLabel={selectionBadgeLabel}
        selectionListName={selectionListName}
      />
      {tour && (
        <GuidedTour
          onCancel={endTour}
          onFinish={endTour}
          onNext={advanceTour}
          stepIndex={tour.stepIndex}
        />
      )}
    </Theme>
  );
}

export default App;
