import { useEffect, useRef, useState } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";

const STEPS = [
  {
    selector: '[data-tour="search"]',
    title: "Search",
    description: "Search single card here by name or set and number",
  },
  {
    selector: '[data-tour="multiple-search"]',
    title: "Multiple search",
    description: "Paste a list of cards you're looking for",
  },
  {
    selector: '[data-tour="card-row"]',
    title: "Select cards",
    description: "Click or tap to select cards you want",
  },
  {
    selector: '[data-tour="mode-toggle"]',
    title: "Searching",
    description: "See what I'm looking for",
  },
  {
    selector: '[data-tour="card-row"]',
    title: "Offer cards",
    description: "Click or tap to select cards you want to trade",
  },
  {
    selector: '[data-tour="message"]',
    title: "Message",
    description: "Click to send a message",
  },
];

const HIGHLIGHT_PADDING = 6;
const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 14;
const POPOVER_HEIGHT_ESTIMATE = 190;
const POPOVER_MAX_WIDTH = 360;

function targetHighlight(target) {
  const rect = target.getBoundingClientRect();
  if (
    rect.bottom <= 0 ||
    rect.right <= 0 ||
    rect.top >= window.innerHeight ||
    rect.left >= window.innerWidth
  ) {
    return null;
  }

  const left = Math.max(0, rect.left - HIGHLIGHT_PADDING);
  const top = Math.max(0, rect.top - HIGHLIGHT_PADDING);
  const right = Math.min(window.innerWidth, rect.right + HIGHLIGHT_PADDING);
  const bottom = Math.min(window.innerHeight, rect.bottom + HIGHLIGHT_PADDING);

  return {
    bottom,
    height: Math.max(0, bottom - top),
    left,
    right,
    top,
    width: Math.max(0, right - left),
  };
}

function popoverPosition(highlight) {
  const width = Math.min(POPOVER_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  if (!highlight) {
    return {
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width,
    };
  }

  const centeredLeft = highlight.left + highlight.width / 2 - width / 2;
  const left = Math.min(
    window.innerWidth - width - VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, centeredLeft),
  );
  const roomBelow = window.innerHeight - highlight.bottom;
  const placeBelow = roomBelow >= POPOVER_HEIGHT_ESTIMATE || highlight.top < POPOVER_HEIGHT_ESTIMATE;

  return {
    left,
    top: placeBelow ? highlight.bottom + POPOVER_GAP : highlight.top - POPOVER_GAP,
    transform: placeBelow ? "none" : "translateY(-100%)",
    width,
  };
}

export default function GuidedTour({ onCancel, onFinish, onNext, stepIndex }) {
  const [highlight, setHighlight] = useState(null);
  const nextButtonRef = useRef(null);
  const popoverRef = useRef(null);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  useEffect(() => {
    const target = document.querySelector(step.selector);
    let settleTimer;

    function updateHighlight() {
      setHighlight(target?.isConnected ? targetHighlight(target) : null);
    }

    if (target) target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    updateHighlight();
    settleTimer = window.setTimeout(updateHighlight, 350);
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, { passive: true });

    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight);
    };
  }, [step]);

  useEffect(() => {
    nextButtonRef.current?.focus();
  }, [stepIndex]);

  useEffect(() => {
    function handleTourKeys(event) {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const buttons = [...(popoverRef.current?.querySelectorAll("button:not(:disabled)") ?? [])];
      const firstButton = buttons[0];
      const lastButton = buttons.at(-1);
      if (event.shiftKey && document.activeElement === firstButton) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && document.activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    }

    window.addEventListener("keydown", handleTourKeys);
    return () => window.removeEventListener("keydown", handleTourKeys);
  }, [onCancel]);

  const highlightStyle = highlight
    ? { height: highlight.height, left: highlight.left, top: highlight.top, width: highlight.width }
    : null;

  return (
    <div className="guided-tour-layer">
      {highlight ? (
        <>
          <div className="guided-tour-shade" style={{ height: highlight.top, left: 0, right: 0, top: 0 }} />
          <div
            className="guided-tour-shade"
            style={{ bottom: 0, left: 0, right: 0, top: highlight.bottom }}
          />
          <div
            className="guided-tour-shade"
            style={{ height: highlight.height, left: 0, top: highlight.top, width: highlight.left }}
          />
          <div
            className="guided-tour-shade"
            style={{
              height: highlight.height,
              left: highlight.right,
              right: 0,
              top: highlight.top,
            }}
          />
          <div className="guided-tour-highlight" style={highlightStyle} />
          <div className="guided-tour-target-blocker" style={highlightStyle} />
        </>
      ) : (
        <div className="guided-tour-shade guided-tour-shade-full" />
      )}

      <section
        aria-describedby="guided-tour-description"
        aria-labelledby="guided-tour-title"
        aria-modal="true"
        className="guided-tour-popover"
        ref={popoverRef}
        role="dialog"
        style={popoverPosition(highlight)}
      >
        <Text as="p" className="guided-tour-progress" color="gray" size="1" weight="bold">
          {stepIndex + 1} of {STEPS.length}
        </Text>
        <Text as="p" className="guided-tour-title" id="guided-tour-title" size="4" weight="bold">
          {step.title}
        </Text>
        <Text as="p" className="guided-tour-description" id="guided-tour-description" size="2">
          {step.description}
        </Text>
        <Flex gap="3" justify="end" mt="4">
          <Button color="gray" onClick={onCancel} type="button" variant="soft">Cancel</Button>
          <Button
            onClick={isLastStep ? onFinish : onNext}
            ref={nextButtonRef}
            type="button"
          >
            {isLastStep ? "Finish" : "Next"}
          </Button>
        </Flex>
      </section>
    </div>
  );
}
