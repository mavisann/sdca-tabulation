let candidates = [];
let themes = [];
let themeCriteria = {};
let judges = [];
let activeStage = { activeCandidateId: null, currentTheme: null, updatedAt: null };
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
            currentTheme: stage.current_theme || null,
            updatedAt: stage.updated_at || null
        }
        : { activeCandidateId: null, currentTheme: null, updatedAt: null };

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
    return themeCriteria[themeId] || [];
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
    realtimeChannel.on('broadcast', { event: 'admin-data-reset' }, async ({ payload }) => {
        try {
            await syncData();
            renderAll();
            showAppMessage(`The administrator reset ${payload?.kind || 'data'}.`);
        } catch (error) {
            handleSyncError(error);
        }
    });
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

function getCandidateAverageScore(candidateId) {
    const totals = Object.values(scores[candidateId] || {})
        .flat()
        .map(score => Number(score.total))
        .filter(Number.isFinite);
    return totals.length ? totals.reduce((sum, total) => sum + total, 0) / totals.length : 0;
}

function getJudgeScoreTotal(candidateId, judgeId) {
    return Object.values(scores[candidateId] || {})
        .flat()
        .filter(score => judgeId
            ? score.judgeId === judgeId
            : score.judgeName === getJudgeName())
        .reduce((total, score) => total + Number(score.total || 0), 0);
}

function getJudgeRankedCandidates(judgeId) {
    return candidates
        .map(candidate => ({
            ...candidate,
            totalScore: getJudgeScoreTotal(candidate.id, judgeId)
        }))
        .filter(candidate => candidate.totalScore > 0)
        .sort((first, second) => (
            second.totalScore - first.totalScore || first.name.localeCompare(second.name)
        ));
}

function openConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm }) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return Promise.resolve(window.confirm(message));
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    const confirmButton = document.getElementById('confirm-modal-confirm');
    confirmButton.textContent = confirmLabel;
    modal.showModal();
    return new Promise(resolve => {
        let settled = false;
        const close = result => {
            if (settled) return;
            settled = true;
            modal.close();
            confirmButton.removeEventListener('click', confirm);
            document.getElementById('confirm-modal-cancel').removeEventListener('click', cancel);
            modal.removeEventListener('cancel', cancelEvent);
            resolve(result);
        };
        const confirm = () => {
            close(true);
            if (onConfirm) onConfirm();
        };
        const cancel = () => close(false);
        const cancelEvent = event => {
            event.preventDefault();
            cancel();
        };
        confirmButton.addEventListener('click', confirm, { once: true });
        document.getElementById('confirm-modal-cancel').addEventListener('click', cancel, { once: true });
        modal.addEventListener('cancel', cancelEvent, { once: true });
    });
}

async function resetAdminData(kind, label, rpcName) {
    const confirmed = await openConfirmModal({
        title: `${label}?`,
        message: `This permanently deletes the ${label.toLowerCase()} data. This action cannot be undone.`,
        confirmLabel: label
    });
    if (!confirmed) return;
    const { error } = await db.rpc(rpcName);
    if (error) {
        console.error(`Supabase could not ${label.toLowerCase()}:`, error);
        showAppMessage(`Could not ${label.toLowerCase()}: ${error.message || 'Please run the latest schema migration.'}`, 'error');
        return;
    }
    if (realtimeChannel) {
        await realtimeChannel.send({
            type: 'broadcast',
            event: 'admin-data-reset',
            payload: { kind, resetAt: new Date().toISOString() }
        });
    }
    await syncData();
    renderAll();
    showAppMessage(`${label} completed for all connected pages.`);
}

function getRankedCandidates({ scoredOnly = false } = {}) {
    return candidates
        .map(candidate => ({
            ...candidate,
            totalScore: getCandidateAverageScore(candidate.id)
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
