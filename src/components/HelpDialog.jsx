import { useState } from "react";
import { Button, Dialog, Flex, IconButton } from "@radix-ui/themes";
import { CircleHelp } from "lucide-react";
import useSwipeDismiss from "../hooks/useSwipeDismiss.js";

export default function HelpDialog({ onStartTour }) {
  const [open, setOpen] = useState(false);
  const { dragY, isDragging, resetDrag, swipeHandlers } = useSwipeDismiss(() => setOpen(false));

  function changeOpen(nextOpen) {
    if (nextOpen) resetDrag();
    setOpen(nextOpen);
  }

  function startTour() {
    changeOpen(false);
    onStartTour();
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
        {...swipeHandlers}
        className={`help-dialog${isDragging ? " is-dragging" : ""}`}
        maxWidth="460px"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        <Dialog.Title className="visually-hidden">How card requests work</Dialog.Title>
        <Dialog.Description as="div" className="help-dialog-copy" size="3">
          <p>This is not a marketplace and only aims to facilitate in-person deals.</p>
          <p>In Trading, select cards you&apos;re interested in.</p>
          <p>In Searching, select cards you can offer.</p>
          <p>
            Message combines both selections into one email or copied list to send with your
            preferred channel.
          </p>
        </Dialog.Description>
        <Flex justify="end" mt="5">
          <Button onClick={startTour} type="button">Start guided tour</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
