import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/security/audit";
import { verifyUnsubscribe } from "@/lib/notifications/unsubscribe";

/**
 * One-click unsubscribe from an email footer.
 *
 * GET, not POST, and no sign-in: the person clicking is in their mail client,
 * possibly on a phone, possibly having forgotten they have an account. Making
 * them authenticate to stop receiving mail is how a legitimate sender starts
 * getting marked as spam. The MAC in the link is the authorization.
 */

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
     <body style="margin:0;background:#f7f8f5;font:400 15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#121413;">
       <div style="max-width:460px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #dee1dd;border-radius:14px;">
         <h1 style="margin:0 0 8px;font-size:19px;">${title}</h1>
         <p style="margin:0;color:#5f6461;">${body}</p>
       </div>
     </body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u");
  const token = url.searchParams.get("t");

  if (!userId || !token || !verifyUnsubscribe(userId, token)) {
    return page("That link is not valid", "Please use the link from a recent Selryn email.", 400);
  }

  const pref = await db.notificationPreference.findUnique({
    where: { userId },
    select: { id: true, orgId: true },
  });
  if (!pref) {
    return page("Already unsubscribed", "There are no Selryn notifications going to this address.");
  }

  // The type switches are turned off as well as the standing flag, so the
  // settings screen shows a state that matches reality rather than switches
  // that read "on" while nothing sends.
  await db.notificationPreference.update({
    where: { id: pref.id },
    data: { unsubscribedAt: new Date(), dailyDigest: false, riskAlerts: false },
  });

  await recordAudit({
    orgId: pref.orgId,
    actorId: userId,
    actorType: "user",
    action: "notification.unsubscribed",
    targetType: "notification_preference",
    targetId: pref.id,
  });

  return page(
    "Unsubscribed",
    "You will not receive further Selryn notifications. You can turn them back on any time in Settings → Notifications."
  );
}
