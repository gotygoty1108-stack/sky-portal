import { getSettings, saveSettings } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";
import { ROLE_ADMIN } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = authed(async () => ok(await getSettings()));
export const POST = authed(async (_user, body) => ok(await saveSettings(body)), { role: ROLE_ADMIN });
