history.pushState({ roleView: true }, '', window.location.href);

const savedTheme = localStorage.getItem('sdca-theme') || 'light';
document.documentElement.dataset.theme = savedTheme;

function addThemeToggle() {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'theme-toggle btn btn-sm btn-ghost';
    toggle.setAttribute('aria-label', 'Toggle color theme');
    toggle.title = 'Toggle color theme';
    toggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'night' ? 'light' : 'night';
        document.documentElement.dataset.theme = nextTheme;
        localStorage.setItem('sdca-theme', nextTheme);
        updateThemeToggle(toggle);
    });

    const headerActions = document.querySelector('header .flex.items-center.gap-2');
    if (headerActions) {
        headerActions.appendChild(toggle);
    } else {
        toggle.classList.add('fixed', 'right-4', 'top-4', 'z-50');
        document.body.appendChild(toggle);
    }
    updateThemeToggle(toggle);
}

function updateThemeToggle(toggle) {
    const isNight = document.documentElement.dataset.theme === 'night';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = isNight ? '#111827' : '#f8fafc';
    toggle.innerHTML = `<i class="fa-solid ${isNight ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i><span class="sr-only">${isNight ? 'Use light theme' : 'Use dark theme'}</span>`;
}

addThemeToggle();

window.addEventListener('popstate', () => {
    history.pushState({ roleView: true }, '', window.location.href);
});
