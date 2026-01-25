(() => {
    const form = document.getElementById("commentForm");
    const notice = document.getElementById("commentNotice");
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const language = (params.get("lang") || "fr").toLowerCase();
    const config = window.PORTFOLIO_CONFIG || {};

    const translations = {
        fr: {
            title: "Laisser un avis",
            subtitle: "Merci pour votre collaboration. Votre retour compte.",
            nameLabel: "Nom & pr\u00e9nom",
            commentLabel: "Votre commentaire",
            namePlaceholder: "Votre nom",
            commentPlaceholder: "Partagez votre exp\u00e9rience",
            submit: "Envoyer mon avis",
            helper: "Publication apr\u00e8s validation.",
            missingToken: "Lien invalide. Merci de contacter Sezer Dogan.",
            success: "Merci ! Votre avis a bien \u00e9t\u00e9 re\u00e7u.",
            error: "Impossible d'envoyer l'avis pour le moment."
        },
        en: {
            title: "Share your feedback",
            subtitle: "Thanks for the collaboration. Your feedback matters.",
            nameLabel: "Full name",
            commentLabel: "Your feedback",
            namePlaceholder: "Your name",
            commentPlaceholder: "Share your experience",
            submit: "Send feedback",
            helper: "Published after approval.",
            missingToken: "Invalid link. Please contact Sezer Dogan.",
            success: "Thank you! Your feedback has been received.",
            error: "Unable to send feedback right now."
        },
        tr: {
            title: "Yorum b\u0131rak\u0131n",
            subtitle: "Birlikte \u00e7al\u0131\u015ft\u0131\u011f\u0131m\u0131z i\u00e7in te\u015fekk\u00fcrler. Geri bildiriminiz \u00f6nemli.",
            nameLabel: "Ad soyad",
            commentLabel: "Yorumunuz",
            namePlaceholder: "Adiniz",
            commentPlaceholder: "Deneyiminizi paylasin",
            submit: "G\u00f6nder",
            helper: "Onaydan sonra yay\u0131nlan\u0131r.",
            missingToken: "Ge\u00e7ersiz ba\u011flant\u0131. L\u00fctfen Sezer Dogan ile ileti\u015fime ge\u00e7in.",
            success: "Te\u015fekk\u00fcler! Yorumunuz al\u0131nd\u0131.",
            error: "\u015eu anda g\u00f6nderilemiyor."
        }
    };

    const t = translations[language] || translations.fr;
    document.documentElement.lang = language;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    const nameInput = document.getElementById("name");
    const commentInput = document.getElementById("comment");
    if (nameInput && t.namePlaceholder) nameInput.placeholder = t.namePlaceholder;
    if (commentInput && t.commentPlaceholder) commentInput.placeholder = t.commentPlaceholder;

    const showNotice = (message, isError = false) => {
        if (!notice) return;
        notice.textContent = message;
        notice.hidden = false;
        notice.classList.toggle("error", isError);
    };

    if (!token) {
        showNotice(t.missingToken, true);
        if (form) {
            form.querySelectorAll("input, textarea, button").forEach((el) => {
                el.disabled = true;
            });
        }
        return;
    }

    const apiBase = config.apiBase || "";

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = form.name.value.trim();
        const comment = form.comment.value.trim();

        if (!name || !comment) {
            showNotice(t.error, true);
            return;
        }

        if (comment.length > 1200) {
            showNotice(t.error, true);
            return;
        }

        form.querySelector("button").disabled = true;

        try {
            const response = await fetch(`${apiBase}/api/submit-testimonial`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token,
                    name,
                    comment,
                    language
                })
            });

            if (!response.ok) {
                throw new Error("Request failed");
            }

            showNotice(t.success, false);
            form.reset();
        } catch (err) {
            showNotice(t.error, true);
        } finally {
            form.querySelector("button").disabled = false;
        }
    });
})();
