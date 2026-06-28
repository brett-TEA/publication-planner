// Vercel serverless function: emails The Ethical Agency when a client sends a plan.
// Called by the app (same origin) after it logs the share to the `tea_shares` table.
// Requires a Vercel environment variable: RESEND_API_KEY
// Sender domain (theethicalagency.co.za) must be verified in Resend.

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "Email is not configured (missing RESEND_API_KEY)." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const planName   = (body.plan_name   || "Untitled plan").toString().slice(0, 200);
    const shareUrl   = (body.share_url    || "").toString().slice(0, 500);
    const clientEmail= (body.client_email || "").toString().slice(0, 200);
    const clientName = (body.client_name  || "").toString().slice(0, 200);
    const note       = (body.note         || "").toString().slice(0, 2000);

    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;line-height:1.6;">
        <h2 style="color:#4C8497;margin:0 0 12px;">New plan sent to The Ethical Agency</h2>
        <p><strong>Plan:</strong> ${esc(planName)}</p>
        <p><strong>From:</strong> ${esc(clientName || "(no name)")} &lt;${esc(clientEmail || "unknown")}&gt;</p>
        ${note ? `<p><strong>Note:</strong><br>${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
        ${shareUrl ? `<p><strong>View plan:</strong> <a href="${esc(shareUrl)}">${esc(shareUrl)}</a></p>` : ""}
        <hr style="border:none;border-top:1px solid #e3e3e0;margin:18px 0;">
        <p style="color:#8a8a8e;font-size:12px;">Sent automatically by Publication Planner.</p>
      </div>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Publication Planner <planner@theethicalagency.co.za>",
        to: ["hello@ethical-agency.com"],
        reply_to: clientEmail || undefined,
        subject: `New plan from ${clientName || clientEmail || "a client"}: ${planName}`,
        html,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Email send failed", detail });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
