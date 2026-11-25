import { setOwnPassword } from "@/server/accounts";
import { authed, ok } from "@/server/route-helpers";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/server/session";

export const dynamic = "force-dynamic";

export const POST = authed(
  async (user, body) => {
    const { user: updated, v } = await setOwnPassword(user, body.password);
    const res = ok(updated);
    res.cookies.set(SESSION_COOKIE, await createSessionToken(updated, v), sessionCookieOptions);
    return res;
  },
  { allowPending: true },
);
