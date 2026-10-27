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
            <input class="score-input w-full rounded-xl border border-base-300 bg-base-100 px-3 py-3 text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" type="number" name="score-criterion-${criterionIndex}" min="4" max="${maxScore}" step="0.1" inputmode="decimal" required aria-label="${escapeHtml(criterion.name)} score" placeholder="4.0–${maxScore}">
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
    const candidate = candidates.find(item => item.id === activeStage.activeCandidateId);
    if (!candidate) {
        document.getElementById('scoring-form').dataset.scoreKey = '';
        showJudgeWaiting(
            'Waiting for candidate to take the stage...',
            'The stage manager will introduce the next contestant shortly.'
        );
        return;
    }

    const scoreKey = `${candidate.id}_${activeStage.currentTheme}_${activeStage.updatedAt || 'new'}`;
    const form = document.getElementById('scoring-form');
    renderScoreOptions();
    const hasScored = (scores[candidate.id]?.[activeStage.currentTheme] || [])
        .some(score => authenticatedJudge?.id
            ? score.judgeId === authenticatedJudge.id
            : score.judgeName === getJudgeName());
    if (hasScored) {
        form.dataset.scoreKey = '';
        showJudgeWaiting(
            'Score submitted — awaiting next contestant',
            `${candidate.name} has already been scored for ${getThemeName(activeStage.currentTheme)} by ${getJudgeName()}. You can continue when the stage manager selects another contestant or theme.`
        );
        return;
    }
    if (form.dataset.scoreKey !== scoreKey) {
        form.reset();
        form.dataset.scoreKey = scoreKey;
    }
    document.getElementById('judge-active').classList.remove('hidden');
    document.getElementById('judge-waiting').classList.add('hidden');
    const image = document.getElementById('judge-cand-img');
    image.src = candidate.image;
    image.onerror = () => { image.src = JUDGE_PHOTO_FALLBACK; };
    image.alt = `${candidate.name} portrait`;
    document.getElementById('judge-cand-id').textContent = candidate.id;
    document.getElementById('judge-cand-name').textContent = candidate.name;
    document.getElementById('judge-cand-program').textContent = candidate.program;
    document.getElementById('judge-theme-badge').textContent = getThemeName(activeStage.currentTheme);
}

async function submitScores(event) {
    event.preventDefault();
    const candidate = candidates.find(item => item.id === activeStage.activeCandidateId);
    if (!candidate) {
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
        message: `Submit your scores for ${candidate.name}? You will not be able to score this candidate and theme again.`,
        confirmLabel: 'Submit score'
    });
    if (!confirmed) return;
    try {
        const scoreValues = criteria.map(criterion => values[criterion.id || criterion.name]);
        const { error } = await db.from('scores').insert({
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
        });
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
    const personal = document.getElementById('judge-leaderboard');
    const overall = document.getElementById('judge-overall-top');
    if (!personal || !overall) return;
    const ranked = getJudgeRankedCandidates(authenticatedJudge?.id);
    personal.innerHTML = ranked.length
        ? ranked.map((candidate, index) => `<article class="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-700">${index + 1}</span><div class="min-w-0 flex-1"><p class="truncate text-sm font-bold text-slate-800">${escapeHtml(candidate.name)}</p><p class="truncate text-xs text-slate-500">${escapeHtml(candidate.program)}</p></div><strong class="text-sm text-indigo-700">${candidate.totalScore.toFixed(2)}</strong></article>`).join('')
        : '<p class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Submit a score to build your leaderboard.</p>';
    const top = getRankedCandidates({ scoredOnly: true })[0];
    overall.innerHTML = top
        ? `<article class="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p class="text-xs font-bold uppercase tracking-wide text-amber-700">Current overall leader</p><h3 class="mt-2 text-xl font-extrabold text-slate-950">${escapeHtml(top.name)}</h3><p class="mt-1 text-sm text-slate-600">${escapeHtml(top.program)}</p></article>`
        : '<p class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No submitted scores yet.</p>';
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
