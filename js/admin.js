// Reset Data (Admin)
        function resetData() {
            if(confirm("Are you sure you want to clear all scores and reset candidates to default? This cannot be undone.")) {
                localStorage.removeItem(STORAGE_KEY_CANDIDATES);
                localStorage.removeItem(STORAGE_KEY_STAGE);
                localStorage.removeItem(STORAGE_KEY_SCORES);
                initializeData();
                renderAll();
            }
        }

        // --- STREAMING_CHUNK:Implementing Admin CRUD and Stage functions... ---
        // --- Admin Functions ---
        function renderAdmin() {
            renderAdminCRUD();
            renderAdminStage();
            renderLeaderboard('admin-leaderboard');
        }

        function renderAdminCRUD() {
            const listEl = document.getElementById('admin-candidate-list');
            listEl.innerHTML = '';
            
            candidates.forEach(cand => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between p-2 mb-2 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow';
                row.innerHTML = `
                    <div class="flex items-center gap-3">
                        <img src="${cand.image}" onerror="this.src='https://placehold.co/100/e2e8f0/475569?text=X'" class="w-10 h-10 rounded-md object-cover">
                        <div>
                            <p class="text-sm font-semibold text-slate-800 leading-tight">${cand.name}</p>
                            <p class="text-xs text-slate-400">ID: ${cand.id}</p>
                        </div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="editCandidate('${cand.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-md transition-colors"><i class="ph ph-pencil-simple"></i></button>
                        <button onclick="deleteCandidate('${cand.id}')" class="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-md transition-colors"><i class="ph ph-trash"></i></button>
                    </div>
                `;
                listEl.appendChild(row);
            });
        }

        function saveCandidate(e) {
            e.preventDefault();
            const idInput = document.getElementById('candidate-id').value;
            const nameInput = document.getElementById('candidate-name').value;
            const imageInput = document.getElementById('candidate-image').value;

            if (idInput) {
                // Edit
                const index = candidates.findIndex(c => c.id === idInput);
                if (index > -1) {
                    candidates[index].name = nameInput;
                    candidates[index].image = imageInput;
                }
            } else {
                // Add
                candidates.push({
                    id: `CAND-${Date.now().toString().slice(-4)}`,
                    name: nameInput,
                    image: imageInput
                });
            }
            
            cancelEdit();
            saveState();
        }

        function editCandidate(id) {
            const cand = candidates.find(c => c.id === id);
            if (cand) {
                document.getElementById('candidate-id').value = cand.id;
                document.getElementById('candidate-name').value = cand.name;
                document.getElementById('candidate-image').value = cand.image;
                document.getElementById('btn-save-candidate').textContent = 'Update Candidate';
                document.getElementById('btn-cancel-edit').classList.remove('hidden');
            }
        }

        function cancelEdit() {
            document.getElementById('candidate-form').reset();
            document.getElementById('candidate-id').value = '';
            document.getElementById('btn-save-candidate').textContent = 'Add Candidate';
            document.getElementById('btn-cancel-edit').classList.add('hidden');
        }

        function deleteCandidate(id) {
            if(confirm('Delete this candidate?')) {
                candidates = candidates.filter(c => c.id !== id);
                // Clear active stage if deleted
                if(activeStage.activeCandidateId === id) {
                    activeStage.activeCandidateId = null;
                }
                saveState();
            }
        }

        function renderAdminStage() {
            const gridEl = document.getElementById('admin-stage-grid');
            gridEl.innerHTML = '';
            
            candidates.forEach(cand => {
                const isActive = activeStage.activeCandidateId === cand.id;
                const card = document.createElement('div');
                card.onclick = () => setStageCandidate(cand.id);
                card.className = `cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${isActive ? 'border-blue-500 shadow-md transform scale-[1.02]' : 'border-slate-100 hover:border-slate-300 hover:shadow-sm'}`;
                
                card.innerHTML = `
                    <div class="relative h-32 bg-slate-100">
                        <img src="${cand.image}" onerror="this.src='https://placehold.co/300x400/e2e8f0/475569?text=X'" class="w-full h-full object-cover">
                        ${isActive ? '<div class="absolute inset-0 bg-blue-500/20 flex items-center justify-center"><div class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1"><i class="ph ph-microphone-stage"></i> ON STAGE</div></div>' : ''}
                    </div>
                    <div class="p-3 text-center bg-white">
                        <p class="text-sm font-bold text-slate-800 truncate">${cand.name}</p>
                        <p class="text-xs text-slate-500">${cand.id}</p>
                    </div>
                `;
                gridEl.appendChild(card);
            });
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

        initApp('admin');
