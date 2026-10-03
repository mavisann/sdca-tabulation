const PODIUM_SLOTS = [
    { place: 2, label: '2nd Place', height: 'sm:min-h-[380px]', color: 'from-slate-300 to-slate-100', badge: 'bg-slate-200 text-slate-700' },
    { place: 1, label: 'Champion', height: 'sm:min-h-[450px]', color: 'from-amber-300 to-yellow-100', badge: 'bg-amber-200 text-amber-900' },
    { place: 3, label: '3rd Place', height: 'sm:min-h-[350px]', color: 'from-orange-300 to-orange-100', badge: 'bg-orange-200 text-orange-900' }
];

function renderAudience() {
    const activeCandidate = candidates.find(candidate => candidate.id === activeStage.activeCandidateId);
    document.getElementById('audience-theme').textContent = activeCandidate
        ? `${activeStage.currentTheme} · ${activeCandidate.name} on stage`
        : `${activeStage.currentTheme} · Live competition`;

    const ranked = getRankedCandidates({ scoredOnly: true }).slice(0, 3);
    const podium = document.getElementById('audience-podium');
    podium.replaceChildren();

    PODIUM_SLOTS.forEach(slot => {
        const candidate = ranked[slot.place - 1];
        const card = document.createElement('article');
        card.className = `flex ${slot.height} flex-col items-center justify-end overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b ${slot.color} p-5 text-center text-slate-900 shadow-2xl shadow-black/20 sm:p-7`;

        if (!candidate) {
            card.classList.add('border-dashed', 'border-white/20', 'from-slate-800', 'to-slate-900', 'text-white');
            card.innerHTML = `
                <span class="mb-4 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-slate-400"><i class="fa-solid fa-user-plus text-2xl"></i></span>
                <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-300">${slot.label}</span>
                <p class="mt-5 text-lg font-bold text-slate-400">Awaiting finalist</p>
                <p class="mt-1 text-xs text-slate-500">Ranking will appear here</p>`;
        } else {
            card.innerHTML = `
                <span class="mb-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${slot.badge}">${slot.place === 1 ? '<i class="fa-solid fa-crown text-base"></i>' : ''}${slot.label}</span>
                <img src="${escapeHtml(candidate.image)}" alt="${escapeHtml(candidate.name)} portrait" class="mb-5 h-64 w-full rounded-2xl border-4 border-white/70 bg-slate-200 object-contain shadow-lg sm:h-80" onerror="this.src='https://placehold.co/600x800/e0e7ff/3730a3?text=Finalist'">
                <h2 class="text-xl font-extrabold leading-tight sm:text-2xl">${escapeHtml(candidate.name)}</h2>
                <p class="mt-2 text-sm font-medium opacity-75">${escapeHtml(candidate.program)}</p>`;
        }
        podium.appendChild(card);
    });
}

initApp('audience');
