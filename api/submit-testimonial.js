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

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { token, name, comment, language } = body;

    if (!token || !name || !comment) {
        res.status(400).json({ error: "Missing fields" });
        return;
    }

    if (comment.length > 1200) {
        res.status(400).json({ error: "Comment too long" });
        return;
    }

    const nowIso = new Date().toISOString();
    const tokenResponse = await fetch(
        `${supabaseUrl}/rest/v1/comment_tokens?token=eq.${encodeURIComponent(token)}&used=is.false&expires_at=gt.${encodeURIComponent(nowIso)}&select=id`,
        {
            headers: {
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
            }
        }
    );

    if (!tokenResponse.ok) {
        res.status(400).json({ error: "Invalid token" });
        return;
    }

    const tokens = await tokenResponse.json();
    const tokenRow = tokens?.[0];

    if (!tokenRow) {
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
            language: language || "fr",
            status: "pending"
        })
    });

    if (!insertResponse.ok) {
        const error = await insertResponse.text();
        res.status(500).json({ error: "Insert failed", details: error });
        return;
    }

    await fetch(`${supabaseUrl}/rest/v1/comment_tokens?id=eq.${tokenRow.id}`, {
        method: "PATCH",
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        },
        body: JSON.stringify({
            used: true,
            used_at: nowIso
        })
    });

    res.status(200).json({ ok: true });
};
