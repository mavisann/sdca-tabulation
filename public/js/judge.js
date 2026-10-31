const JUDGE_PHOTO_FALLBACK = 'https://placehold.co/600x800/e0e7ff/3730a3?text=Candidate';
let authenticatedJudge = null;

function getJudgeName() {
    return authenticatedJudge?.name || 'Judge 1';
}

function setJudgeContent(visible) {
    document.getElementById('judge-login').classList.toggle('hidden', visible);
    document.querySelectorAll('[data-judge-content]').forEach(element => {
        element.classList.toggle('hidden', !visible);
    });
}

async function requireJudgeLogin() {
    setJudgeContent(false);
    return new Promise(resolve => {
        document.getElementById('judge-login-form').addEventListener('submit', async event => {
            event.preventDefault();
            const input = document.getElementById('judge-access-code');
            const errorMessage = document.getElementById('judge-login-error');
            errorMessage.classList.add('hidden');
            const code = input.value.trim().toUpperCase();
            const { data, error } = await db.rpc('authenticate_judge', { input_code: code });
            if (error || !data?.[0]) {
                errorMessage.textContent = 'That judge code is not active or was not found.';
                errorMessage.classList.remove('hidden');
                return;
            }
            authenticatedJudge = { id: data[0].id, name: data[0].name };
            document.getElementById('judge-name').textContent = authenticatedJudge.name;
            setJudgeContent(true);
            resolve();
        }, { once: true });
    });
}

function renderScoreOptions(criteria = getThemeCriteria(activeStage.currentTheme)) {
    const container = document.getElementById('score-criteria-options');
    if (!container) return;
    container.innerHTML = criteria.map((criterion, criterionIndex) => {
        const maxScore = Math.max(4, Math.min(10, criterion.maxScore));
        return `
        <fieldset class="score-fieldset rounded-2xl border border-base-300 bg-base-200 p-4">
            <legend class="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold text-base-content"><span>${escapeHtml(criterion.name)}</span><span class="badge badge-primary badge-sm font-extrabold">4–${maxScore}</span></legend>
            <input class="score-input w-full rounded-xl border border-base-300 bg-base-100 px-3 py-3 text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" type="number" name="score-criterion-${criterionIndex}" min="4" max="${maxScore}" step="0.01" inputmode="decimal" required aria-label="${escapeHtml(criterion.name)} score" placeholder="4.00–${maxScore}.00">
        </fieldset>`;
    }).join('');
}

function showJudgeWaiting(title, copy) {
    document.getElementById('judge-active').classList.add('hidden');
    document.getElementById('judge-waiting').classList.remove('hidden');
    document.getElementById('judge-waiting-title').textContent = title;
    document.getElementById('judge-waiting-copy').textContent = copy;
}

function renderJudge() {
    renderJudgeLeaderboards();
    const stageCandidates = getStageCandidates();
    if (stageCandidates.length === 0) {
        document.getElementById('scoring-form').dataset.scoreKey = '';
        showJudgeWaiting(
            'Waiting for candidate to take the stage...',
            'The stage manager will introduce the next contestant shortly.'
        );
        return;
    }

    const scoreKey = `${stageCandidates.map(candidate => candidate.id).join('-')}_${activeStage.currentTheme}_${activeStage.updatedAt || 'new'}`;
    const form = document.getElementById('scoring-form');
    renderScoreOptions();
    const hasScored = stageCandidates.every(candidate => (scores[candidate.id]?.[activeStage.currentTheme] || [])
        .some(score => authenticatedJudge?.id
            ? score.judgeId === authenticatedJudge.id
            : score.judgeName === getJudgeName()));
    if (hasScored) {
        form.dataset.scoreKey = '';
        showJudgeWaiting(
            'Score submitted — awaiting next contestant',
            `This group has already been scored for ${getThemeName(activeStage.currentTheme)} by ${getJudgeName()}. You can continue when the stage manager selects another group or theme.`
        );
        return;
    }
    if (form.dataset.scoreKey !== scoreKey) {
        form.reset();
        form.dataset.scoreKey = scoreKey;
    }
    document.getElementById('judge-active').classList.remove('hidden');
    document.getElementById('judge-waiting').classList.add('hidden');
    document.getElementById('judge-stage-candidates').innerHTML = stageCandidates.map(candidate => `
        <article class="rounded-2xl border-4 border-base-100 bg-base-300 p-3 shadow-sm">
            <img src="${escapeHtml(candidate.image)}" alt="${escapeHtml(candidate.name)} portrait" class="h-56 w-full rounded-xl object-contain" onerror="this.src='${JUDGE_PHOTO_FALLBACK}'">
            <p class="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">${candidate.category} · ${escapeHtml(candidate.id)}</p>
            <h2 class="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">${escapeHtml(candidate.name)}</h2>
            <p class="mt-1 text-sm font-medium text-slate-600">${escapeHtml(candidate.program)}</p>
        </article>`).join('');
    document.getElementById('judge-theme-badge').textContent = getThemeName(activeStage.currentTheme);
}

