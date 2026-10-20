const DEFAULT_THEME = 'Casual Wear';
const DEFAULT_CRITERIA = [
    { name: 'Poise & Bearing', maxScore: 10 },
    { name: 'Stage Presence', maxScore: 10 },
    { name: 'Q&A', maxScore: 10 }
];

let candidates = [];
let themes = [];
let themeCriteria = {};
let judges = [];
let activeStage = { activeCandidateId: null, currentTheme: DEFAULT_THEME, updatedAt: null };
let scores = {};
let currentRole = null;
let db = null;
let realtimeChannel = null;
let realtimeRefreshTimeout = null;

async function initializeSupabase() {
    const response = await fetch('/api/config');
    if (!response.ok) {
        throw new Error(`Could not load application configuration (${response.status}).`);
    }

    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
        throw new Error(
            'Supabase configuration is missing. Set SUPABASE_URL and either ' +
            'SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY in your server environment.'
        );
    }
    if (!window.supabase?.createClient) {
        throw new Error('The Supabase JavaScript library did not load.');
    }

    db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function syncData() {
    if (!db) throw new Error('Supabase has not been initialized.');

    const [candidateResult, stageResult, scoreResult, themeResult, criteriaResult, judgeResult] = await Promise.all([
        db.from('candidates').select('*').order('id'),
        db.from('active_stage').select('*').eq('id', true).maybeSingle(),
        db.from('scores').select('*'),
        db.from('themes').select('*').order('sort_order').order('name'),
        db.from('theme_criteria').select('*').order('sort_order').order('name'),
        currentRole === 'admin'
            ? db.from('judges').select('*').order('name')
            : Promise.resolve({ data: [], error: null })
    ]);

    for (const result of [candidateResult, stageResult, scoreResult, themeResult, criteriaResult, judgeResult]) {
        if (result.error) throw result.error;
    }

    candidates = (candidateResult.data || []).map(candidate => ({
        id: candidate.id,
        name: candidate.name,
        program: candidate.program || '',
        image: candidate.image || ''
    }));

    themes = (themeResult.data || []).map(theme => ({
        id: theme.id,
        name: theme.name,
        sortOrder: Number(theme.sort_order || 0)
    }));
    themeCriteria = {};
    (criteriaResult.data || []).forEach(criterion => {
        themeCriteria[criterion.theme_id] ??= [];
        themeCriteria[criterion.theme_id].push({
            id: criterion.id,
            name: criterion.name,
            maxScore: Number(criterion.max_score || 10),
            sortOrder: Number(criterion.sort_order || 0)
        });
    });
    judges = judgeResult.data || [];

    const stage = stageResult.data;
    activeStage = stage
        ? {
            activeCandidateId: stage.active_candidate_id,
            currentTheme: stage.current_theme || DEFAULT_THEME,
            updatedAt: stage.updated_at || null
        }
        : { activeCandidateId: null, currentTheme: DEFAULT_THEME, updatedAt: null };

    scores = {};
    (scoreResult.data || []).forEach(score => {
        if (!candidates.some(candidate => candidate.id === score.candidate_id)) return;
        scores[score.candidate_id] ??= {};
        scores[score.candidate_id][score.theme] ??= [];
        scores[score.candidate_id][score.theme].push({
            id: score.id,
            judgeId: score.judge_id || null,
            judgeName: score.judge_name || 'Judge 1',
            poise: Number(score.poise),
            presence: Number(score.presence),
            qa: Number(score.qa),
            criteria: score.criteria || {},
            remarks: score.remarks || '',
            total: Number(score.total),
            submittedAt: score.submitted_at
        });
    });
}

function getThemeCriteria(themeId) {
    return themeCriteria[themeId]?.length ? themeCriteria[themeId] : DEFAULT_CRITERIA;
}

function getThemeName(themeId) {
    return themes.find(theme => theme.id === themeId)?.name || themeId;
}

function handleSyncError(error) {
    console.error('Supabase synchronization failed:', error);
    const reason = error instanceof Error
        ? error.message
        : error?.message || 'Unknown error';
    showAppMessage(`Supabase sync failed: ${reason}`, 'error');
}

function handleWriteError(error, action) {
    console.error(`Supabase could not ${action}:`, error);
    showAppMessage(`Could not ${action}. Please try again.`, 'error');
}

function subscribeToChanges() {
    if (realtimeChannel) db.removeChannel(realtimeChannel);

    realtimeChannel = db.channel('sdca-tabulation-changes');
    ['candidates', 'active_stage', 'scores', 'themes', 'theme_criteria', 'judges'].forEach(table => {
        ['INSERT', 'UPDATE', 'DELETE'].forEach(event => {
            realtimeChannel.on('postgres_changes', {
                event,
                schema: 'public',
                table
            }, () => {
                window.clearTimeout(realtimeRefreshTimeout);
                realtimeRefreshTimeout = window.setTimeout(async () => {
                    try {
                        await syncData();
                        renderAll();
                    } catch (error) {
                        handleSyncError(error);
                    }
                }, 50);
            });
        });
    });

    realtimeChannel.subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            handleSyncError(error || new Error(`Realtime subscription ${status.toLowerCase()}.`));
        }
    });
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

function getCandidateScoreTotal(candidateId) {
    return Object.values(scores[candidateId] || {})
        .flat()
        .reduce((total, score) => total + Number(score.total || 0), 0);
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

async function initApp(role) {
    currentRole = role;
    try {
        await initializeSupabase();
        if (role === 'judge' && typeof requireJudgeLogin === 'function') {
            await requireJudgeLogin();
        }
        await syncData();
        renderAll();
        subscribeToChanges();
    } catch (error) {
        handleSyncError(error);
    }
}

function switchRole() {
    window.location.href = './mr_ms_sdca_tabulation.html';
}

function renderAll() {
    if (currentRole === 'admin') renderAdmin();
    if (currentRole === 'judge') renderJudge();
    if (currentRole === 'audience') renderAudience();
}
