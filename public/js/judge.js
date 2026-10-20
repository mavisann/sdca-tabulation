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
    container.innerHTML = criteria.map((criterion, criterionIndex) => `
        <fieldset class="score-fieldset rounded-2xl border border-base-300 bg-base-200 p-4">
            <legend class="mb-3 flex w-full items-center justify-between gap-3 text-sm font-bold text-base-content"><span>${escapeHtml(criterion.name)}</span><span class="badge badge-primary badge-sm font-extrabold">1–${criterion.maxScore}</span></legend>
            <div class="score-options">${Array.from({ length: criterion.maxScore }, (_, index) => {
            const value = index + 1;
            return `
                <label class="score-option">
                    <input class="peer sr-only" type="radio" name="score-criterion-${criterionIndex}" value="${value}" required>
                    <span class="grid h-11 place-items-center rounded-lg border border-base-300 bg-base-100 text-sm font-bold text-base-content transition hover:border-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-content peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30">${value}</span>
                </label>`;
        }).join('')}</div>
        </fieldset>`).join('');
}

function showJudgeWaiting(title, copy) {
    document.getElementById('judge-active').classList.add('hidden');
    document.getElementById('judge-waiting').classList.remove('hidden');
    document.getElementById('judge-waiting-title').textContent = title;
    document.getElementById('judge-waiting-copy').textContent = copy;
}

function renderJudge() {
    renderLeaderboard('judge-leaderboard');
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
        const selected = document.querySelector(`input[name="score-criterion-${criterionIndex}"]:checked`);
        if (!selected) {
            showAppMessage('Select a score for every scoring basis.', 'error');
            return;
        }
        values[criterion.id || criterion.name] = Number(selected.value);
    }

    values.remarks = document.getElementById('score-remarks').value.trim();
    values.total = criteria.reduce(
        (total, criterion) => total + Number(values[criterion.id || criterion.name] || 0),
        0
    );
    values.submittedAt = new Date().toISOString();
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
            total: values.total,
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
initApp('judge');
