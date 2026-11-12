import { Flex, IconButton, Select, TextField } from "@radix-ui/themes";
import { ArrowDown, ArrowUp, Cog, ListFilter, Mountain, Search, X } from "lucide-react";
import { SORT_COLUMNS } from "../lib/catalog.js";
import MultipleSearchDialog from "./MultipleSearchDialog.jsx";

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

export default function CatalogToolbar({
  cardFilters,
  foilOnly,
  onCardFilterToggle,
  onFoilToggle,
  onMultipleSearchApply,
  onMultipleSearchClear,
  onQueryChange,
  onSetFilterChange,
  onSortColumnChange,
  onSortDirectionToggle,
  query,
  setCodes,
  setFilter,
  showMultipleSearch,
  sort,
  multipleSearchActive,
  multipleSearchText,
}) {
  return (
    <Flex align="end" className="catalog-toolbar" gap="4" justify="between" wrap="wrap">
      <div className="filters">
        <div className="search-controls">
          <TextField.Root
            aria-label="Search cards"
            className="search-input"
            data-tour="search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search name or card number, e.g. TRK 110"
            size="3"
            value={query}
          >
            <TextField.Slot><Search aria-hidden="true" size={20} /></TextField.Slot>
            {query && (
              <TextField.Slot side="right">
                <IconButton
                  aria-label="Clear search"
                  color="gray"
                  onClick={() => onQueryChange("")}
                  size="1"
                  title="Clear search"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" size={16} />
                </IconButton>
              </TextField.Slot>
            )}
          </TextField.Root>
          {showMultipleSearch && (
            <MultipleSearchDialog
              active={multipleSearchActive}
              onApply={onMultipleSearchApply}
              onClear={onMultipleSearchClear}
              value={multipleSearchText}
            />
          )}
        </div>

        <div className="mobile-select-row">
          <TextField.Root
            aria-label="Filter by set code"
            autoComplete="off"
            className="set-filter-input"
            list="set-code-options"
            onChange={(event) => onSetFilterChange(event.target.value)}
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
                  onClick={() => onSetFilterChange("")}
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
            <Select.Root onValueChange={onSortColumnChange} size="3" value={sort.column}>
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
              onClick={onSortDirectionToggle}
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
                onClick={() => onCardFilterToggle(value)}
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
                onClick={() => onCardFilterToggle(value)}
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
              onClick={onFoilToggle}
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
  );
}
