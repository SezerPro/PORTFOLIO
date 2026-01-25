module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM_EMAIL;
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    if (!supabaseUrl || !supabaseAnonKey || !resendApiKey || !resendFrom) {
        res.status(500).json({ error: "Missing server configuration" });
        return;
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseAnonKey
        }
    });

    if (!authResponse.ok) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const user = await authResponse.json();
    const email = (user?.email || "").toLowerCase();

    if (adminEmails.length > 0 && !adminEmails.includes(email)) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { email: clientEmail, name, language, commentUrl, expiresAt } = body;

    if (!clientEmail || !name || !commentUrl) {
        res.status(400).json({ error: "Missing fields" });
        return;
    }

    const templates = {
        fr: {
            subject: "Votre retour sur notre collaboration",
            intro: `Bonjour ${name},`,
            body: "Merci pour notre collaboration. Pouvez-vous laisser un avis via le lien ci-dessous ?",
            button: "Laisser mon avis",
            footer: "Le lien est personnel et expire automatiquement."
        },
        en: {
            subject: "Your feedback on our collaboration",
            intro: `Hi ${name},`,
            body: "Thanks for working together. Could you leave feedback using the link below?",
            button: "Share feedback",
            footer: "This link is personal and will expire automatically."
        },
        tr: {
            subject: "Birlikte calismamiz hakkinda gorusleriniz",
            intro: `Merhaba ${name},`,
            body: "Birlikte calistigimiz icin tesekkurler. Asagidaki linkten yorum birakabilir misiniz?",
            button: "Yorum birak",
            footer: "Bu baglanti size ozeldir ve otomatik olarak sure sonu olur."
        }
    };

    const template = templates[language] || templates.fr;

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
            <p>${template.intro}</p>
            <p>${template.body}</p>
            <p>
                <a href="${commentUrl}" style="display:inline-block;padding:12px 18px;background:#f59e0b;color:#0b0b0b;border-radius:999px;text-decoration:none;font-weight:700;">
                    ${template.button}
                </a>
            </p>
            ${expiresAt ? `<p style="font-size:13px;color:#555;">Expiration: ${expiresAt}</p>` : ""}
            <p style="font-size:13px;color:#555;">${template.footer}</p>
        </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: resendFrom,
            to: clientEmail,
            subject: template.subject,
            html
        })
    });

    if (!resendResponse.ok) {
        const error = await resendResponse.text();
        res.status(500).json({ error: "Email send failed", details: error });
        return;
    }

    res.status(200).json({ ok: true });
};
