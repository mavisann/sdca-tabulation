// --- STREAMING_CHUNK:Implementing Judge view logic and Scoring form... ---
        // --- Judge Functions ---
        function renderJudge() {
            const waitingEl = document.getElementById('judge-waiting');
            const activeEl = document.getElementById('judge-active');

            renderLeaderboard('judge-leaderboard');

            if (!activeStage.activeCandidateId) {
                waitingEl.classList.remove('hidden');
                activeEl.classList.add('hidden');
                return;
            }

            const cand = candidates.find(c => c.id === activeStage.activeCandidateId);
            if (!cand) {
                clearStage(); // Fallback if candidate was deleted
                return;
            }

            waitingEl.classList.add('hidden');
            activeEl.classList.remove('hidden');

            document.getElementById('judge-cand-img').src = cand.image;
            document.getElementById('judge-cand-name').textContent = cand.name;
            document.getElementById('judge-cand-id').textContent = cand.id;
            document.getElementById('judge-theme-badge').textContent = activeStage.currentTheme;

            // Load existing scores if they exist for this candidate + theme
            const scoreKey = `${cand.id}_${activeStage.currentTheme}`;
            const existingScore = scores[scoreKey];

            if (existingScore) {
                document.getElementById('score-poise').value = existingScore.poise;
                document.getElementById('score-presence').value = existingScore.presence;
                document.getElementById('score-qa').value = existingScore.qa;
                document.getElementById('score-remarks').value = existingScore.remarks;
            } else {
                document.getElementById('score-poise').value = 5;
                document.getElementById('score-presence').value = 5;
                document.getElementById('score-qa').value = 5;
                document.getElementById('score-remarks').value = '';
            }

            updateSliderVal('poise');
            updateSliderVal('presence');
            updateSliderVal('qa');
        }

        function updateSliderVal(id) {
            const val = document.getElementById(`score-${id}`).value;
            document.getElementById(`val-${id}`).textContent = val;
        }

        function submitScores(e) {
            e.preventDefault();
            if (!activeStage.activeCandidateId) return;

            const poise = parseInt(document.getElementById('score-poise').value);
            const presence = parseInt(document.getElementById('score-presence').value);
            const qa = parseInt(document.getElementById('score-qa').value);
            const remarks = document.getElementById('score-remarks').value;

            const total = poise + presence + qa;
            const scoreKey = `${activeStage.activeCandidateId}_${activeStage.currentTheme}`;

            scores[scoreKey] = { poise, presence, qa, remarks, total };
            saveState();

            // Provide visual feedback
            const btn = e.target.querySelector('button[type="submit"]');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-check text-2xl"></i> Saved Successfully!';
            btn.classList.replace('bg-indigo-600', 'bg-green-600');
            btn.classList.replace('hover:bg-indigo-700', 'hover:bg-green-700');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.replace('bg-green-600', 'bg-indigo-600');
                btn.classList.replace('hover:bg-green-700', 'hover:bg-indigo-700');
            }, 2000);
        }

        initApp('judge');
