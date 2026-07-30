import { Hero } from "@/components/hero";
import { Coverage } from "@/components/coverage";
import { Corridors } from "@/components/corridors";
import { RoutingEngine } from "@/components/routing-engine";
import { RouteOptimizer } from "@/components/route-optimizer";

export default function HomePage() {
  return (
    <main className="flex flex-col divide-y divide-border">
      <Hero />
      <Coverage />
      <Corridors />
      <RoutingEngine />
      <RouteOptimizer />
    </main>
  );
}
