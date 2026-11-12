import { Badge, Button, IconButton } from "@radix-ui/themes";
import { Moon, Repeat2, Sun, Trash2 } from "lucide-react";
import HelpDialog from "./HelpDialog.jsx";
import SelectionDialog from "./SelectionDialog.jsx";

export default function CatalogHeader({
  accentColor,
  activeSelectionCount,
  appearance,
  cardCount,
  copied,
  copyMessage,
  interestedCards,
  isSearching,
  mailto,
  onClearSelection,
  onModeChange,
  onRemoveMessageCard,
  onToggleAppearance,
  offeredCards,
  selectionListName,
  visibleCardCount,
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Button
          aria-label={`Switch to ${isSearching ? "Trading" : "Searching"}`}
          className="catalog-mode-toggle"
          color={accentColor}
          onClick={onModeChange}
          size="3"
        >
          <Repeat2 aria-hidden="true" size={16} />
          <span>{isSearching ? "Searching" : "Trading"}</span>
          <Badge className="catalog-mode-count" color="gray" highContrast radius="full" variant="solid">
            {visibleCardCount}/{cardCount}
          </Badge>
        </Button>
        <div className="topbar-actions">
          <Button
            aria-label={`Remove all selected cards from the ${selectionListName}`}
            className="clear-selection"
            color="red"
            disabled={activeSelectionCount === 0}
            onClick={onClearSelection}
            size="3"
            variant="soft"
          >
            <Trash2 aria-hidden="true" size={17} />
            <span className="clear-selection-label">Remove all</span>
          </Button>
          <SelectionDialog
            copied={copied}
            copyMessage={copyMessage}
            interestedCards={interestedCards}
            mailto={mailto}
            onRemove={onRemoveMessageCard}
            offeredCards={offeredCards}
          />
          <HelpDialog />
          <IconButton
            aria-label={`Switch to ${appearance === "dark" ? "light" : "dark"} theme`}
            color="gray"
            highContrast
            onClick={onToggleAppearance}
            size="3"
            variant="soft"
          >
            {appearance === "dark" ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
          </IconButton>
        </div>
      </div>
    </header>
  );
}
