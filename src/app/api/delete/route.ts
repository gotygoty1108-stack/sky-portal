import { deleteItem } from "@/server/delete";
import { authed, ok } from "@/server/route-helpers";
import { ROLE_ADMIN } from "@/lib/types";

export const POST = authed(async (user, body) => ok(await deleteItem(body, user)), { role: ROLE_ADMIN });
