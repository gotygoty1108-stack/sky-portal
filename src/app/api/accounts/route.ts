import { createAccount, listAccounts, resetPassword, updateAccount } from "@/server/accounts";
import { UserError } from "@/server/portal";
import { authed, ok } from "@/server/route-helpers";
import { ROLE_ADMIN } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = authed(async () => ok(await listAccounts()), { role: ROLE_ADMIN });

export const POST = authed(
  async (user, body) => {
    if (body.action === "create") return ok(await createAccount(body));
    if (body.action === "update") return ok(await updateAccount(body, user));
    if (body.action === "reset") return ok(await resetPassword(body));
    throw new UserError("操作が正しくありません。");
  },
  { role: ROLE_ADMIN },
);
