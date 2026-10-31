const DEFAULT_PHOTO = 'https://placehold.co/240x320/e0e7ff/3730a3?text=Candidate';
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
let previewObjectUrl = null;
let selectedScorebookCandidateId = null;

function renderAdmin() {
    renderAdminTabs();
    renderThemeSelect();
    renderThemeCrud();
    renderCriteriaCrud();
    renderScorebook();
    renderJudgesCrud();
    const themeSelect = document.getElementById('stage-theme');
    if (themeSelect && themeSelect.value !== activeStage.currentTheme) {
        themeSelect.value = activeStage.currentTheme;
    }
    renderAdminCandidates();
    renderAdminStage();
    renderLeaderboard('admin-leaderboard', { showAverage: true });
    document.querySelectorAll('[data-stage-mode]').forEach(button => {
        const selected = button.dataset.stageMode === (activeStage.stageMode || 'mr');
        button.classList.toggle('bg-indigo-600', selected);
        button.classList.toggle('text-white', selected);
        button.classList.toggle('bg-white', !selected);
        button.classList.toggle('text-slate-700', !selected);
    });
}

function renderAdminTabs() {
    document.querySelectorAll('[data-admin-tab]').forEach(button => {
        if (button.dataset.bound) return;
        button.dataset.bound = 'true';
        button.addEventListener('click', () => {
            const tab = button.dataset.adminTab;
            document.querySelectorAll('[data-admin-panel]').forEach(panel => {
                panel.classList.toggle('hidden', panel.dataset.adminPanel !== tab);
            });
            document.querySelectorAll('[data-admin-tab]').forEach(tabButton => {
                const selected = tabButton === button;
                tabButton.classList.toggle('bg-indigo-600', selected);
                tabButton.classList.toggle('text-white', selected);
                tabButton.classList.toggle('border', !selected);
                tabButton.classList.toggle('border-slate-200', !selected);
                tabButton.classList.toggle('bg-white', !selected);
                tabButton.classList.toggle('text-slate-600', !selected);
            });
        });
    });
}

function renderThemeSelect() {
    const select = document.getElementById('stage-theme');
    if (!select) return;
    select.innerHTML = `<option value="">No theme selected</option>${themes.map(theme => (
        `<option value="${escapeHtml(theme.id)}">${escapeHtml(theme.name)}</option>`
    )).join('')}`;
    select.value = activeStage.currentTheme || '';
}

function renderThemeCrud() {
    const list = document.getElementById('theme-list-body');
    if (!list) return;
    list.innerHTML = themes.map(theme => `
        <tr class="border-b border-slate-100 last:border-0">
            <td class="px-3 py-3 text-sm font-semibold text-slate-800">${escapeHtml(theme.name)}</td>
            <td class="px-3 py-3 text-sm text-slate-500">${theme.sortOrder}</td>
            <td class="px-3 py-3"><div class="flex gap-2">
                <button type="button" data-edit-theme="${escapeHtml(theme.id)}" class="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Edit</button>
                <button type="button" data-delete-theme="${escapeHtml(theme.id)}" class="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Delete</button>
            </div></td>
        </tr>`).join('');
}

function renderCriteriaCrud() {
    const themeSelect = document.getElementById('criteria-theme');
    const list = document.getElementById('criteria-list-body');
    if (!themeSelect || !list) return;
    const selectedTheme = themeSelect.value || activeStage.currentTheme || themes[0]?.id;
    themeSelect.innerHTML = themes.map(theme => (
        `<option value="${escapeHtml(theme.id)}">${escapeHtml(theme.name)}</option>`
    )).join('');
    themeSelect.value = themes.some(theme => theme.id === selectedTheme) ? selectedTheme : themes[0]?.id || '';
    list.innerHTML = themes.flatMap(theme => (themeCriteria[theme.id] || []).map(criterion => `
        <tr class="border-b border-slate-100 last:border-0">
            <td class="px-3 py-3 text-sm font-semibold text-slate-700">${escapeHtml(theme.name)}</td>
            <td class="px-3 py-3 text-sm text-slate-800">${escapeHtml(criterion.name)}</td>
            <td class="px-3 py-3 text-sm text-slate-500">${criterion.maxScore}</td>
            <td class="px-3 py-3"><div class="flex gap-2">
                <button type="button" data-edit-criteria="${escapeHtml(criterion.id)}" data-criteria-theme="${escapeHtml(theme.id)}" class="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Edit</button>
                <button type="button" data-delete-criteria="${escapeHtml(criterion.id)}" class="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Delete</button>
            </div></td>
        </tr>`)).join('');
}

