import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/sandbox/portal" className="hover:text-foreground">
            Sandbox
          </Link>
          <Link href="/sandbox/fixtures" className="hover:text-foreground">
            Fixtures
          </Link>
          <a href="/openapi/v1.json" target="_blank" rel="noreferrer" className="hover:text-foreground">
            API reference
          </a>
          <Badge variant="sandbox">sandbox-api.hoscoo.com</Badge>
        </nav>
      </div>
    </header>
  );
}
