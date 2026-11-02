import { saveEstimate } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";

export const POST = authed(async (user, body) => ok(await saveEstimate(body, user)));
