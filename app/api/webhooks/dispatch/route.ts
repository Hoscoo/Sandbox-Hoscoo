import { NextRequest, NextResponse } from "next/server";
import { drainPendingDeliveries } from "@/lib/webhooks";

/** Cron-invoked delivery drain for the production webhook queue — see vercel.json "crons" and lib/webhooks/core.ts's module comment. */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } }, { status: 401 });
    }
  }
  const result = await drainPendingDeliveries(new Date());
  return NextResponse.json(result);
}
