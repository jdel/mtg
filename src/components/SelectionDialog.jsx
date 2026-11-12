import { useEffect, useState } from "react";
import { Badge, Button, Dialog, Flex, IconButton, Text } from "@radix-ui/themes";
import { Check, Copy, Mail, Trash2 } from "lucide-react";
import { cardKey } from "../lib/catalog.js";
import useSwipeDismiss from "../hooks/useSwipeDismiss.js";

export default function SelectionDialog({
  copied,
  copyMessage,
  interestedCards,
  mailto,
  onRemove,
  offeredCards,
}) {
  const [open, setOpen] = useState(false);
  const selectedCount = interestedCards.length + offeredCards.length;
  const { dragY, isDragging, resetDrag, swipeHandlers } = useSwipeDismiss(
    () => setOpen(false),
    (event) => !event.target.closest("button, a, .interest-list"),
  );

  function changeOpen(nextOpen) {
    if (nextOpen) resetDrag();
    setOpen(nextOpen);
  }

  useEffect(() => {
    if (selectedCount === 0) setOpen(false);
  }, [selectedCount]);

  return (
    <Dialog.Root onOpenChange={changeOpen} open={open}>
      <Dialog.Trigger>
        <Button
          aria-label={`Review message about ${selectedCount} selected card${selectedCount === 1 ? "" : "s"}`}
          className="interest-trigger"
          disabled={selectedCount === 0}
          size="3"
        >
          <Mail aria-hidden="true" size={17} />
          <span className="interest-label">Message</span>
          <Badge className="interest-count" color="gray" highContrast radius="full" variant="solid">
            {selectedCount}
          </Badge>
        </Button>
      </Dialog.Trigger>
      <Dialog.Content
        {...swipeHandlers}
        className={`interest-dialog${isDragging ? " is-dragging" : ""}`}
        maxWidth="540px"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <div aria-hidden="true" className="dialog-drag-handle" />
        <Dialog.Title>Message about cards</Dialog.Title>
        <Dialog.Description color="gray" size="2">
          Review both selections, then send a prefilled email or copy the message.
        </Dialog.Description>

        <div className="interest-list">
          {interestedCards.length > 0 && (
            <SelectionListSection
              cards={interestedCards}
              keyPrefix="interest"
              onRemove={(card) => onRemove(card, "interest")}
              quantityLabel="available"
              selectionName="interested cards"
              title="Interested in"
            />
          )}
          {offeredCards.length > 0 && (
            <SelectionListSection
              cards={offeredCards}
              keyPrefix="offer"
              onRemove={(card) => onRemove(card, "offer")}
              quantityLabel="wanted"
              selectionName="cards you can offer"
              title="Can offer"
            />
          )}
        </div>
        <Flex className="interest-actions" gap="3" mt="5" wrap="wrap">
          <Button asChild size="3">
            <a href={mailto}>
              <Mail aria-hidden="true" size={17} />
              Send email
            </a>
          </Button>
          <Button color="gray" onClick={copyMessage} size="3" variant="soft">
            {copied ? <Check aria-hidden="true" size={17} /> : <Copy aria-hidden="true" size={17} />}
            <span className="copy-interest-label">
              <span>{copied ? "Copied" : "Copy list"}</span>
            </span>
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function SelectionListSection({ cards, keyPrefix, onRemove, quantityLabel, selectionName, title }) {
  return (
    <section className="message-list-section">
      <Text as="p" className="message-list-heading" size="2" weight="bold">{title}</Text>
      {cards.map((card) => (
        <div className="interest-item" key={`${keyPrefix}-${cardKey(card)}`}>
          <div className="message-item-copy">
            <Text as="p" weight="medium">{card.name}</Text>
            <Text as="p" color="gray" size="2">
              {card.setCode} #{card.collectorNumber} · {card.language.toUpperCase()}
              {card.foil ? " · Foil" : ""} · {card.quantity} {quantityLabel}
            </Text>
          </div>
          <IconButton
            aria-label={`Remove ${card.name} from ${selectionName}`}
            className="message-remove-button"
            color="red"
            onClick={() => onRemove(card)}
            size="2"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" size={16} />
          </IconButton>
        </div>
      ))}
    </section>
  );
}
