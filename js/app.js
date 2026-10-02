// --- State Management ---
        const STORAGE_KEY_CANDIDATES = 'sdca_candidates';
        const STORAGE_KEY_STAGE = 'sdca_stage';
        const STORAGE_KEY_SCORES = 'sdca_scores';

        let candidates = [];
        let activeStage = { activeCandidateId: null, currentTheme: 'Casual Wear' };
        let scores = {}; // Key format: 'candidateId_theme'
        let currentRole = null; // 'admin' or 'judge'

        // Initialize Mock Data if empty
        function initializeData() {
            const storedCandidates = localStorage.getItem(STORAGE_KEY_CANDIDATES);
            const storedStage = localStorage.getItem(STORAGE_KEY_STAGE);
            const storedScores = localStorage.getItem(STORAGE_KEY_SCORES);

            if (!storedCandidates) {
                // Generate 15 mock candidates
                candidates = Array.from({length: 15}, (_, i) => ({
                    id: `CAND-${100 + i + 1}`,
                    name: `Candidate ${i + 1} Name`,
                    image: `https://placehold.co/300x400/e2e8f0/475569?text=C-${i+1}`
                }));
                localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
            } else {
                candidates = JSON.parse(storedCandidates);
            }

            if (!storedStage) {
                localStorage.setItem(STORAGE_KEY_STAGE, JSON.stringify(activeStage));
            } else {
                activeStage = JSON.parse(storedStage);
            }

            if (!storedScores) {
                localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
            } else {
                scores = JSON.parse(storedScores);
            }
        }

        function saveState() {
            localStorage.setItem(STORAGE_KEY_CANDIDATES, JSON.stringify(candidates));
            localStorage.setItem(STORAGE_KEY_STAGE, JSON.stringify(activeStage));
            localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(scores));
            
            // Dispatch a custom event locally since 'storage' event only fires on OTHER tabs
            window.dispatchEvent(new Event('localStateChange'));
        }

        // Load fresh state from storage
        function loadState() {
            candidates = JSON.parse(localStorage.getItem(STORAGE_KEY_CANDIDATES) || '[]');
            activeStage = JSON.parse(localStorage.getItem(STORAGE_KEY_STAGE) || '{"activeCandidateId":null,"currentTheme":"Casual Wear"}');
            scores = JSON.parse(localStorage.getItem(STORAGE_KEY_SCORES) || '{}');
        }

        // --- Core App Logic ---
        function initApp(role) {
            initializeData();
            currentRole = role;
            if (role === 'admin') {
                document.getElementById('stage-theme').value = activeStage.currentTheme;
                renderAdmin();
            } else if (role === 'judge') {
                renderJudge();
            }
        }

        function switchRole() {
            window.location.href = './mr_ms_sdca_tabulation.html';
        }

        // Listen for updates from OTHER tabs
        window.addEventListener('storage', (e) => {
            if ([STORAGE_KEY_CANDIDATES, STORAGE_KEY_STAGE, STORAGE_KEY_SCORES].includes(e.key)) {
                loadState();
                renderAll();
            }
        });

        // Listen for updates from THIS tab
        window.addEventListener('localStateChange', () => {
            loadState();
            renderAll();
        });

        function renderAll() {
            if (currentRole === 'admin') renderAdmin();
            if (currentRole === 'judge') renderJudge();
        }
