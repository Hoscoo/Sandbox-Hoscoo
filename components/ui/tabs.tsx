"use client";

import * as React from "react";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export const Tabs = BaseTabs.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof BaseTabs.List>) {
  return <BaseTabs.List className={cn("inline-flex items-center gap-1 rounded-md bg-muted p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        "rounded-sm px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors data-[selected]:bg-card data-[selected]:text-card-foreground data-[selected]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof BaseTabs.Panel>) {
  return <BaseTabs.Panel className={cn("mt-3", className)} {...props} />;
}
