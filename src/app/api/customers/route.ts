import { saveCustomer } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";

export const POST = authed(async (_user, body) => ok(await saveCustomer(body)));
