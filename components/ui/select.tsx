"use client";

import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = BaseSelect.Root;
export const SelectValue = BaseSelect.Value;

export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: React.ComponentProps<typeof BaseSelect.Popup>) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4}>
        <BaseSelect.Popup
          className={cn(
            "z-50 max-h-64 overflow-auto rounded-md border border-border bg-card p-1 text-card-foreground shadow-md",
            className,
          )}
          {...props}
        >
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-3 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center">
        <BaseSelect.ItemIndicator>
          <Check className="h-3.5 w-3.5" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}
