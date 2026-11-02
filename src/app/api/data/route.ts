import { getInitialData } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";

export const dynamic = "force-dynamic";

export const GET = authed(async (user) => ok(await getInitialData(user)));
