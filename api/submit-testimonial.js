const ALLOWED_LANGUAGES = new Set(["fr", "en", "tr"]);

const readBody = (req) => {
    if (!req.body) return {};
    if (typeof req.body === "string") {
        return JSON.parse(req.body);
    }
    return req.body;
};

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        res.status(500).json({ error: "Missing server configuration" });
        return;
    }

    try {
        const body = readBody(req);
        const token = String(body?.token || "").trim();
        const name = String(body?.name || "").trim();
        const comment = String(body?.comment || "").trim();
        const rawLanguage = String(body?.language || "fr").toLowerCase();
        const language = ALLOWED_LANGUAGES.has(rawLanguage) ? rawLanguage : "fr";

        if (!token || !name || !comment) {
            res.status(400).json({ error: "Missing fields" });
            return;
        }

        if (!/^[a-f0-9]{32}$/i.test(token)) {
            res.status(400).json({ error: "Invalid token" });
            return;
        }

        if (name.length > 120) {
            res.status(400).json({ error: "Name too long" });
            return;
        }

        if (comment.length > 1200) {
            res.status(400).json({ error: "Comment too long" });
            return;
        }

        const nowIso = new Date().toISOString();
        const consumeTokenResponse = await fetch(
            `${supabaseUrl}/rest/v1/comment_tokens?token=eq.${encodeURIComponent(token)}&used=is.false&expires_at=gt.${encodeURIComponent(nowIso)}&select=id`,
            {
                method: "PATCH",
                headers: {
                    apikey: serviceRoleKey,
                    Authorization: `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                    Prefer: "return=representation"
                },
                body: JSON.stringify({
                    used: true,
                    used_at: nowIso
                })
            }
        );

        if (!consumeTokenResponse.ok) {
            console.error("submit-testimonial: token consume failed", consumeTokenResponse.status);
            res.status(400).json({ error: "Invalid token" });
            return;
        }

        const consumedRows = await consumeTokenResponse.json();
        const tokenRow = consumedRows?.[0];

        if (!tokenRow?.id) {
            res.status(400).json({ error: "Invalid token" });
            return;
        }

        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/testimonials`, {
            method: "POST",
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal"
            },
            body: JSON.stringify({
                token_id: tokenRow.id,
                client_name: name,
                comment,
                language,
                status: "pending"
            })
        });

        if (!insertResponse.ok) {
            const details = await insertResponse.text();
            console.error("submit-testimonial: insert failed", insertResponse.status, details);

            if (insertResponse.status === 409) {
                res.status(400).json({ error: "Invalid token" });
                return;
            }

            res.status(500).json({ error: "Insert failed" });
            return;
        }

        res.status(200).json({ ok: true });
    } catch (error) {
        console.error("submit-testimonial: unexpected error", error);
        if (error instanceof SyntaxError) {
            res.status(400).json({ error: "Invalid JSON body" });
            return;
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
