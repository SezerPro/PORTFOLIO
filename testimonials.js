(() => {
    const config = window.PORTFOLIO_CONFIG || {};
    const grid = document.getElementById("testimonialsGrid");
    const empty = document.getElementById("testimonialsEmpty");

    if (!grid) {
        return;
    }

    if (!config.supabaseUrl || !config.supabaseAnonKey || config.supabaseUrl.includes("YOUR_")) {
        grid.innerHTML = "";
        const warning = document.createElement("div");
        warning.className = "testimonial-card";
        warning.innerHTML = "<p class=\"testimonial-text\">Configuration Supabase manquante.</p>";
        grid.appendChild(warning);
        return;
    }

    const client = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    const formatDate = (value) => {
        if (!value) return "";
        try {
            const date = new Date(value);
            return date.toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
        } catch (err) {
            return "";
        }
    };

    const renderCard = (item) => {
        const card = document.createElement("article");
        card.className = "testimonial-card";

        const text = document.createElement("p");
        text.className = "testimonial-text";
        text.textContent = item.comment || "";

        const meta = document.createElement("div");
        meta.className = "testimonial-meta";

        const name = document.createElement("span");
        name.className = "testimonial-name";
        name.textContent = item.client_name || "Client";

        const dot = document.createElement("span");
        dot.textContent = "•";

        const date = document.createElement("span");
        date.textContent = formatDate(item.created_at);

        meta.append(name, dot, date);
        card.append(text, meta);
        return card;
    };

    const loadTestimonials = async () => {
        const { data, error } = await client
            .from("testimonials")
            .select("client_name, comment, created_at")
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(6);

        grid.innerHTML = "";

        if (error) {
            const errorCard = document.createElement("div");
            errorCard.className = "testimonial-card";
            errorCard.innerHTML = "<p class=\"testimonial-text\">Impossible de charger les avis pour le moment.</p>";
            grid.appendChild(errorCard);
            return;
        }

        if (!data || data.length === 0) {
            if (empty) {
                empty.hidden = false;
            }
            return;
        }

        if (empty) {
            empty.hidden = true;
        }

        data.forEach((item) => {
            grid.appendChild(renderCard(item));
        });
    };

    loadTestimonials();
})();
