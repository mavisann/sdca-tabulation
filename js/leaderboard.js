function renderLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const rankedCandidates = getRankedCandidates();
    container.replaceChildren();

    if (rankedCandidates.length === 0) {
        container.innerHTML = '<p class="py-6 text-center text-sm text-slate-500">No candidates available.</p>';
        return;
    }

    rankedCandidates.forEach((candidate, index) => {
        const row = document.createElement('article');
        const rank = index + 1;
        const rankStyle = rank === 1
            ? 'bg-amber-100 text-amber-800'
            : rank === 2
                ? 'bg-slate-200 text-slate-700'
                : rank === 3
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-slate-100 text-slate-600';
        row.className = 'mb-2 flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm';
        row.innerHTML = `
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankStyle}">${rank}</span>
            <img src="${escapeHtml(candidate.image)}" alt="" class="h-16 w-12 shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-contain" onerror="this.src='https://placehold.co/100x100/e2e8f0/475569?text=Photo'">
            <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-slate-800">${escapeHtml(candidate.name)}</p>
                <p class="truncate text-xs text-slate-500">${escapeHtml(candidate.program)}</p>
            </div>
        `;
        container.appendChild(row);
    });
}
