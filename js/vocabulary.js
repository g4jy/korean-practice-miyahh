/* === Integrated Vocabulary Page — Words / Practice / Quiz === */
(async () => {
  await Storage.init();
  const { allCards } = await App.buildCardPool();

  // Simple Know/Don't Know model stored in mastery
  let M = await Storage.getMastery();
  const isKnown = kr => M[kr] && M[kr].known === true;
  const $ = id => document.getElementById(id);

  // ========== TABS ==========
  let activeTab = 'words';
  $('vocab-tabs').addEventListener('click', e => {
    const tab = e.target.closest('.vocab-tab');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    document.querySelectorAll('.vocab-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.vocab-pane').forEach(p => p.classList.remove('active'));
    $('pane-' + activeTab).classList.add('active');
    if (activeTab === 'practice') updatePracticeInfo();
    if (activeTab === 'quiz') updateQuizInfo();
  });

  // ========== STATS ==========
  function updateStats() {
    const knowCount = allCards.filter(c => isKnown(c.kr)).length;
    const dontKnow = allCards.length - knowCount;
    $('vocab-stats').innerHTML =
      '<span class="stat-pill stat-dk">' + dontKnow + ' Don\'t Know</span>' +
      '<span class="stat-pill stat-k">' + knowCount + ' Know</span>' +
      '<span class="stat-pill stat-all">' + allCards.length + ' Total</span>';
  }

  // ========== WORD LIST ==========
  let currentFilter = 'all';
  let searchQuery = '';

  document.querySelector('.vocab-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    currentFilter = btn.dataset.f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderWords();
  });

  $('search-input').addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderWords();
  });

  function renderWords() {
    let words = [...allCards];
    if (currentFilter === 'know') words = words.filter(c => isKnown(c.kr));
    else if (currentFilter === 'dont-know') words = words.filter(c => !isKnown(c.kr));
    if (searchQuery) words = words.filter(c =>
      c.kr.includes(searchQuery) || c.en.toLowerCase().includes(searchQuery) || c.rom.toLowerCase().includes(searchQuery)
    );

    const list = $('word-list');
    if (!words.length) {
      list.innerHTML = '<p class="word-empty">No words found</p>';
      return;
    }
    list.innerHTML = words.map(w => {
      const known = isKnown(w.kr);
      return '<div class="word-row">' +
        '<div class="word-info">' +
          '<span class="word-kr">' + w.kr + '</span>' +
          '<span class="word-en">' + w.en + '</span>' +
        '</div>' +
        '<button class="word-toggle ' + (known ? 'known' : '') + '" data-kr="' + w.kr.replace(/"/g, '&quot;') + '">' +
          (known ? '✓ Know' : '✗') +
        '</button>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.word-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const kr = btn.dataset.kr;
        const wasKnown = isKnown(kr);
        M[kr] = { ...(M[kr] || {}), known: !wasKnown };
        await Storage.saveMastery(M);
        updateStats();
        renderWords();
      });
    });
  }

  // ========== PRACTICE ==========
  let PQ = [], PI = 0, POPEN = false, pMoved = 0;

  function updatePracticeInfo() {
    const count = allCards.filter(c => !isKnown(c.kr)).length;
    $('practice-info').textContent = count + ' words to practice';
    $('go-practice').textContent = 'Practice (' + count + ' words)';
    $('go-practice').disabled = count === 0;
  }

  $('go-practice').addEventListener('click', () => {
    PQ = allCards.filter(c => !isKnown(c.kr));
    for (let i = PQ.length - 1; i > 0; i--) { const j = Math.random()*i|0; [PQ[i],PQ[j]]=[PQ[j],PQ[i]]; }
    PI = 0; POPEN = false; pMoved = 0;
    $('practice-screen').classList.remove('hidden');
    showPracticeCard();
  });

  const pCard = $('practice-card');

  function showPracticeCard() {
    if (PI >= PQ.length) {
      $('practice-screen').classList.add('hidden');
      $('done-screen').classList.remove('hidden');
      $('done-icon').textContent = '\uD83D\uDCAA';
      $('done-title').textContent = 'Practice Done!';
      $('done-desc').textContent = pMoved + ' words moved to "Know"';
      return;
    }
    POPEN = false;
    pCard.classList.remove('open');
    $('practice-actions').classList.add('hidden');
    const w = PQ[PI];
    $('p-cat').textContent = w.category || '';
    $('p-kr').textContent = w.kr;
    $('p-en').textContent = w.en;
    $('p-rom').textContent = w.rom || '';
    $('pc').textContent = PI + 1;
    $('pt').textContent = PQ.length;
    App.speak(w.kr);
  }

  pCard.addEventListener('click', () => {
    if (POPEN) return;
    POPEN = true;
    pCard.classList.add('open');
    $('practice-actions').classList.remove('hidden');
  });

  $('btn-still').addEventListener('click', () => { PI++; showPracticeCard(); });
  $('btn-know').addEventListener('click', async () => {
    const w = PQ[PI];
    M[w.kr] = { ...(M[w.kr] || {}), known: true };
    await Storage.saveMastery(M);
    pMoved++;
    PI++; showPracticeCard();
  });

  $('practice-back').addEventListener('click', () => {
    $('practice-screen').classList.add('hidden');
    updateStats(); updatePracticeInfo(); renderWords();
  });

  // Practice keyboard
  document.addEventListener('keydown', e => {
    if ($('practice-screen').classList.contains('hidden')) return;
    if ((e.key === ' ' || e.key === 'Enter') && !POPEN) {
      e.preventDefault(); POPEN = true; pCard.classList.add('open'); $('practice-actions').classList.remove('hidden');
    }
    if (e.key === 'ArrowLeft' && POPEN) $('btn-still').click();
    if (e.key === 'ArrowRight' && POPEN) $('btn-know').click();
  });

  // ========== QUIZ ==========
  let quizSize = 25;
  let RQ = [], RI = 0, RSC = 0, RANS = false, qFlipped = 0;

  $('quiz-size').addEventListener('click', e => {
    const p = e.target.closest('.pill'); if (!p) return;
    $('quiz-size').querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active'); quizSize = +p.dataset.n;
    updateQuizInfo();
  });

  function updateQuizInfo() {
    $('go-quiz').textContent = 'Start Quiz (' + allCards.length + ' words)';
    $('go-quiz').disabled = allCards.length < 4;
  }

  $('go-quiz').addEventListener('click', () => {
    let p = [...allCards];
    for (let i = p.length-1; i > 0; i--) { const j = Math.random()*i|0; [p[i],p[j]]=[p[j],p[i]]; }
    RQ = quizSize > 0 ? p.slice(0, quizSize) : p;
    RI = 0; RSC = 0; qFlipped = 0;
    $('quiz-screen').classList.remove('hidden');
    showQuiz();
  });

  function showQuiz() {
    if (RI >= RQ.length) {
      $('quiz-screen').classList.add('hidden');
      $('done-screen').classList.remove('hidden');
      const p = RQ.length ? Math.round(RSC/RQ.length*100) : 0;
      $('done-icon').textContent = p >= 80 ? '\uD83C\uDFC6' : '\uD83D\uDCD6';
      $('done-title').textContent = RSC + '/' + RQ.length + ' correct (' + p + '%)';
      $('done-desc').textContent = qFlipped + ' words changed status';
      return;
    }
    RANS = false;
    const w = RQ[RI];
    $('quiz-word').textContent = w.en;
    $('qc').textContent = RI + 1;
    $('qt').textContent = RQ.length;
    $('quiz-sc').textContent = RSC;
    $('quiz-tot').textContent = RI;

    const pool = allCards.filter(x => x.kr !== w.kr && x.en !== w.en);
    const opts = [w];
    const src = [...pool];
    while (opts.length < 4 && src.length) {
      const r = Math.random()*src.length|0;
      const pk = src.splice(r,1)[0];
      if (!opts.find(o => o.kr === pk.kr)) opts.push(pk);
    }
    for (let i = opts.length-1; i > 0; i--) { const j = Math.random()*i|0; [opts[i],opts[j]]=[opts[j],opts[i]]; }

    const grid = $('quiz-grid');
    grid.innerHTML = '';
    opts.forEach(o => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = o.kr;
      btn.addEventListener('click', async () => {
        if (RANS) return;
        RANS = true;
        grid.querySelectorAll('.quiz-opt').forEach(x => x.classList.add('off'));
        const wasKnown = isKnown(w.kr);
        if (o.kr === w.kr) {
          btn.classList.add('ok');
          RSC++;
          if (!wasKnown) { M[w.kr] = { ...(M[w.kr]||{}), known: true }; qFlipped++; }
        } else {
          btn.classList.add('bad');
          grid.querySelectorAll('.quiz-opt').forEach(x => { if (x.textContent === w.kr) x.classList.add('show'); });
          if (wasKnown) { M[w.kr] = { ...(M[w.kr]||{}), known: false }; qFlipped++; }
        }
        await Storage.saveMastery(M);
        $('quiz-sc').textContent = RSC;
        $('quiz-tot').textContent = RI + 1;
        App.speak(w.kr);
        setTimeout(() => { RI++; showQuiz(); }, 1000);
      });
      grid.appendChild(btn);
    });
  }

  $('quiz-back').addEventListener('click', () => {
    $('quiz-screen').classList.add('hidden');
    updateStats(); renderWords(); updateQuizInfo();
  });

  // ========== DONE SCREEN ==========
  $('done-back').addEventListener('click', () => {
    $('done-screen').classList.add('hidden');
    updateStats(); renderWords(); updatePracticeInfo(); updateQuizInfo();
  });

  // ========== ADD WORD ==========
  const modal = $('add-word-modal');
  $('add-word-fab').addEventListener('click', () => modal.classList.remove('hidden'));
  $('modal-close').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  $('add-word-form').addEventListener('submit', async e => {
    e.preventDefault();
    const word = {
      kr: $('new-kr').value.trim(),
      en: $('new-en').value.trim(),
      rom: $('new-rom').value.trim().toUpperCase() || '',
      category: 'My Words',
      addedAt: new Date().toISOString(),
      source: 'user'
    };
    if (!word.kr || !word.en) return;
    if (allCards.find(c => c.kr === word.kr)) { App.showToast('Word already exists!'); return; }

    const existing = await Storage.getUserWords();
    existing.push(word);
    await Storage.saveUserWords(existing);

    // Add to pool and auto-mark as "Don't Know"
    allCards.push(word);
    M[word.kr] = { known: false };
    await Storage.saveMastery(M);

    $('add-word-form').reset();
    modal.classList.add('hidden');
    App.showToast('Added: ' + word.kr + ' (Don\'t Know)');
    updateStats(); renderWords(); updatePracticeInfo();
  });

  // ========== INIT ==========
  updateStats();
  renderWords();
  updatePracticeInfo();
  updateQuizInfo();
})();
