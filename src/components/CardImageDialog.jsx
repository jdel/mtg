import { useEffect, useRef, useState } from "react";
import { Badge, Dialog, Heading, Text } from "@radix-ui/themes";
import { APP_BASE_URL } from "../lib/app.js";

const CARD_CAROUSEL_GAP = 24;
const TAP_MOVE_THRESHOLD = 8;
const SWIPE_THRESHOLD = 50;
const SWIPE_CLOSE_THRESHOLD = 80;

export default function CardImageDialog({
  accentColor,
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
  selectionBadgeLabel,
  selectionListName,
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
              accentColor={accentColor}
              card={previousCard}
              isAdded={previousCardIsAdded}
              position="previous"
              selectionBadgeLabel={selectionBadgeLabel}
            />
          )}
          {nextCard && (
            <CardImageDialogNeighbor
              accentColor={accentColor}
              card={nextCard}
              isAdded={nextCardIsAdded}
              position="next"
              selectionBadgeLabel={selectionBadgeLabel}
            />
          )}
          <Dialog.Title className="card-image-dialog-title">{card.name}</Dialog.Title>
          <div className="card-image-dialog-subtitle">
            <Dialog.Description className="card-image-dialog-meta" color="gray" size="2">
              <CardImageDialogMeta card={card} />
            </Dialog.Description>
            {isAdded && <Badge color={accentColor}>{selectionBadgeLabel}</Badge>}
          </div>
          <button
            aria-label={`${isAdded ? "Remove" : "Add"} ${card.name} ${isAdded ? "from" : "to"} the ${selectionListName}`}
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
                swipeAxis.current = Math.abs(distanceY) > Math.abs(distanceX) ? "vertical" : "horizontal";
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
              src={`${APP_BASE_URL}${card.image}`}
            />
          </button>
        </Dialog.Content>
      )}
    </Dialog.Root>
  );
}

function CardImageDialogNeighbor({ accentColor, card, isAdded, position, selectionBadgeLabel }) {
  return (
    <div aria-hidden="true" className={`card-image-dialog-neighbor ${position}`}>
      <Heading as="div" mb="3" size="5" trim="start">{card.name}</Heading>
      <div className="card-image-dialog-subtitle">
        <Text as="div" className="card-image-dialog-meta" color="gray" size="2">
          <CardImageDialogMeta card={card} />
        </Text>
        {isAdded && <Badge color={accentColor}>{selectionBadgeLabel}</Badge>}
      </div>
      <img
        alt=""
        className="card-image-dialog-neighbor-image"
        draggable="false"
        src={`${APP_BASE_URL}${card.image}`}
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
          src={`${APP_BASE_URL}symbols/foil.png`}
          title="Foil"
        />
      )}
    </>
  );
}
