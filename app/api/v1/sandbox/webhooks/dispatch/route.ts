import { NextRequest, NextResponse } from "next/server";
import { drainPendingDeliveries } from "@/lib/sandbox/webhooks";

/**
 * Cron-invoked delivery drain — see vercel.json "crons" and the module
 * comment in lib/sandbox/webhooks.ts for why this cannot run in-request.
 */
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
