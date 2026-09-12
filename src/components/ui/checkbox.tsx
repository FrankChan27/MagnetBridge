import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange?.(value === true)}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-xs border border-border bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground disabled:opacity-40",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
