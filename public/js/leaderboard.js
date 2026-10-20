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
        const placeLabel = rank === 1 ? 'Champion' : rank === 2 ? 'Runner-up' : rank === 3 ? '3rd place' : `Rank ${rank}`;
        const rankStyle = rank === 1
            ? 'bg-amber-100 text-amber-800'
            : rank === 2
                ? 'bg-slate-200 text-slate-700'
                : rank === 3
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-slate-100 text-slate-600';
        row.className = `mb-2 flex items-center gap-3 rounded-xl border ${rank === 1 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-white'} p-3 shadow-sm`;
        row.innerHTML = `
            <span class="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-black leading-none ${rankStyle}"><strong class="text-base">${rank}</strong><span class="sr-only">${placeLabel}</span></span>
            <img src="${escapeHtml(candidate.image)}" alt="" class="h-16 w-12 shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-contain" onerror="this.src='https://placehold.co/100x100/e2e8f0/475569?text=Photo'">
            <div class="min-w-0 flex-1">
                <p class="text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">${placeLabel}</p>
                <p class="truncate text-sm font-bold text-slate-800">${escapeHtml(candidate.name)}</p>
                <p class="truncate text-xs text-slate-500">${escapeHtml(candidate.program)} · Scored</p>
            </div>
        `;
        container.appendChild(row);
    });
}
