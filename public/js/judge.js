const JUDGE_PHOTO_FALLBACK = 'https://placehold.co/600x800/e0e7ff/3730a3?text=Candidate';
let authenticatedJudge = null;
let reviewMode = 'mr';
let selectedReviewCandidateIds = [];

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

function renderScoreOptions(stageCandidates, criteria = getThemeCriteria(activeStage.currentTheme)) {
    const container = document.getElementById('score-criteria-options');
    if (!container) return;
    container.innerHTML = stageCandidates.map(candidate => `
        <section class="rounded-2xl border border-base-300 bg-base-200 p-4" data-score-candidate="${escapeHtml(candidate.id)}">
            <div class="mb-4 flex items-center gap-3"><span class="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-700">${candidate.category}</span><div><h3 class="font-extrabold text-slate-950">${escapeHtml(candidate.name)}</h3><p class="text-xs text-slate-500">${escapeHtml(candidate.program)}</p></div></div>
            <div class="space-y-4">${criteria.map((criterion, criterionIndex) => {
                const maxScore = Math.max(4, Math.min(10, criterion.maxScore));
                return `<fieldset class="score-fieldset rounded-xl border border-base-300 bg-base-100 p-3">
                    <legend class="mb-2 flex w-full items-center justify-between gap-3 text-sm font-bold text-base-content"><span>${escapeHtml(criterion.name)}</span><span class="badge badge-primary badge-sm font-extrabold">4–${maxScore}</span></legend>
                    <input class="score-input w-full rounded-xl border border-base-300 bg-base-100 px-3 py-3 text-lg font-bold outline-none focus:border-primary focus:ring-4 focus:ring-primary/20" type="number" name="score-criterion-${candidate.id}-${criterionIndex}" min="4" max="${maxScore}" step="0.01" inputmode="decimal" required aria-label="${escapeHtml(criterion.name)} score for ${escapeHtml(candidate.name)}" placeholder="4.00–${maxScore}.00">
                </fieldset>`;
            }).join('')}</div>
            <label class="mt-4 block text-sm font-bold text-slate-800">Remarks <span class="font-normal text-slate-400">(optional)</span></label>
            <textarea name="score-remarks-${candidate.id}" rows="3" maxlength="1000" placeholder="Share brief, constructive feedback..." class="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"></textarea>
        </section>`).join('');
}

function showJudgeWaiting(title, copy) {
    document.getElementById('judge-active').classList.add('hidden');
    document.getElementById('judge-waiting').classList.remove('hidden');
    document.getElementById('judge-waiting-title').textContent = title;
    document.getElementById('judge-waiting-copy').textContent = copy;
}

