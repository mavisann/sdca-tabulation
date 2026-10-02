const DEFAULT_PHOTO = 'https://placehold.co/240x320/e0e7ff/3730a3?text=Candidate';
const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;
let previewObjectUrl = null;

function renderAdmin() {
    const themeSelect = document.getElementById('stage-theme');
    if (themeSelect && themeSelect.value !== activeStage.currentTheme) {
        themeSelect.value = activeStage.currentTheme;
    }
    renderAdminCandidates();
    renderAdminStage();
    renderLeaderboard('admin-leaderboard');
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
            <td class="min-w-40 px-4 py-3"><p class="font-semibold text-slate-800">${escapeHtml(candidate.name)}</p><p class="text-xs text-slate-500">${escapeHtml(candidate.program)}</p></td>
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

    if (candidates.length === 0) {
        grid.innerHTML = '<p class="col-span-full py-8 text-center text-sm text-slate-500">Add candidates to make them available on stage.</p>';
        return;
    }

    candidates.forEach(candidate => {
        const isActive = activeStage.activeCandidateId === candidate.id;
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
                <span class="block truncate text-xs text-slate-500">${escapeHtml(candidate.program)}</span>
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
        showAppMessage('Choose an image smaller than 1.5 MB to fit browser storage.', 'error');
        return;
    }

    let image = imageUrl || existing?.image || '';
    try {
        if (photoFile) image = await readImageFile(photoFile);
    } catch (error) {
        showAppMessage(error.message, 'error');
        return;
    }

    if (existing) {
        Object.assign(existing, { name, program, image });
    } else {
        candidates.push({ id: createCandidateId(), name, program, image });
    }

    try {
        saveState();
        cancelEdit();
        showAppMessage(existing ? 'Candidate updated.' : 'Candidate added.');
    } catch {
        return;
    }
}

function editCandidate(id) {
    const candidate = candidates.find(item => item.id === id);
    if (!candidate) return;
    document.getElementById('candidate-id').value = candidate.id;
    document.getElementById('candidate-name').value = candidate.name;
    document.getElementById('candidate-program').value = candidate.program;
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

function deleteCandidate(id) {
    const candidate = candidates.find(item => item.id === id);
    if (!candidate || !window.confirm(`Delete ${candidate.name}?`)) return;
    candidates = candidates.filter(item => item.id !== id);
    delete scores[id];
    if (activeStage.activeCandidateId === id) activeStage.activeCandidateId = null;
    saveState();
    showAppMessage('Candidate deleted.');
}

function updateStageTheme() {
    activeStage.currentTheme = document.getElementById('stage-theme').value;
    saveState();
}

function setStageCandidate(id) {
    activeStage.activeCandidateId = id;
    saveState();
}

function clearStage() {
    activeStage.activeCandidateId = null;
    saveState();
}

function resetData() {
    if (!window.confirm('Clear all candidates, stage selections, and scores? This cannot be undone.')) return;
    [STORAGE_KEY_CANDIDATES, STORAGE_KEY_STAGE, STORAGE_KEY_SCORES,
        'sdca_candidates', 'sdca_stage', 'sdca_scores'].forEach(key => localStorage.removeItem(key));
    initializeData();
    renderAll();
    cancelEdit();
    showAppMessage('Data cleared. Add candidates when ready.');
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
document.getElementById('btn-reset-data').addEventListener('click', resetData);

initApp('admin');