function slugify(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function saveTheme(event) {
    event.preventDefault();
    const name = document.getElementById('theme-name').value.trim();
    const id = document.getElementById('theme-id').value || slugify(name);
    const sortOrder = Number(document.getElementById('theme-order').value || 0);
    try {
        const { error } = await db.from('themes').upsert({ id, name, sort_order: sortOrder }, { onConflict: 'id' });
        if (error) throw error;
        document.getElementById('theme-form').reset();
        document.getElementById('theme-id').value = '';
        document.getElementById('btn-cancel-theme').classList.add('hidden');
        await syncData();
        renderAll();
        showAppMessage('Theme saved.');
    } catch (error) {
        handleWriteError(error, 'save the theme');
    }
}

async function deleteTheme(id) {
    const theme = themes.find(item => item.id === id);
    if (!theme || !window.confirm(`Delete ${theme.name} and its scoring basis?`)) return;
    if (activeStage.currentTheme === id) {
        showAppMessage('Switch to another theme before deleting this active theme.', 'error');
        return;
    }
    const hasScores = Object.values(scores).some(candidateScores => candidateScores[id]?.length);
    if (hasScores) {
        showAppMessage('This theme has saved scores and cannot be deleted.', 'error');
        return;
    }
    try {
        const { error } = await db.from('themes').delete().eq('id', id);
        if (error) throw error;
        await syncData();
        renderAll();
        showAppMessage('Theme deleted.');
    } catch (error) {
        handleWriteError(error, 'delete the theme');
    }
}

async function saveCriteria(event) {
    event.preventDefault();
    const id = document.getElementById('criteria-id').value;
    const themeId = document.getElementById('criteria-theme').value;
    const payload = {
        theme_id: themeId,
        name: document.getElementById('criteria-name').value.trim(),
        max_score: Math.min(10, Math.max(4, Number(document.getElementById('criteria-max-score').value || 10))),
        sort_order: (themeCriteria[themeId] || []).length
    };
    try {
        const result = id
            ? await db.from('theme_criteria').update(payload).eq('id', id)
            : await db.from('theme_criteria').insert(payload);
        if (result.error) throw result.error;
        cancelCriteriaEdit();
        await syncData();
        renderAll();
        showAppMessage('Scoring basis saved.');
    } catch (error) {
        handleWriteError(error, 'save the scoring basis');
    }
}

async function deleteCriteria(id) {
    if (!window.confirm('Delete this scoring basis?')) return;
    try {
        const { error } = await db.from('theme_criteria').delete().eq('id', id);
        if (error) throw error;
        await syncData();
        renderAll();
        showAppMessage('Scoring basis deleted.');
    } catch (error) {
        handleWriteError(error, 'delete the scoring basis');
    }
}

function cancelCriteriaEdit() {
    document.getElementById('criteria-form').reset();
    document.getElementById('criteria-id').value = '';
    document.getElementById('btn-cancel-criteria').classList.add('hidden');
}

function renderJudgesCrud() {
    const list = document.getElementById('judge-list-body');
    if (!list) return;
    list.innerHTML = judges.map(judge => `
        <tr class="border-b border-slate-100 last:border-0">
            <td class="px-3 py-3 text-sm font-semibold text-slate-800">${escapeHtml(judge.name)}</td>
            <td class="px-3 py-3 font-mono text-sm tracking-widest text-slate-600">${escapeHtml(judge.access_code)}</td>
            <td class="px-3 py-3"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${judge.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${judge.active ? 'Active' : 'Inactive'}</span></td>
            <td class="px-3 py-3"><div class="flex gap-2"><button type="button" data-edit-judge="${escapeHtml(judge.id)}" class="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Edit</button><button type="button" data-delete-judge="${escapeHtml(judge.id)}" class="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button></div></td>
        </tr>`).join('');
}

async function saveJudge(event) {
    event.preventDefault();
    const name = document.getElementById('judge-account-name').value.trim();
    const accessCode = document.getElementById('judge-account-code').value.trim().toUpperCase();
    const id = document.getElementById('judge-id').value || `judge-${slugify(name)}`;
    const existing = judges.find(judge => judge.id === id);
    try {
        const { error } = await db.from('judges').upsert({
            id,
            name,
            access_code: accessCode,
            active: document.getElementById('judge-account-active').checked
        }, { onConflict: 'id' });
        if (error) throw error;
        if (existing && existing.name !== name) {
            const { error: scoreError } = await db.from('scores')
                .update({ judge_name: name })
                .eq('judge_id', id);
            if (scoreError) throw scoreError;
        }
        document.getElementById('judge-form').reset();
        document.getElementById('judge-id').value = '';
        document.getElementById('judge-account-active').checked = true;
        await syncData();
        renderAll();
        showAppMessage('Judge account saved.');
    } catch (error) {
        handleWriteError(error, 'save the judge account');
    }
}

async function deleteJudge(id) {
    const judge = judges.find(item => item.id === id);
    if (!judge || !window.confirm(`Delete ${judge.name}'s judge account?`)) return;
    try {
        const { error } = await db.from('judges').delete().eq('id', id);
        if (error) throw error;
        await syncData();
        renderAll();
        showAppMessage('Judge account deleted.');
    } catch (error) {
        handleWriteError(error, 'delete the judge account');
    }
}

function renderScorebook() {
    const list = document.getElementById('scorebook-list');
    const details = document.getElementById('scorebook-details');
    if (!list || !details) return;
    if (!selectedScorebookCandidateId && candidates[0]) selectedScorebookCandidateId = candidates[0].id;
    list.innerHTML = candidates.map(candidate => {
        const scoreCount = Object.values(scores[candidate.id] || {}).flat().length;
        const selected = candidate.id === selectedScorebookCandidateId;
        return `<button type="button" data-scorebook-candidate="${escapeHtml(candidate.id)}" class="w-full rounded-xl border p-4 text-left transition ${selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}">
            <span class="flex items-start justify-between gap-3"><span><span class="block text-sm font-bold text-slate-900">${escapeHtml(candidate.name)}</span><span class="mt-1 block text-xs text-slate-500">${escapeHtml(candidate.id)} · ${escapeHtml(candidate.program)}</span></span><span class="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">${scoreCount} score${scoreCount === 1 ? '' : 's'}</span></span>
        </button>`;
    }).join('');

    const candidate = candidates.find(item => item.id === selectedScorebookCandidateId);
    const themeScores = Object.entries(scores[selectedScorebookCandidateId] || {});
    if (!candidate || themeScores.length === 0) {
        details.innerHTML = '<p class="text-sm text-slate-500">No scores have been submitted for this candidate yet.</p>';
        return;
    }
    details.innerHTML = `<div class="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">Score details</p><h3 class="mt-1 text-2xl font-extrabold text-slate-950">${escapeHtml(candidate.name)}</h3><p class="mt-1 text-sm text-slate-500">${escapeHtml(candidate.program)}</p></div><strong class="text-lg text-indigo-700">Final average: ${getCandidateAverageScore(candidate.id).toFixed(2)}</strong></div>${themeScores.map(([themeId, themeScoreRows]) => `
        <section class="mb-5 last:mb-0 rounded-xl border border-slate-200 bg-white p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 class="font-bold text-slate-900">${escapeHtml(getThemeName(themeId))}</h4><span class="text-xs font-semibold text-slate-500">Average: ${getThemeAverageScore(themeScoreRows).toFixed(2)} · ${themeScoreRows.length} judge${themeScoreRows.length === 1 ? '' : 's'}</span></div>
            <div class="space-y-3">${themeScoreRows.map(score => {
                const criteria = Object.values(score.criteria || {});
                const criterionRows = criteria.length
                    ? criteria.map(criterion => `<span class="text-xs text-slate-600">${escapeHtml(criterion.name)}: <strong>${criterion.value}/${criterion.maxScore}</strong></span>`).join('')
                    : `<span class="text-xs text-slate-600">Poise: <strong>${score.poise || 0}</strong></span><span class="text-xs text-slate-600">Presence: <strong>${score.presence || 0}</strong></span><span class="text-xs text-slate-600">Q&amp;A: <strong>${score.qa || 0}</strong></span>`;
                return `<article class="rounded-lg border border-slate-100 bg-slate-50 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><span class="text-sm font-bold text-slate-800">${escapeHtml(score.judgeName)}</span><span class="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-700">Total ${score.total}</span></div><div class="mt-2 flex flex-wrap gap-x-4 gap-y-1">${criterionRows}</div><p class="mt-3 text-sm leading-6 text-slate-600">${score.remarks ? escapeHtml(score.remarks) : '<span class="italic text-slate-400">No remarks submitted.</span>'}</p></article>`;
            }).join('')}</div>
        </section>`).join('')}`;
}

function renderAdminCandidates() {
    const list = document.getElementById('candidate-list-body');
    if (!list) return;
    list.replaceChildren();
    document.getElementById('candidate-count').textContent = `${candidates.length} total`;

    candidates.forEach(candidate => {
        const row = document.createElement('tr');
        row.className = 'border-b border-slate-100 last:border-0';
        row.innerHTML = `
            <td class="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">${escapeHtml(candidate.id)}</td>
            <td class="px-4 py-3"><img src="${escapeHtml(candidate.image)}" alt="" class="h-16 w-12 rounded-lg bg-slate-100 object-contain" onerror="this.src='${DEFAULT_PHOTO}'"></td>
            <td class="min-w-40 px-4 py-3"><p class="font-semibold text-slate-800">${escapeHtml(candidate.name)}</p><p class="text-xs text-slate-500">${candidate.category} · ${escapeHtml(candidate.program)}</p></td>
            <td class="px-4 py-3 text-sm font-bold text-indigo-700">${candidate.category}</td>
            <td class="whitespace-nowrap px-4 py-3">
                <div class="flex gap-2">
                    <button type="button" data-edit-id="${escapeHtml(candidate.id)}" class="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Edit</button>
                    <button type="button" data-delete-id="${escapeHtml(candidate.id)}" class="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Delete</button>
                </div>
            </td>`;
        list.appendChild(row);
    });
}

function renderAdminStage() {
    const grid = document.getElementById('admin-stage-grid');
    if (!grid) return;
    grid.replaceChildren();

    const mode = activeStage.stageMode || 'mr';
    const visibleCandidates = mode === 'program'
        ? candidates
        : candidates.filter(candidate => candidate.category.toLowerCase() === mode);
    if (visibleCandidates.length === 0) {
        grid.innerHTML = '<p class="col-span-full py-8 text-center text-sm text-slate-500">Add candidates to make them available on stage.</p>';
        return;
    }

    if (mode === 'program') {
        const programs = [...new Set(candidates.map(candidate => candidate.program))];
        programs.forEach(program => {
            const programCandidates = candidates.filter(candidate => candidate.program === program);
            const isActive = programCandidates.every(candidate => activeStage.activeCandidateIds.includes(candidate.id));
            const card = document.createElement('button');
            card.type = 'button';
            card.dataset.stageProgram = program;
            card.setAttribute('aria-pressed', String(isActive));
            card.className = `rounded-2xl border-2 bg-white p-4 text-left transition ${
                isActive ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'
            }`;
            card.innerHTML = `<span class="block text-lg font-extrabold text-slate-900">${escapeHtml(program)}</span>
                <span class="mt-1 block text-xs text-slate-500">${programCandidates.map(candidate => `${candidate.category} · ${escapeHtml(candidate.name)}`).join(' / ')}</span>
                ${isActive ? '<span class="mt-3 inline-flex rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">On stage</span>' : ''}`;
            grid.appendChild(card);
        });
        return;
    }

    visibleCandidates.forEach(candidate => {
        const isActive = activeStage.activeCandidateIds.includes(candidate.id)
            || activeStage.activeCandidateId === candidate.id;
        const card = document.createElement('button');
        card.type = 'button';
        card.dataset.stageId = candidate.id;
        card.setAttribute('aria-pressed', String(isActive));
        card.className = `overflow-hidden rounded-2xl border-2 bg-white text-left transition ${
            isActive ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-100 hover:border-indigo-200'
        }`;
        card.innerHTML = `
            <img src="${escapeHtml(candidate.image)}" alt="" class="h-56 w-full bg-slate-100 object-contain sm:h-72" onerror="this.src='${DEFAULT_PHOTO}'">
            <span class="block p-3">
                <span class="block truncate text-sm font-bold text-slate-800">${escapeHtml(candidate.name)}</span>
                <span class="block truncate text-xs text-slate-500">${candidate.category} · ${escapeHtml(candidate.program)}</span>
                ${isActive ? '<span class="mt-2 inline-flex rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">On stage</span>' : ''}
            </span>`;
        grid.appendChild(card);
    });
}

function showPhotoPreview(image) {
    const preview = document.getElementById('candidate-photo-preview');
    if (!preview) return;
    if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
    }
    preview.src = image || DEFAULT_PHOTO;
    preview.classList.remove('hidden');
}

