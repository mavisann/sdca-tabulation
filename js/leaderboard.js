// --- STREAMING_CHUNK:Implementing the Shared Leaderboard logic... ---
        // --- Shared Functions ---
        function renderLeaderboard(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // Calculate totals
            const leaderboardData = candidates.map(cand => {
                let totalScore = 0;
                Object.entries(scores).forEach(([key, scoreData]) => {
                    if (key.startsWith(`${cand.id}_`)) {
                        totalScore += scoreData.total;
                    }
                });
                return { ...cand, totalScore };
            }).sort((a, b) => b.totalScore - a.totalScore);

            container.innerHTML = '';
            
            if (leaderboardData.length === 0) {
                container.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">No candidates available.</p>';
                return;
            }

            leaderboardData.forEach((cand, index) => {
                const rank = index + 1;
                let rankColor = 'bg-slate-100 text-slate-600';
                if (rank === 1) rankColor = 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-400 shadow-sm';
                else if (rank === 2) rankColor = 'bg-slate-200 text-slate-700 ring-1 ring-slate-300';
                else if (rank === 3) rankColor = 'bg-orange-100 text-orange-800 ring-1 ring-orange-300';

                const row = document.createElement('div');
                row.className = `flex items-center p-3 mb-2 bg-white border ${rank === 1 ? 'border-yellow-200 bg-yellow-50/30' : 'border-slate-100'} rounded-xl shadow-sm transition-transform hover:scale-[1.01]`;
                
                row.innerHTML = `
                    <div class="flex-shrink-0 w-8 h-8 rounded-full ${rankColor} flex items-center justify-center font-bold text-sm mr-3">
                        ${rank}
                    </div>
                    <img src="${cand.image}" onerror="this.src='https://placehold.co/100/e2e8f0/475569?text=X'" class="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm mr-3">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-slate-800 truncate leading-tight">${cand.name}</p>
                        <p class="text-xs text-slate-400 truncate">${cand.id}</p>
                    </div>
                    <div class="flex-shrink-0 text-right ml-2">
                        <p class="text-lg font-black ${rank === 1 ? 'text-yellow-600' : 'text-slate-700'} leading-none">${cand.totalScore}</p>
                        <p class="text-[10px] uppercase font-semibold text-slate-400 mt-1">Pts</p>
                    </div>
                `;
                container.appendChild(row);
            });
        }
