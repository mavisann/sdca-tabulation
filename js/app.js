const STORAGE_KEY_CANDIDATES = 'candidates';
const STORAGE_KEY_STAGE = 'activeStage';
const STORAGE_KEY_SCORES = 'scores';
const DEFAULT_THEME = 'Casual Wear';

let candidates = [];
let activeStage = { activeCandidateId: null, currentTheme: DEFAULT_THEME };
let scores = {};
let currentRole = null;

function readStoredJson(key, fallback) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
}

function initializeData() {
    const legacyCandidates = localStorage.getItem('sdca_candidates');
    const legacyStage = localStorage.getItem('sdca_stage');
    const legacyScores = localStorage.getItem('sdca_scores');

    if (localStorage.getItem(STORAGE_KEY_CANDIDATES) === null) {
        candidates = legacyCandidates
            ? JSON.parse(legacyCandidates).map(candidate => ({
                ...candidate,
                program: candidate.program || ''
            }))
            : [];
        localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
    }

    if (localStorage.getItem(STORAGE_KEY_STAGE) === null) {
        activeStage = legacyStage
            ? JSON.parse(legacyStage)
            : { activeCandidateId: null, currentTheme: DEFAULT_THEME };
        localStorage.setItem(STORAGE_KEY_STAGE, JSON.stringify(activeStage));
    }

    if (localStorage.getItem(STORAGE_KEY_SCORES) === null) {
        scores = legacyScores ? normalizeScores(JSON.parse(legacyScores)) : {};
        localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
    }

    loadState();
    ['sdca_candidates', 'sdca_stage', 'sdca_scores'].forEach(key => localStorage.removeItem(key));
}

function loadState() {
    const storedCandidates = readStoredJson(STORAGE_KEY_CANDIDATES, []);
    candidates = storedCandidates.map(candidate => ({
        ...candidate,
        program: candidate.program || ''
    }));
    if (JSON.stringify(candidates) !== JSON.stringify(storedCandidates)) {
        localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
    }
    activeStage = readStoredJson(STORAGE_KEY_STAGE, {
        activeCandidateId: null,
        currentTheme: DEFAULT_THEME
    });
    const storedScores = readStoredJson(STORAGE_KEY_SCORES, {});
    scores = normalizeScores(storedScores);
    if (JSON.stringify(scores) !== JSON.stringify(storedScores)) {
        localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
        localStorage.setItem(STORAGE_KEY_STAGE, JSON.stringify(activeStage));
        localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
    } catch (error) {
        loadState();
        showAppMessage(
            'Could not save changes. Browser storage may be full; try using a smaller photo.',
            'error'
        );
        throw error;
    }
    window.dispatchEvent(new Event('localStateChange'));
}

function showAppMessage(message, type = 'info') {
    const container = document.getElementById('app-message');
    if (!container) {
        window.alert(message);
        return;
    }

    container.textContent = message;
    container.className = `fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
        type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
    }`;
    container.classList.remove('hidden');
    window.clearTimeout(showAppMessage.timeout);
    showAppMessage.timeout = window.setTimeout(() => container.classList.add('hidden'), 4000);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function normalizeScores(storedScores) {
    const normalized = {};
    Object.entries(storedScores || {}).forEach(([key, value]) => {
        if (candidates.some(candidate => candidate.id === key)) {
            normalized[key] = value;
            return;
        }

        const candidate = candidates.find(item => key.startsWith(`${item.id}_`));
        if (candidate && value && typeof value === 'object') {
            const theme = key.slice(candidate.id.length + 1);
            normalized[candidate.id] ??= {};
            normalized[candidate.id][theme] = value;
        }
    });
    return normalized;
}

function getCandidateScoreTotal(candidateId) {
    return Object.values(scores[candidateId] || {}).reduce(
        (total, score) => total + Number(score.total || 0),
        0
    );
}

function getRankedCandidates({ scoredOnly = false } = {}) {
    return candidates
        .map(candidate => ({
            ...candidate,
            totalScore: getCandidateScoreTotal(candidate.id)
        }))
        .filter(candidate => !scoredOnly || candidate.totalScore > 0)
        .sort((first, second) => (
            second.totalScore - first.totalScore || first.name.localeCompare(second.name)
        ));
}

function initApp(role) {
    initializeData();
    currentRole = role;
    renderAll();
}

function switchRole() {
    window.location.href = './mr_ms_sdca_tabulation.html';
}

function renderAll() {
    if (currentRole === 'admin') renderAdmin();
    if (currentRole === 'judge') renderJudge();
    if (currentRole === 'audience') renderAudience();
}

window.addEventListener('storage', event => {
    if ([STORAGE_KEY_CANDIDATES, STORAGE_KEY_STAGE, STORAGE_KEY_SCORES].includes(event.key)) {
        loadState();
        renderAll();
    }
});

window.addEventListener('localStateChange', () => {
    loadState();
    renderAll();
});
