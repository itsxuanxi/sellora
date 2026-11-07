import type { NotificationMessage } from "@/lib/notifications/types";

/**
 * The email rendering.
 *
 * Table-based and inline-styled on purpose: mail clients are not browsers,
 * and a flexbox digest that looks right in a preview pane and collapses in
 * Outlook is not a working feature. No images, no web fonts, no external
 * requests — a digest must render with images blocked, which is how a large
 * share of recipients read mail.
 */

const INK = "#121413";
const MUTED = "#5f6461";
const LINE = "#dee1dd";
const BRAND = "#4435b8";
const RISK = "#b64242";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function renderNotificationEmail(
  message: NotificationMessage,
  opts: { unsubscribeUrl: string; workspaceName: string; simulated: boolean }
): { html: string; text: string } {
  const rows = message.deals
    .map(
      (d) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${LINE};">
          <div style="font:600 15px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
            ${escapeHtml(d.company)}
            ${
              d.atRisk > 0
                ? `<span style="margin-left:8px;font:600 10px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:${RISK};">Needs attention</span>`
                : ""
            }
          </div>
          <div style="margin-top:4px;font:400 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
            ${escapeHtml(d.stage)} · ${escapeHtml(d.reason)}
          </div>
          <div style="margin-top:6px;font:400 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
            <strong>Next:</strong> ${escapeHtml(d.nextAction)} <span style="color:${MUTED};">(${escapeHtml(d.urgency)})</span>
          </div>
          <div style="margin-top:6px;font:400 13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
            <strong style="color:${INK};">${money(d.dealValue, d.currency)}</strong>${
              d.risk ? ` · ${escapeHtml(d.risk)}` : ""
            }${
              d.basis ? ` <span style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;">${escapeHtml(d.basis)}</span>` : ""
            }${
              d.daysOverdue != null && d.daysOverdue > 0
                ? ` · ${d.daysOverdue}d overdue`
                : ""
            }
            · <a href="${d.url}" style="color:${BRAND};text-decoration:none;">Open deal</a>
          </div>
        </td>
      </tr>`
    )
    .join("");

  const banner = opts.simulated
    ? `<tr><td style="padding:10px 14px;background:#fdf6e3;border:1px solid #e8d9a8;border-radius:8px;font:400 12px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#7a5c12;">
         Sample data — this is a preview of what Selryn would send. Nothing here describes a real company.
       </td></tr><tr><td style="height:16px;"></td></tr>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f8f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;padding:24px;">
        ${banner}
        <tr><td style="font:600 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">
          Selryn · ${escapeHtml(opts.workspaceName)}
        </td></tr>
        <tr><td style="padding-top:10px;font:600 20px/1.3 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
          ${escapeHtml(message.headline)}
        </td></tr>
        <tr><td style="padding-top:8px;font:400 13px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
          In the order Today ranks them: what is overdue first.
        </td></tr>
        <tr><td style="padding-top:8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
        <tr><td style="padding-top:18px;">
          <a href="${message.primaryUrl}" style="display:inline-block;background:${BRAND};color:#ffffff;font:600 14px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:12px 20px;border-radius:999px;text-decoration:none;">
            ${escapeHtml(message.primaryLabel)}
          </a>
        </td></tr>
        <tr><td style="padding-top:18px;border-top:1px solid ${LINE};font:400 12px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
          ${escapeHtml(message.summary.openPipeline)} of open pipeline across ${message.summary.openCount} deals · ${escapeHtml(message.summary.revenueAtRisk)} estimated value at risk.
        </td></tr>
        <tr><td style="padding-top:12px;font:400 11px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
          <a href="${opts.unsubscribeUrl}" style="color:${MUTED};">Unsubscribe from Selryn notifications</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    opts.simulated ? "[Sample data — nothing here describes a real company]" : "",
    message.headline,
    "",
    ...message.deals.map(
      (d) =>
        `${d.company} — ${money(d.dealValue, d.currency)}${d.risk ? ` · ${d.risk}` : ""}${d.basis ? ` (${d.basis})` : ""}\n` +
        `  ${d.stage} · ${d.reason}\n` +
        `  Next: ${d.nextAction} (${d.urgency})\n  ${d.url}`
    ),
    "",
    `${message.summary.openPipeline} of open pipeline across ${message.summary.openCount} deals · ${message.summary.revenueAtRisk} estimated value at risk.`,
    "",
    `${message.primaryLabel}: ${message.primaryUrl}`,
    "",
    `Unsubscribe: ${opts.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}
