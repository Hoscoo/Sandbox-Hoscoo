"use client";

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export const Tabs = BaseTabs.Root;

export function TabsList({ className, children, ...props }: React.ComponentProps<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List className={cn("relative inline-flex items-center gap-1 rounded-md bg-muted p-1", className)} {...props}>
      {/*
        Sliding pill behind the active tab. Position/size are set via inline
        style referencing base-ui's --active-tab-* CSS vars rather than
        Tailwind arbitrary-value classes (e.g. w-[var(--active-tab-width)]) —
        Tailwind's build-time class scanner does not generate a rule for
        those, so the indicator silently rendered at 0x0. Inline style always
        applies regardless of scanning.
      */}
      <BaseTabs.Indicator
        className="absolute rounded-sm bg-card shadow-sm transition-all duration-300 ease-out"
        style={{
          left: "var(--active-tab-left)",
          top: "var(--active-tab-top)",
          width: "var(--active-tab-width)",
          height: "var(--active-tab-height)",
        }}
      />
      {children}
    </BaseTabs.List>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "relative z-10 rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-200 data-[selected]:text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof BaseTabs.Panel>) {
  return (
    <BaseTabs.Panel
      className={cn(
        "mt-3 transition-all duration-200 ease-out data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}