function handlePhotoInput() {
    const file = document.getElementById('candidate-photo-file').files[0];
    const imageUrl = document.getElementById('candidate-image').value.trim();
    if (file) {
        previewObjectUrl = URL.createObjectURL(file);
        document.getElementById('candidate-photo-preview').src = previewObjectUrl;
    } else if (imageUrl) {
        showPhotoPreview(imageUrl);
    } else {
        showPhotoPreview(DEFAULT_PHOTO);
    }
}

function readImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The selected photo could not be read.'));
        reader.readAsDataURL(file);
    });
}

function createCandidateId() {
    let number = candidates.length + 1;
    let id = `CAND-${String(number).padStart(3, '0')}`;
    while (candidates.some(candidate => candidate.id === id)) {
        number += 1;
        id = `CAND-${String(number).padStart(3, '0')}`;
    }
    return id;
}

async function saveCandidate(event) {
    event.preventDefault();
    const id = document.getElementById('candidate-id').value;
    const name = document.getElementById('candidate-name').value.trim();
    const program = document.getElementById('candidate-program').value.trim();
    const category = document.getElementById('candidate-category').value;
    const imageUrl = document.getElementById('candidate-image').value.trim();
    const photoFile = document.getElementById('candidate-photo-file').files[0];
    const existing = candidates.find(candidate => candidate.id === id);

    if (photoFile && !photoFile.type.startsWith('image/')) {
        showAppMessage('Choose a valid image file.', 'error');
        return;
    }
    if (!photoFile && !imageUrl && !existing?.image) {
        showAppMessage('Add a photo URL or choose an image file.', 'error');
        return;
    }
    if (photoFile && photoFile.size > MAX_IMAGE_SIZE) {
        showAppMessage('Choose an image smaller than 50 MB.', 'error');
        return;
    }

    let image = imageUrl || existing?.image || '';
    try {
        if (photoFile) image = await readImageFile(photoFile);
    } catch (error) {
        showAppMessage(error.message, 'error');
        return;
    }

    try {
        const candidate = { id: id || createCandidateId(), name, program, category, image };
        const result = existing
            ? await db.from('candidates')
                .update({ name, program, category, image })
                .eq('id', id)
            : await db.from('candidates').insert(candidate);
        if (result.error) throw result.error;
        await syncData();
        renderAll();
        cancelEdit();
        showAppMessage(existing ? 'Candidate updated.' : 'Candidate added.');
    } catch (error) {
        handleWriteError(error, existing ? 'update the candidate' : 'add the candidate');
    }
}

