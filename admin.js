(() => {
    const config = window.PORTFOLIO_CONFIG || {};
    const authPanel = document.getElementById("authPanel");
    const adminPanel = document.getElementById("adminPanel");
    const authNotice = document.getElementById("authNotice");
    const loginForm = document.getElementById("loginForm");
    const inviteForm = document.getElementById("inviteForm");
    const inviteNotice = document.getElementById("inviteNotice");
    const pendingList = document.getElementById("pendingList");
    const logoutBtn = document.getElementById("logoutBtn");

    if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseUrl.includes("YOUR_")) {
        if (authNotice) {
            authNotice.textContent = "Configuration Supabase manquante.";
            authNotice.hidden = false;
            authNotice.classList.add("error");
        }
        return;
    }

    const client = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const apiBase = config.apiBase || "";
    const allowlist = (config.adminEmailAllowlist || []).map((email) => email.toLowerCase());

    const showNotice = (element, message, isError = false) => {
        if (!element) return;
        element.textContent = message;
        element.hidden = false;
        element.classList.toggle("error", isError);
    };

    const hideNotice = (element) => {
        if (!element) return;
        element.hidden = true;
        element.textContent = "";
        element.classList.remove("error");
    };

    const isAllowed = (email) => {
        if (!email) return false;
        if (allowlist.length === 0) return true;
        return allowlist.includes(email.toLowerCase());
    };

    const buildCommentUrl = (token, language) => {
        const base = config.publicSiteUrl || window.location.origin;
        const url = new URL("/commenter.html", base);
        url.searchParams.set("token", token);
        url.searchParams.set("lang", language);
        return url.toString();
    };

    const generateToken = () => {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    };

    const setAuthenticated = (authenticated) => {
        if (authPanel) authPanel.hidden = authenticated;
        if (adminPanel) adminPanel.hidden = !authenticated;
    };

    const requireAdmin = async () => {
        const { data } = await client.auth.getSession();
        const session = data?.session;
        if (!session) {
            setAuthenticated(false);
            return null;
        }

        const email = session.user?.email || "";
        if (!isAllowed(email)) {
            await client.auth.signOut();
            setAuthenticated(false);
            showNotice(authNotice, "Acc\u00e8s refus\u00e9.", true);
            return null;
        }

        setAuthenticated(true);
        return session;
    };

    const renderPending = (items) => {
        if (!pendingList) return;
        pendingList.innerHTML = "";

        if (!items || items.length === 0) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "Aucun avis en attente.";
            pendingList.appendChild(empty);
            return;
        }

        items.forEach((item) => {
            const card = document.createElement("div");
            card.className = "testimonial-card";

            const text = document.createElement("p");
            text.className = "testimonial-text";
            text.textContent = item.comment;

            const meta = document.createElement("div");
            meta.className = "testimonial-meta";

            const name = document.createElement("span");
            name.className = "testimonial-name";
            name.textContent = item.client_name || "Client";

            const status = document.createElement("span");
            status.className = "status-pill pending";
            status.textContent = "En attente";

            meta.append(name, status);

            const actions = document.createElement("div");
            actions.className = "submit-row";

            const approveBtn = document.createElement("button");
            approveBtn.className = "cta";
            approveBtn.type = "button";
            approveBtn.textContent = "Publier";
            approveBtn.addEventListener("click", async () => {
                approveBtn.disabled = true;
                const { error } = await client
                    .from("testimonials")
                    .update({ status: "approved", approved_at: new Date().toISOString() })
                    .eq("id", item.id);

                if (error) {
                    approveBtn.disabled = false;
                    showNotice(inviteNotice, "Impossible de publier cet avis.", true);
                    return;
                }
                card.remove();
                if (pendingList.children.length === 0) {
                    renderPending([]);
                }
            });

            actions.appendChild(approveBtn);

            card.append(text, meta, actions);
            pendingList.appendChild(card);
        });
    };

    const loadPending = async () => {
        if (!pendingList) return;
        const { data, error } = await client
            .from("testimonials")
            .select("id, client_name, comment, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false });

        if (error) {
            pendingList.innerHTML = "<p class=\"muted\">Impossible de charger les avis.</p>";
            return;
        }

        renderPending(data);
    };

    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideNotice(authNotice);
        const email = loginForm.adminEmail.value.trim();

        if (!isAllowed(email)) {
            showNotice(authNotice, "Email non autoris\u00e9.", true);
            return;
        }

        const { error } = await client.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/admin.html`
            }
        });

        if (error) {
            showNotice(authNotice, "Connexion impossible. R\u00e9essayez.", true);
            return;
        }

        showNotice(authNotice, "Lien envoy\u00e9. V\u00e9rifiez votre email.", false);
    });

    inviteForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideNotice(inviteNotice);
        const session = await requireAdmin();
        if (!session) return;

        const name = inviteForm.clientName.value.trim();
        const email = inviteForm.clientEmail.value.trim();
        const language = inviteForm.language.value;
        const expiresDays = parseInt(inviteForm.expires.value, 10) || 7;

        if (!name || !email) {
            showNotice(inviteNotice, "Informations manquantes.", true);
            return;
        }

        const token = generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresDays);

        const { error: insertError } = await client.from("comment_tokens").insert({
            token,
            client_name: name,
            client_email: email,
            language,
            expires_at: expiresAt.toISOString()
        });

        if (insertError) {
            showNotice(inviteNotice, "Impossible de g\u00e9n\u00e9rer le lien.", true);
            return;
        }

        const commentUrl = buildCommentUrl(token, language);

        try {
            const response = await fetch(`${apiBase}/api/send-invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    email,
                    name,
                    language,
                    token,
                    commentUrl,
                    expiresAt: expiresAt.toISOString()
                })
            });

            if (!response.ok) {
                throw new Error("send failed");
            }

            showNotice(
                inviteNotice,
                `Invitation envoy\u00e9e. Lien: ${commentUrl}`,
                false
            );
            inviteForm.reset();
            inviteForm.expires.value = "7";
        } catch (err) {
            showNotice(inviteNotice, "Invitation cr\u00e9\u00e9e mais email non envoy\u00e9.", true);
        }
    });

    logoutBtn?.addEventListener("click", async () => {
        await client.auth.signOut();
        setAuthenticated(false);
    });

    client.auth.onAuthStateChange(async () => {
        const session = await requireAdmin();
        if (session) {
            loadPending();
        }
    });

    requireAdmin().then((session) => {
        if (session) {
            loadPending();
        }
    });
})();
