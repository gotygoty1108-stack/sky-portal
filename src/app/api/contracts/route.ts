import { saveContract } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";
import { ROLE_ADMIN } from "@/lib/types";

export const POST = authed(async (_user, body) => ok(await saveContract(body)), { role: ROLE_ADMIN });