function editCandidate(id) {
    const candidate = candidates.find(item => item.id === id);
    if (!candidate) return;
    document.getElementById('candidate-id').value = candidate.id;
    document.getElementById('candidate-name').value = candidate.name;
    document.getElementById('candidate-program').value = candidate.program;
    document.getElementById('candidate-category').value = candidate.category;
    document.getElementById('candidate-image').value = candidate.image.startsWith('data:')
        ? ''
        : candidate.image;
    document.getElementById('candidate-photo-file').value = '';
    document.getElementById('btn-save-candidate').textContent = 'Save Changes';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    showPhotoPreview(candidate.image);
    document.getElementById('candidate-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
    const form = document.getElementById('candidate-form');
    if (!form) return;
    form.reset();
    document.getElementById('candidate-id').value = '';
    document.getElementById('btn-save-candidate').textContent = 'Add Candidate';
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    showPhotoPreview('');
}

async function deleteCandidate(id) {
    const candidate = candidates.find(item => item.id === id);
    if (!candidate || !window.confirm(`Delete ${candidate.name}?`)) return;
    try {
        const { error } = await db.from('candidates').delete().eq('id', id);
        if (error) throw error;
        await syncData();
        renderAll();
        showAppMessage('Candidate deleted.');
    } catch (error) {
        handleWriteError(error, 'delete the candidate');
    }
}

async function persistStage(nextStage) {
    try {
        const { error } = await db.from('active_stage').upsert({
            id: true,
            active_candidate_id: nextStage.activeCandidateIds?.[0] || nextStage.activeCandidateId || null,
            active_candidate_ids: nextStage.activeCandidateIds || [],
            stage_mode: nextStage.stageMode || 'mr',
            current_theme: nextStage.currentTheme,
            updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) throw error;
        await syncData();
        renderAll();
    } catch (error) {
        handleWriteError(error, 'update the stage');
    }
}

function updateStageTheme() {
    return persistStage({
        ...activeStage,
        currentTheme: document.getElementById('stage-theme').value
    });
}

function setStageCandidate(id) {
    return persistStage({ ...activeStage, activeCandidateId: id, activeCandidateIds: [id] });
}

function setStageMode(mode) {
    return persistStage({ ...activeStage, stageMode: mode, activeCandidateId: null, activeCandidateIds: [] });
}

function setStageProgram(program) {
    const ids = candidates.filter(candidate => candidate.program === program).map(candidate => candidate.id);
    return persistStage({ ...activeStage, activeCandidateId: ids[0] || null, activeCandidateIds: ids });
}

function clearStage() {
    return persistStage({ ...activeStage, activeCandidateId: null, activeCandidateIds: [] });
}

document.getElementById('candidate-form').addEventListener('submit', saveCandidate);
document.getElementById('candidate-list-body').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-id]');
    const deleteButton = event.target.closest('[data-delete-id]');
    if (editButton) editCandidate(editButton.dataset.editId);
    if (deleteButton) deleteCandidate(deleteButton.dataset.deleteId);
});
document.getElementById('admin-stage-grid').addEventListener('click', event => {
    const card = event.target.closest('[data-stage-id]');
    if (card) setStageCandidate(card.dataset.stageId);
    const programCard = event.target.closest('[data-stage-program]');
    if (programCard) setStageProgram(programCard.dataset.stageProgram);
});
document.querySelectorAll('[data-stage-mode]').forEach(button => {
    button.addEventListener('click', () => setStageMode(button.dataset.stageMode));
});
document.getElementById('candidate-image').addEventListener('input', () => {
    if (document.getElementById('candidate-image').value.trim()) {
        document.getElementById('candidate-photo-file').value = '';
    }
    handlePhotoInput();
});
document.getElementById('candidate-photo-file').addEventListener('change', handlePhotoInput);
document.getElementById('stage-theme').addEventListener('change', updateStageTheme);
document.getElementById('btn-cancel-edit').addEventListener('click', cancelEdit);
document.getElementById('btn-clear-stage').addEventListener('click', clearStage);
document.getElementById('theme-form').addEventListener('submit', saveTheme);
document.getElementById('btn-cancel-theme').addEventListener('click', () => {
    document.getElementById('theme-form').reset();
    document.getElementById('theme-id').value = '';
    document.getElementById('btn-cancel-theme').classList.add('hidden');
});
document.getElementById('theme-list-body').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-theme]');
    const deleteButton = event.target.closest('[data-delete-theme]');
    if (editButton) {
        const theme = themes.find(item => item.id === editButton.dataset.editTheme);
        if (!theme) return;
        document.getElementById('theme-id').value = theme.id;
        document.getElementById('theme-name').value = theme.name;
        document.getElementById('theme-order').value = theme.sortOrder;
        document.getElementById('btn-cancel-theme').classList.remove('hidden');
    }
    if (deleteButton) deleteTheme(deleteButton.dataset.deleteTheme);
});
document.getElementById('criteria-form').addEventListener('submit', saveCriteria);
document.getElementById('btn-cancel-criteria').addEventListener('click', cancelCriteriaEdit);
document.getElementById('criteria-list-body').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-criteria]');
    const deleteButton = event.target.closest('[data-delete-criteria]');
    if (editButton) {
        const criterion = (themeCriteria[editButton.dataset.criteriaTheme] || [])
            .find(item => String(item.id) === editButton.dataset.editCriteria);
        if (!criterion) return;
        document.getElementById('criteria-id').value = criterion.id;
        document.getElementById('criteria-theme').value = editButton.dataset.criteriaTheme;
        document.getElementById('criteria-name').value = criterion.name;
        document.getElementById('criteria-max-score').value = criterion.maxScore;
        document.getElementById('btn-cancel-criteria').classList.remove('hidden');
    }
    if (deleteButton) deleteCriteria(deleteButton.dataset.deleteCriteria);
});
document.getElementById('scorebook-list').addEventListener('click', event => {
    const candidateButton = event.target.closest('[data-scorebook-candidate]');
    if (!candidateButton) return;
    selectedScorebookCandidateId = candidateButton.dataset.scorebookCandidate;
    renderScorebook();
});
document.getElementById('judge-form').addEventListener('submit', saveJudge);
document.getElementById('judge-list-body').addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-judge]');
    const deleteButton = event.target.closest('[data-delete-judge]');
    if (editButton) {
        const judge = judges.find(item => item.id === editButton.dataset.editJudge);
        if (!judge) return;
        document.getElementById('judge-id').value = judge.id;
        document.getElementById('judge-account-name').value = judge.name;
        document.getElementById('judge-account-code').value = judge.access_code;
        document.getElementById('judge-account-active').checked = judge.active;
    }
    if (deleteButton) deleteJudge(deleteButton.dataset.deleteJudge);
});
document.querySelectorAll('[data-reset-rpc]').forEach(button => {
    button.addEventListener('click', () => resetAdminData(
        button.dataset.resetKind,
        button.dataset.resetLabel
    ));
});

initApp('admin');
