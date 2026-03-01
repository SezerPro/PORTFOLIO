(() => {
    const config = window.PORTFOLIO_CONFIG || {};
    const authPanel = document.getElementById("authPanel");
    const adminPanel = document.getElementById("adminPanel");
    const authNotice = document.getElementById("authNotice");
    const loginForm = document.getElementById("loginForm");
    const inviteForm = document.getElementById("inviteForm");
    const inviteNotice = document.getElementById("inviteNotice");
    const pendingList = document.getElementById("pendingList");
    const loadMorePendingBtn = document.getElementById("loadMorePendingBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    const PAGE_SIZE = 20;
    const POLL_INTERVAL_MS = 45000;
    const REQUEST_TIMEOUT_MS = 15000;
    const WATCHDOG_TIMEOUT_MS = 20000;

    let pendingItems = [];
    let pendingOffset = 0;
    let hasMorePending = false;
    let isLoadingPending = false;
    let isLoggingIn = false;
    let isInviting = false;
    let pendingPollTimer = null;
    const approvingIds = new Set();

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

    const compactError = (value, max = 180) => {
        const text = String(value || "")
            .replace(/\s+/g, " ")
            .trim();
        if (!text) return "";
        return text.length > max ? `${text.slice(0, max)}...` : text;
    };

    const parseApiError = async (response) => {
        const status = response?.status;
        let detail = "";
        try {
            const raw = await response.text();
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    detail = compactError(parsed?.error || parsed?.message || raw);
                } catch {
                    detail = compactError(raw);
                }
            }
        } catch {
            detail = "";
        }

        if (status === 401) {
            return "Session admin invalide. Reconnectez-vous.";
        }
        if (status === 403) {
            return "Email admin refuse cote serveur (ADMIN_EMAILS/public.admins).";
        }
        if (status === 500 && detail.includes("Missing server configuration")) {
            return "Configuration serveur manquante (SUPABASE/RESEND/ADMIN_EMAILS).";
        }
        if (!detail) {
            return `Erreur HTTP ${status || "inconnue"}.`;
        }
        return `HTTP ${status || "?"}: ${detail}`;
    };

    const withTimeout = (promise, timeoutMs, timeoutMessage) =>
        Promise.race([
            promise,
            new Promise((_, reject) => {
                window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            })
        ]);

    const safeSignOut = async () => {
        try {
            await withTimeout(
                client.auth.signOut(),
                REQUEST_TIMEOUT_MS,
                "Timeout lors de la deconnexion."
            );
        } catch {
            // Ignore hard failures: UI already switched to logged-out state.
        }
    };

    const isAllowed = (email) => {
        if (!email) return false;
        if (allowlist.length === 0) return true;
        return allowlist.includes(email.toLowerCase());
    };

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    const clampDays = (value, min, max) => {
        const parsed = Number.parseInt(String(value), 10);
        if (!Number.isFinite(parsed)) return min;
        return Math.max(min, Math.min(max, parsed));
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

    const stopPendingPolling = () => {
        if (!pendingPollTimer) return;
        window.clearInterval(pendingPollTimer);
        pendingPollTimer = null;
    };

    const startPendingPolling = () => {
        stopPendingPolling();
        pendingPollTimer = window.setInterval(async () => {
            const session = await requireAdmin();
            if (!session) return;
            await loadPending({ reset: true, silent: true });
        }, POLL_INTERVAL_MS);
    };

    const requireAdmin = async () => {
        let session = null;
        try {
            const { data, error } = await withTimeout(
                client.auth.getSession(),
                REQUEST_TIMEOUT_MS,
                "Timeout lors de la verification de session."
            );
            if (error) {
                throw error;
            }
            session = data?.session || null;
        } catch {
            setAuthenticated(false);
            stopPendingPolling();
            return null;
        }

        if (!session) {
            setAuthenticated(false);
            stopPendingPolling();
            return null;
        }

        const email = session.user?.email || "";
        if (!isAllowed(email)) {
            await safeSignOut();
            setAuthenticated(false);
            stopPendingPolling();
            showNotice(authNotice, "Acces refuse.", true);
            return null;
        }

        setAuthenticated(true);
        return session;
    };

    const updateLoadMoreState = () => {
        if (!loadMorePendingBtn) return;
        loadMorePendingBtn.hidden = !hasMorePending || pendingItems.length === 0;
        loadMorePendingBtn.disabled = isLoadingPending;
        loadMorePendingBtn.textContent = isLoadingPending ? "Chargement..." : "Charger plus";
    };

    const renderPending = () => {
        if (!pendingList) return;
        pendingList.innerHTML = "";

        if (!pendingItems.length) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "Aucun avis en attente.";
            pendingList.appendChild(empty);
            updateLoadMoreState();
            return;
        }

        pendingItems.forEach((item) => {
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
            approveBtn.dataset.action = "approve";
            approveBtn.dataset.id = String(item.id);
            approveBtn.disabled = approvingIds.has(item.id);

            actions.appendChild(approveBtn);
            card.append(text, meta, actions);
            pendingList.appendChild(card);
        });

        updateLoadMoreState();
    };

    const mergeUniqueById = (existing, incoming) => {
        const map = new Map(existing.map((item) => [item.id, item]));
        incoming.forEach((item) => map.set(item.id, item));
        return Array.from(map.values());
    };

    const loadPending = async ({ reset = false, silent = false } = {}) => {
        if (!pendingList || isLoadingPending) return;

        if (reset) {
            pendingOffset = 0;
            hasMorePending = false;
        }

        isLoadingPending = true;
        updateLoadMoreState();

        const from = pendingOffset;
        const to = pendingOffset + PAGE_SIZE - 1;

        const { data, error } = await client
            .from("testimonials")
            .select("id, client_name, comment, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            if (!silent) {
                pendingList.innerHTML = "<p class=\"muted\">Impossible de charger les avis.</p>";
            }
            isLoadingPending = false;
            updateLoadMoreState();
            return;
        }

        const page = Array.isArray(data) ? data : [];

        if (reset) {
            pendingItems = page;
        } else {
            pendingItems = mergeUniqueById(pendingItems, page);
        }

        hasMorePending = page.length === PAGE_SIZE;
        pendingOffset = from + page.length;

        isLoadingPending = false;
        renderPending();
    };

    const approveTestimonial = async (id) => {
        if (!id || approvingIds.has(id)) return;

        approvingIds.add(id);
        renderPending();

        const { error } = await client
            .from("testimonials")
            .update({ status: "approved", approved_at: new Date().toISOString() })
            .eq("id", id);

        approvingIds.delete(id);

        if (error) {
            showNotice(inviteNotice, "Impossible de publier cet avis.", true);
            renderPending();
            return;
        }

        pendingItems = pendingItems.filter((item) => item.id !== id);
        if (!pendingItems.length && hasMorePending) {
            await loadPending({ reset: true, silent: true });
            return;
        }
        renderPending();
    };

    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isLoggingIn) return;

        hideNotice(authNotice);

        const submitBtn = loginForm.querySelector("button[type='submit']");
        const email = loginForm.adminEmail.value.trim();

        if (!isAllowed(email)) {
            showNotice(authNotice, "Email non autorise.", true);
            return;
        }

        isLoggingIn = true;
        if (submitBtn) submitBtn.disabled = true;

        let error = null;
        try {
            const result = await withTimeout(
                client.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: `${window.location.origin}/admin.html`
                    }
                }),
                REQUEST_TIMEOUT_MS,
                "Timeout lors de l'envoi du lien magique."
            );
            error = result?.error || null;
        } catch (err) {
            error = err;
        }

        isLoggingIn = false;
        if (submitBtn) submitBtn.disabled = false;

        if (error) {
            showNotice(authNotice, "Connexion impossible. Reessayez.", true);
            return;
        }

        showNotice(authNotice, "Lien envoye. Verifiez votre email.", false);
    });

    inviteForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isInviting) return;

        hideNotice(inviteNotice);

        const submitBtn = inviteForm.querySelector("button[type='submit']");
        if (submitBtn) submitBtn.disabled = true;
        isInviting = true;
        const inviteWatchdog = window.setTimeout(() => {
            if (!isInviting) return;
            isInviting = false;
            if (submitBtn) submitBtn.disabled = false;
            showNotice(inviteNotice, "Operation bloquee (timeout). Reessayez.", true);
        }, WATCHDOG_TIMEOUT_MS);

        try {
            showNotice(inviteNotice, "Traitement en cours...", false);

            const session = await requireAdmin();
            if (!session) {
                showNotice(inviteNotice, "Session admin invalide. Reconnectez-vous.", true);
                return;
            }

            const name = inviteForm.clientName.value.trim();
            const email = inviteForm.clientEmail.value.trim();
            const language = inviteForm.language.value;
            const expiresDays = clampDays(inviteForm.expires.value, 1, 30);
            inviteForm.expires.value = String(expiresDays);

            if (!name || !email) {
                showNotice(inviteNotice, "Informations manquantes.", true);
                return;
            }

            if (name.length > 120) {
                showNotice(inviteNotice, "Nom trop long (120 caracteres max).", true);
                return;
            }

            if (!isValidEmail(email)) {
                showNotice(inviteNotice, "Email invalide.", true);
                return;
            }

            const token = generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresDays);

            const { error: insertError } = await withTimeout(
                client.from("comment_tokens").insert({
                    token,
                    client_name: name,
                    client_email: email,
                    language,
                    expires_at: expiresAt.toISOString()
                }),
                REQUEST_TIMEOUT_MS,
                "Timeout lors de la creation du lien."
            );

            if (insertError) {
                const detail = compactError(insertError.message || insertError.details || insertError.code);
                showNotice(
                    inviteNotice,
                    detail ? `Impossible de generer le lien: ${detail}` : "Impossible de generer le lien.",
                    true
                );
                return;
            }

            const commentUrl = buildCommentUrl(token, language);

            const response = await withTimeout(
                fetch(`${apiBase}/api/send-invite`, {
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
                }),
                REQUEST_TIMEOUT_MS,
                "Timeout lors de l'envoi de l'email."
            );

            if (!response.ok) {
                const reason = await parseApiError(response);
                showNotice(inviteNotice, `Invitation creee mais email non envoye: ${reason}`, true);
                return;
            }

            showNotice(inviteNotice, `Invitation envoyee. Lien: ${commentUrl}`, false);
            inviteForm.reset();
            inviteForm.expires.value = "7";
        } catch (err) {
            const detail = compactError(err?.message);
            showNotice(
                inviteNotice,
                detail
                    ? `Invitation creee mais email non envoye: erreur inattendue (${detail}).`
                    : "Invitation creee mais email non envoye: erreur inattendue.",
                true
            );
        } finally {
            window.clearTimeout(inviteWatchdog);
            isInviting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    pendingList?.addEventListener("click", async (event) => {
        const approveBtn = event.target.closest("button[data-action='approve']");
        if (!approveBtn) return;
        await approveTestimonial(approveBtn.dataset.id);
    });

    loadMorePendingBtn?.addEventListener("click", async () => {
        await loadPending({ reset: false });
    });

    logoutBtn?.addEventListener("click", async () => {
        stopPendingPolling();
        setAuthenticated(false);
        hideNotice(inviteNotice);
        showNotice(authNotice, "Deconnexion en cours...", false);

        try {
            await withTimeout(
                client.auth.signOut(),
                REQUEST_TIMEOUT_MS,
                "Timeout lors de la deconnexion."
            );
            hideNotice(authNotice);
        } catch {
            showNotice(authNotice, "Deconnexion locale effectuee (session distante incertaine).", true);
        }
    });

    client.auth.onAuthStateChange(async () => {
        const session = await requireAdmin();
        if (!session) return;
        await loadPending({ reset: true });
        startPendingPolling();
    });

    requireAdmin().then(async (session) => {
        if (!session) return;
        await loadPending({ reset: true });
        startPendingPolling();
    });
})();
