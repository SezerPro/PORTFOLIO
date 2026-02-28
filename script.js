(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const root = document.documentElement;
    const hero = document.querySelector(".hero");
    const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    const revealTargets = Array.from(
        document.querySelectorAll(
            ".panel, .project-card, .skill-column, .testimonial-card, .contact-card, .hero-card, .contact-form, .service-card, .process-step, .proof-item, .cta-tile"
        )
    );

    const setActiveNav = (id) => {
        navLinks.forEach((link) => {
            const active = link.getAttribute("href") === `#${id}`;
            link.classList.toggle("is-active", active);
            if (active) {
                link.setAttribute("aria-current", "true");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    if (!prefersReducedMotion && revealTargets.length) {
        revealTargets.forEach((el, index) => {
            el.classList.add("reveal-on-scroll");
            el.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 45}ms`);
        });

        const revealObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                });
            },
            {
                threshold: 0.14,
                rootMargin: "0px 0px -6% 0px"
            }
        );

        revealTargets.forEach((el) => revealObserver.observe(el));
    } else {
        revealTargets.forEach((el) => el.classList.add("is-visible"));
    }

    if (hero && !prefersReducedMotion) {
        let raf = null;
        let pendingX = 50;
        let pendingY = 30;

        const applySpotlight = () => {
            hero.style.setProperty("--spot-x", `${pendingX}%`);
            hero.style.setProperty("--spot-y", `${pendingY}%`);
            raf = null;
        };

        hero.addEventListener("pointermove", (event) => {
            const rect = hero.getBoundingClientRect();
            pendingX = ((event.clientX - rect.left) / rect.width) * 100;
            pendingY = ((event.clientY - rect.top) / rect.height) * 100;

            if (!raf) {
                raf = window.requestAnimationFrame(applySpotlight);
            }
        });

        hero.addEventListener("pointerleave", () => {
            pendingX = 78;
            pendingY = 18;
            if (!raf) {
                raf = window.requestAnimationFrame(applySpotlight);
            }
        });
    }

    const sectionIds = navLinks
        .map((link) => link.getAttribute("href")?.slice(1))
        .filter(Boolean);
    const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter(Boolean);

    if (sections.length) {
        const sectionObserver = new IntersectionObserver(
            (entries) => {
                const visibleEntries = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

                if (!visibleEntries.length) return;
                setActiveNav(visibleEntries[0].target.id);
            },
            {
                threshold: [0.15, 0.35, 0.55],
                rootMargin: "-20% 0px -55% 0px"
            }
        );

        sections.forEach((section) => sectionObserver.observe(section));
        setActiveNav(sections[0].id);
    }

    window.addEventListener(
        "scroll",
        () => {
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const progress = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
            root.style.setProperty("--scroll-progress", `${Math.min(Math.max(progress, 0), 100)}%`);
        },
        { passive: true }
    );
})();
