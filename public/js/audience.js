const PODIUM_SLOTS = [
    { place: 2, label: '2nd Place', cardClass: 'audience-podium-card audience-podium-card--second', badge: 'bg-slate-100 text-slate-700' },
    { place: 1, label: 'Champion', cardClass: 'audience-podium-card audience-podium-card--champion', badge: 'bg-[#f7df8a] text-[#7b5700]' },
    { place: 3, label: '3rd Place', cardClass: 'audience-podium-card audience-podium-card--third', badge: 'bg-red-50 text-[#9b1d2d]' }
];

function renderAudience() {
    const activeCandidates = getStageCandidates();
    const themeName = activeStage.currentTheme
        ? getThemeName(activeStage.currentTheme)
        : 'Competition';
    document.getElementById('audience-theme').textContent = activeCandidates.length
        ? `${themeName} · ${activeCandidates.map(candidate => candidate.name).join(' & ')} on stage`
        : `${themeName} · Live competition`;
    document.getElementById('audience-status').textContent = activeCandidates.length
        ? 'Now scoring'
        : 'Live ranking · scores remain confidential';

    const podium = document.getElementById('audience-podium');
    podium.replaceChildren();

    ['Mr', 'Ms'].forEach(category => {
        const section = document.createElement('section');
        section.className = 'mb-10';
        section.innerHTML = `<h2 class="mb-4 text-center text-2xl font-extrabold text-slate-950">${category}. rankings</h2>`;
        const grid = document.createElement('div');
        grid.className = 'mx-auto grid w-full max-w-5xl items-end gap-5 sm:grid-cols-3';
        const ranked = getRankedCandidates({ scoredOnly: true }).filter(candidate => candidate.category === category).slice(0, 3);

        PODIUM_SLOTS.forEach(slot => {
            const candidate = ranked[slot.place - 1];
            const card = document.createElement('article');
            const orderClass = slot.place === 1 ? 'order-1 sm:order-2' : slot.place === 2 ? 'order-2 sm:order-1' : 'order-3';
            card.className = `flex ${orderClass} ${slot.cardClass} flex-col items-center justify-end overflow-hidden p-5 text-center sm:p-7`;

            if (!candidate) {
                card.classList.add('audience-podium-card--empty');
                card.innerHTML = `
                <span class="mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><i class="fa-solid fa-user-plus text-2xl"></i></span>
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">${slot.place}. ${slot.label}</span>
                <p class="mt-5 text-lg font-bold text-slate-500">Awaiting finalist</p>
                <p class="mt-1 text-xs text-slate-400">Ranking will appear here</p>`;
            } else {
                card.innerHTML = `
                ${slot.place === 1 ? '<span class="audience-crown mb-2"><i class="fa-solid fa-crown"></i></span>' : `<span class="mb-3 text-5xl font-black leading-none opacity-20">${slot.place}</span>`}
                <span class="mb-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${slot.badge}">${slot.place === 1 ? '<i class="fa-solid fa-crown text-base"></i>' : ''}${slot.label}</span>
                <img src="${escapeHtml(candidate.image)}" alt="${escapeHtml(candidate.name)} portrait" class="audience-candidate-image mb-5 h-64 w-full rounded-2xl object-contain sm:h-80" onerror="this.src='https://placehold.co/600x800/f8f4e8/7b5700?text=Finalist'">
                <h2 class="audience-candidate-name text-xl font-extrabold leading-tight text-slate-950 sm:text-2xl">${escapeHtml(candidate.name)}</h2>
                <p class="audience-candidate-program mt-2 text-sm font-medium opacity-75">${escapeHtml(candidate.program)}</p>`;
            }
            grid.appendChild(card);
        });
        section.appendChild(grid);
        podium.appendChild(section);
    });
}

initApp('audience');