async function submitScores(event) {
    event.preventDefault();
    const stageCandidates = getStageCandidates();
    if (stageCandidates.length === 0) {
        renderJudge();
        return;
    }

    const criteria = getThemeCriteria(activeStage.currentTheme);
    const values = {};
    for (const [criterionIndex, criterion] of criteria.entries()) {
        const selected = document.querySelector(`input[name="score-criterion-${criterionIndex}"]`);
        const value = Number(selected?.value);
        if (!selected || !Number.isFinite(value) || value < 4 || value > 10 || value > criterion.maxScore) {
            showAppMessage('Select a score for every scoring basis.', 'error');
            return;
        }
        values[criterion.id || criterion.name] = value;
    }

    values.remarks = document.getElementById('score-remarks').value.trim();
    values.total = criteria.reduce(
        (total, criterion) => total + Number(values[criterion.id || criterion.name] || 0),
        0
    );
    values.submittedAt = new Date().toISOString();
    const confirmed = await openConfirmModal({
        title: 'Confirm score submission',
        message: `Submit your scores for ${stageCandidates.map(candidate => candidate.name).join(' and ')}? You will not be able to score this group and theme again.`,
        confirmLabel: 'Submit score'
    });
    if (!confirmed) return;
    try {
        const scoreValues = criteria.map(criterion => values[criterion.id || criterion.name]);
        const { error } = await db.from('scores').insert(stageCandidates.map(candidate => ({
            candidate_id: candidate.id,
            theme: activeStage.currentTheme,
            judge_id: authenticatedJudge.id,
            judge_name: getJudgeName(),
            poise: scoreValues[0] ?? null,
            presence: scoreValues[1] ?? null,
            qa: scoreValues[2] ?? null,
            criteria: Object.fromEntries(criteria.map(criterion => [
                criterion.id || criterion.name,
                {
                    name: criterion.name,
                    maxScore: criterion.maxScore,
                    value: values[criterion.id || criterion.name]
                }
            ])),
            remarks: values.remarks,
            total: Number(values.total.toFixed(2)),
            submitted_at: values.submittedAt
        })));
        if (error) throw error;
        await syncData();
        renderAll();
    } catch (error) {
        handleWriteError(error, 'submit the score');
        return;
    }
    showAppMessage('Score submitted successfully.');
}

document.getElementById('scoring-form').addEventListener('submit', submitScores);
function renderJudgeLeaderboards() {
    const renderList = (containerId, ranked, scoreLabel) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ranked.length
            ? ranked.map((candidate, index) => `<article class="flex items-center gap-3 rounded-xl border ${index === 0 ? 'border-amber-300 bg-amber-50 shadow-md' : 'border-slate-100 bg-white'} p-3"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg ${index === 0 ? 'bg-amber-200 text-amber-900' : 'bg-indigo-50 text-indigo-700'} text-sm font-black">${index + 1}</span><div class="min-w-0 flex-1"><p class="truncate text-sm font-bold text-slate-800">${escapeHtml(candidate.name)}</p><p class="truncate text-xs text-slate-500">${escapeHtml(candidate.program)}</p></div><strong class="text-sm text-indigo-700">${scoreLabel ? candidate.totalScore.toFixed(2) : candidate.averageScore.toFixed(2)}</strong></article>`).join('')
            : '<p class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No scored candidates yet.</p>';
    };
    ['Mr', 'Ms'].forEach(category => {
        renderList(`judge-personal-${category.toLowerCase()}`, getJudgeRankedCandidates(authenticatedJudge?.id).filter(candidate => candidate.category === category), true);
        renderList(`judge-overall-${category.toLowerCase()}`, getOverallRankedCandidates().filter(candidate => candidate.category === category && candidate.scored), false);
    });
}

document.getElementById('btn-open-judge-leaderboards').addEventListener('click', () => {
    renderJudgeLeaderboards();
    document.getElementById('judge-leaderboard-modal').showModal();
});
document.getElementById('btn-close-judge-leaderboards').addEventListener('click', () => document.getElementById('judge-leaderboard-modal').close());
document.getElementById('btn-judge-logout').addEventListener('click', async () => {
    const confirmed = await openConfirmModal({
        title: 'Log out of judge panel?',
        message: 'You will need your judge access code to open the scoring panel again.',
        confirmLabel: 'Log out'
    });
    if (!confirmed) return;
    authenticatedJudge = null;
    setJudgeContent(false);
    document.getElementById('judge-login-form').reset();
});
initApp('judge');
