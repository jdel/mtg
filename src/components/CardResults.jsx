import { Badge, Button, Heading, IconButton, Table, Text } from "@radix-ui/themes";
import { Eye, Search } from "lucide-react";
import { SORT_COLUMNS, cardKey } from "../lib/catalog.js";
import SortButton from "./SortButton.jsx";

export default function CardResults({
  cards,
  hasMoreResults,
  isMobile,
  loadMoreRef,
  onClearFilters,
  onPreviewClose,
  onPreviewMove,
  onPreviewOpen,
  onSelect,
  onSort,
  selected,
  sort,
}) {
  if (cards.length === 0) return <EmptyResults onClearFilters={onClearFilters} />;

  return (
    <>
      {isMobile ? (
        <MobileCardList cards={cards} onPreviewOpen={onPreviewOpen} onSelect={onSelect} selected={selected} />
      ) : (
        <DesktopCardTable
          cards={cards}
          onPreviewClose={onPreviewClose}
          onPreviewMove={onPreviewMove}
          onSelect={onSelect}
          onSort={onSort}
          selected={selected}
          sort={sort}
        />
      )}
      {hasMoreResults && <div aria-hidden="true" className="load-more-sentinel" ref={loadMoreRef} />}
    </>
  );
}

function EmptyResults({ onClearFilters }) {
  return (
    <div className="table-frame">
      <div className="empty-state">
        <Search aria-hidden="true" size={24} />
        <Heading as="h3" size="4">No matching cards</Heading>
        <Text color="gray" size="2">Try a name, set code, or collector number.</Text>
        <Button color="gray" onClick={onClearFilters} variant="soft">Clear filters</Button>
      </div>
    </div>
  );
}

function MobileCardList({ cards, onPreviewOpen, onSelect, selected }) {
  return (
    <div aria-label="Cards" className="mobile-card-list" role="list">
      {cards.map((card) => {
        const key = cardKey(card);
        const isSelected = selected.has(key);
        return (
          <div className={`mobile-card${isSelected ? " selected-card" : ""}`} key={key} role="listitem">
            <IconButton
              aria-label={`View image of ${card.name}`}
              className="mobile-card-image-button"
              color="gray"
              onClick={() => onPreviewOpen(card)}
              size="3"
              variant="ghost"
            >
              <Eye aria-hidden="true" size={20} />
            </IconButton>
            <button
              aria-pressed={isSelected}
              className="mobile-card-selection"
              onClick={() => onSelect(card, !isSelected)}
              type="button"
            >
              <CardTitle card={card} mobile />
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
  );
}

function DesktopCardTable({ cards, onPreviewClose, onPreviewMove, onSelect, onSort, selected, sort }) {
  return (
    <div className="table-frame">
      <Table.Root className="card-table" variant="surface">
        <Table.Header>
          <Table.Row>
            {Object.entries(SORT_COLUMNS).map(([column, config]) => (
              <Table.ColumnHeaderCell
                aria-sort={sort.column === column ? sort.direction === "asc" ? "ascending" : "descending" : "none"}
                key={column}
              >
                <SortButton
                  active={sort.column === column}
                  direction={sort.direction}
                  onClick={() => onSort(column)}
                >
                  {config.label}
                </SortButton>
              </Table.ColumnHeaderCell>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {cards.map((card) => {
            const key = cardKey(card);
            const isSelected = selected.has(key);
            return (
              <Table.Row
                aria-selected={isSelected}
                className={isSelected ? "selected-row" : undefined}
                key={key}
                onClick={() => onSelect(card, !isSelected)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(card, !isSelected);
                  }
                }}
                onMouseEnter={(event) => onPreviewMove(card, event)}
                onMouseLeave={onPreviewClose}
                onMouseMove={(event) => onPreviewMove(card, event)}
                tabIndex={0}
              >
                <Table.RowHeaderCell><CardTitle card={card} /></Table.RowHeaderCell>
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
  );
}

function CardTitle({ card, mobile = false }) {
  return (
    <span className={`card-title${mobile ? " mobile-card-title" : ""}`}>
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
      {card.secondaryName && <span className="secondary-card-name">{card.secondaryName}</span>}
    </span>
  );
}
