const SCORE_CATEGORIES = ['poise', 'presence', 'qa'];
const JUDGE_PHOTO_FALLBACK = 'https://placehold.co/600x800/e0e7ff/3730a3?text=Candidate';

function renderScoreOptions() {
    SCORE_CATEGORIES.forEach(category => {
        const container = document.getElementById(`score-${category}-options`);
        container.innerHTML = Array.from({ length: 10 }, (_, index) => {
            const value = index + 1;
            return `
                <label class="score-option">
                    <input class="peer sr-only" type="radio" name="score-${category}" value="${value}" required>
                    <span class="grid h-10 place-items-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-indigo-300 peer-checked:border-indigo-600 peer-checked:bg-indigo-600 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100">${value}</span>
                </label>`;
        }).join('');
    });
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

    const scoreKey = `${candidate.id}_${activeStage.currentTheme}`;
    if (scores[candidate.id]?.[activeStage.currentTheme]) {
        document.getElementById('scoring-form').dataset.scoreKey = '';
        showJudgeWaiting(
            'Score submitted — awaiting next contestant',
            `${candidate.name} has already been scored for ${activeStage.currentTheme}. You can continue when the stage manager selects another contestant.`
        );
        return;
    }

    const form = document.getElementById('scoring-form');
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
    document.getElementById('judge-theme-badge').textContent = activeStage.currentTheme;
}

function submitScores(event) {
    event.preventDefault();
    const candidate = candidates.find(item => item.id === activeStage.activeCandidateId);
    if (!candidate) {
        renderJudge();
        return;
    }

    if (scores[candidate.id]?.[activeStage.currentTheme]) {
        renderJudge();
        showAppMessage('This contestant has already been scored for this theme.', 'error');
        return;
    }

    const values = {};
    for (const category of SCORE_CATEGORIES) {
        const selected = document.querySelector(`input[name="score-${category}"]:checked`);
        if (!selected) {
            showAppMessage('Select a score from 1 to 10 for each category.', 'error');
            return;
        }
        values[category] = Number(selected.value);
    }

    values.remarks = document.getElementById('score-remarks').value.trim();
    values.total = values.poise + values.presence + values.qa;
    values.submittedAt = new Date().toISOString();
    scores[candidate.id] ??= {};
    scores[candidate.id][activeStage.currentTheme] = values;

    try {
        saveState();
    } catch {
        return;
    }
    showAppMessage('Score submitted successfully.');
}

renderScoreOptions();
document.getElementById('scoring-form').addEventListener('submit', submitScores);
initApp('judge');
