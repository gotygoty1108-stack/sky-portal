import { saveRecord } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";
import { ROLE_ADMIN } from "@/lib/types";

export const POST = authed(async (user, body) => ok(await saveRecord(body, user)), { role: ROLE_ADMIN });
