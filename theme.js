(() => {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 7;
    const theme = prefersDark || isNight ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
})();