function renderJudgeReviewStage() {
    document.getElementById('judge-review-stage').classList.remove('hidden');
    document.getElementById('judge-waiting').classList.add('hidden');
    document.getElementById('judge-active').classList.add('hidden');
    const grid = document.getElementById('judge-review-stage-grid');
    const hasJudgeScore = candidate => Object.values(scores[candidate.id] || {})
        .flat()
        .some(score => score.judgeId === authenticatedJudge?.id);
    const reviewCandidates = candidates.filter(hasJudgeScore);
    const visibleCandidates = reviewMode === 'program'
        ? reviewCandidates
        : reviewCandidates.filter(candidate => candidate.category.toLowerCase() === reviewMode);
    grid.replaceChildren();
    if (reviewMode === 'program') {
        [...new Set(reviewCandidates.map(candidate => candidate.program))].forEach(program => {
            const group = reviewCandidates.filter(candidate => candidate.program === program);
            const selected = group.every(candidate => selectedReviewCandidateIds.includes(candidate.id));
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `rounded-2xl border-2 p-4 text-left ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`;
            card.innerHTML = `<span class="block text-lg font-extrabold text-slate-900">${escapeHtml(program)}</span><span class="mt-1 block text-xs text-slate-500">${group.map(candidate => `${candidate.category} · ${escapeHtml(candidate.name)}`).join(' / ')}</span>`;
            card.addEventListener('click', () => {
                selectedReviewCandidateIds = selected
                    ? selectedReviewCandidateIds.filter(id => !group.some(candidate => candidate.id === id))
                    : [...new Set([...selectedReviewCandidateIds, ...group.map(candidate => candidate.id)])];
                renderJudgeReviewStage();
            });
            grid.appendChild(card);
        });
    } else {
        visibleCandidates.forEach(candidate => {
            const selected = selectedReviewCandidateIds.includes(candidate.id);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `overflow-hidden rounded-2xl border-2 text-left ${selected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`;
            card.innerHTML = `<img src="${escapeHtml(candidate.image)}" alt="" class="h-40 w-full object-contain" onerror="this.src='${JUDGE_PHOTO_FALLBACK}'"><span class="block p-3"><span class="block text-sm font-bold text-slate-900">${candidate.category} · ${escapeHtml(candidate.name)}</span><span class="mt-1 block text-xs text-slate-500">${escapeHtml(candidate.program)}</span></span>`;
            card.addEventListener('click', () => {
                selectedReviewCandidateIds = selected
                    ? selectedReviewCandidateIds.filter(id => id !== candidate.id)
                    : [...selectedReviewCandidateIds, candidate.id];
                renderJudgeReviewStage();
            });
            grid.appendChild(card);
        });
    }
    document.querySelectorAll('[data-review-mode]').forEach(button => {
        const selected = button.dataset.reviewMode === reviewMode;
        button.classList.toggle('bg-indigo-600', selected);
        button.classList.toggle('text-white', selected);
        button.classList.toggle('border', !selected);
        button.classList.toggle('border-slate-200', !selected);
        button.classList.toggle('bg-white', !selected);
        button.classList.toggle('text-slate-700', !selected);
    });
}

