import { useState } from "react";
import { Button, Dialog, Flex, IconButton, TextArea } from "@radix-ui/themes";
import { PlayingCards } from "lucide-react";

const EXAMPLE = `2x The Naked time (TRK)
HOB0004
FIN#167
4x Black Lotus`;

export default function MultipleSearchDialog({ active, onApply, onClear, value }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function changeOpen(nextOpen) {
    if (nextOpen) setDraft(value);
    setOpen(nextOpen);
  }

  function applySearch() {
    onApply(draft);
    setOpen(false);
  }

  function clearSearch() {
    onClear();
    setDraft("");
    setOpen(false);
  }

  return (
    <Dialog.Root onOpenChange={changeOpen} open={open}>
      <Dialog.Trigger>
        <IconButton
          aria-label={active ? "Edit multiple search" : "Multiple search"}
          aria-pressed={active}
          className="multiple-search-trigger"
          color={active ? undefined : "gray"}
          data-tour="multiple-search"
          highContrast={!active}
          size="3"
          title={active ? "Edit multiple search" : "Multiple search"}
          variant={active ? "solid" : "soft"}
        >
          <PlayingCards aria-hidden="true" size={20} />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Content className="multiple-search-dialog" maxWidth="560px">
        <Dialog.Title>Multiple search</Dialog.Title>
        <Dialog.Description as="div" className="multiple-search-description" color="gray" size="2">
          <span>Paste one card name or set and number per line</span>
          <span>Quantities and extra details are ignored</span>
        </Dialog.Description>
        <TextArea
          aria-label="Cards to search for"
          autoFocus
          className="multiple-search-input"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={EXAMPLE}
          resize="vertical"
          size="3"
          value={draft}
        />
        <Flex className="multiple-search-actions" gap="3" justify="end" mt="4" wrap="wrap">
          {active && (
            <Button color="red" onClick={clearSearch} type="button" variant="soft">
              Clear
            </Button>
          )}
          <Dialog.Close>
            <Button color="gray" type="button" variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button disabled={!draft.trim()} onClick={applySearch} type="button">
            Search
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
