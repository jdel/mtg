import { Button } from "@radix-ui/themes";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export default function SortButton({ active, direction, children, onClick }) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <Button
      className="sort-button"
      color="gray"
      highContrast
      onClick={onClick}
      size="1"
      variant="ghost"
    >
      {children}
      <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
    </Button>
  );
}