function renderJudge() {
    renderJudgeLeaderboards();
    if (activeStage.scoreReviewEnabled) {
        renderJudgeReviewStage();
        return;
    }
    document.getElementById('judge-review-stage').classList.add('hidden');
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
    renderScoreOptions(stageCandidates);
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
    const submissions = [];
    for (const candidate of stageCandidates) {
        const values = {};
        for (const [criterionIndex, criterion] of criteria.entries()) {
            const selected = document.querySelector(`input[name="score-criterion-${candidate.id}-${criterionIndex}"]`);
            const value = Number(selected?.value);
            if (!selected || !Number.isFinite(value) || value < 4 || value > 10 || value > criterion.maxScore) {
                showAppMessage(`Select every score for ${candidate.name}.`, 'error');
                return;
            }
            values[criterion.id || criterion.name] = value;
        }
        values.remarks = document.querySelector(`textarea[name="score-remarks-${candidate.id}"]`)?.value.trim() || '';
        values.total = criteria.reduce((total, criterion) => total + Number(values[criterion.id || criterion.name] || 0), 0);
        submissions.push({ candidate, values });
    }
    const confirmed = await openConfirmModal({
        title: 'Confirm score submission',
        message: `Submit your scores for ${stageCandidates.map(candidate => candidate.name).join(' and ')}? You will not be able to score this group and theme again.`,
        confirmLabel: 'Submit score'
    });
    if (!confirmed) return;
    try {
        const { error } = await db.from('scores').insert(submissions.map(({ candidate, values }) => ({
            candidate_id: candidate.id,
            theme: activeStage.currentTheme,
            judge_id: authenticatedJudge.id,
            judge_name: getJudgeName(),
            poise: values[criteria[0]?.id || criteria[0]?.name] ?? null,
            presence: values[criteria[1]?.id || criteria[1]?.name] ?? null,
            qa: values[criteria[2]?.id || criteria[2]?.name] ?? null,
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
            submitted_at: new Date().toISOString()
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

function getStoredCriterionValue(score, criterion) {
    return Number(score.criteria?.[criterion.id || criterion.name]?.value ?? score[criterion.name]);
}

function renderJudgeScoreReview(candidateIds = selectedReviewCandidateIds) {
    const container = document.getElementById('judge-score-review-list');
    if (!container) return;
    const rows = [];
    candidates.filter(candidate => candidateIds.includes(candidate.id)).forEach(candidate => {
        Object.entries(scores[candidate.id] || {}).forEach(([themeId, themeScores]) => {
            themeScores
                .filter(score => score.judgeId === authenticatedJudge?.id)
                .forEach(score => rows.push({ candidate, themeId, score }));
        });
    });
    if (rows.length === 0) {
        container.innerHTML = '<p class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">You have not submitted any scores yet.</p>';
        return;
    }
    container.innerHTML = rows.map(({ candidate, themeId, score }) => {
        const criteria = getThemeCriteria(themeId);
        return `<form class="judge-score-review-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-score-id="${escapeHtml(score.id)}" data-theme-id="${escapeHtml(themeId)}">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-indigo-600">${escapeHtml(getThemeName(themeId))}</p><h3 class="text-lg font-extrabold text-slate-950">${escapeHtml(candidate.category)} · ${escapeHtml(candidate.name)}</h3><p class="text-xs text-slate-500">${escapeHtml(candidate.program)}</p></div><strong class="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">Current total: ${score.total}</strong></div>
            <div class="grid gap-3 sm:grid-cols-2">${criteria.map((criterion, index) => {
                const maxScore = Math.max(4, Math.min(10, criterion.maxScore));
                return `<label class="text-sm font-bold text-slate-700">${escapeHtml(criterion.name)}<input class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" name="review-score-${index}" type="number" min="4" max="${maxScore}" step="0.01" required value="${getStoredCriterionValue(score, criterion)}"></label>`;
            }).join('')}</div>
            <label class="mt-4 block text-sm font-bold text-slate-700">Remarks<textarea name="review-remarks" rows="3" maxlength="1000" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">${escapeHtml(score.remarks)}</textarea></label>
            <button type="submit" class="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Save changes</button>
        </form>`;
    }).join('');
    container.querySelectorAll('.judge-score-review-card').forEach(form => {
        form.addEventListener('submit', saveReviewedScore);
    });
}

async function saveReviewedScore(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const score = Object.values(scores).flatMap(candidateScores => Object.values(candidateScores).flat()).find(item => item.id === form.dataset.scoreId);
    if (!score) return;
    const criteria = getThemeCriteria(form.dataset.themeId);
    const values = {};
    for (const [index, criterion] of criteria.entries()) {
        const value = Number(form.querySelector(`[name="review-score-${index}"]`)?.value);
        if (!Number.isFinite(value) || value < 4 || value > 10 || value > criterion.maxScore) {
            showAppMessage('Enter valid scores for every scoring basis.', 'error');
            return;
        }
        values[criterion.id || criterion.name] = value;
    }
    const payload = {
        poise: values[criteria[0]?.id || criteria[0]?.name] ?? null,
        presence: values[criteria[1]?.id || criteria[1]?.name] ?? null,
        qa: values[criteria[2]?.id || criteria[2]?.name] ?? null,
        criteria: Object.fromEntries(criteria.map(criterion => [
            criterion.id || criterion.name,
            { name: criterion.name, maxScore: criterion.maxScore, value: values[criterion.id || criterion.name] }
        ])),
        remarks: form.querySelector('[name="review-remarks"]').value.trim(),
        total: Number(Object.values(values).reduce((sum, value) => sum + value, 0).toFixed(2)),
        submitted_at: new Date().toISOString()
    };
    try {
        const { error } = await db.from('scores').update(payload).eq('id', form.dataset.scoreId).eq('judge_id', authenticatedJudge.id);
        if (error) throw error;
        await syncData();
        renderAll();
        renderJudgeScoreReview();
        showAppMessage('Score changes saved.');
    } catch (error) {
        handleWriteError(error, 'update the score');
    }
}

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
document.querySelectorAll('[data-review-mode]').forEach(button => {
button.addEventListener('click', () => {
    reviewMode = button.dataset.reviewMode;
    selectedReviewCandidateIds = [];
    renderJudgeReviewStage();
});
});
document.getElementById('btn-open-selected-score-review').addEventListener('click', () => {
if (selectedReviewCandidateIds.length === 0) {
    showAppMessage('Select at least one contestant to review.', 'error');
    return;
}
renderJudgeScoreReview();
document.getElementById('judge-score-review-modal').showModal();
});
document.getElementById('btn-close-judge-score-review').addEventListener('click', () => document.getElementById('judge-score-review-modal').close());
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
