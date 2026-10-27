history.pushState({ roleView: true }, '', window.location.href);

window.addEventListener('popstate', () => {
    history.pushState({ roleView: true }, '', window.location.href);
});
