/* === Vocabulary Flashcard — Browse + Learn (SRS) + Quiz + Add Word === */

(async () => {
  // --- Init Storage ---
  await Storage.init();
  let M = await Storage.getMastery();

  // --- Build shared card pool ---
  const { allCards, categories } = await App.buildCardPool();

  // ========== TAB SWITCHING ==========
  const modeTabsEl = document.getElementById('mode-tabs');
  let activeMode = 'browse';

  modeTabsEl.addEventListener('click', e => {
    const tab = e.target.closest('.mode-tab');
    if (!tab) return;
    const mode = tab.dataset.mode;
    if (mode === activeMode) return;
    activeMode = mode;
    modeTabsEl.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.mode-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-' + mode).classList.add('active');
    if (mode === 'learn') renderLearnHome();
    if (mode === 'quiz') renderQuizHome();
  });

  // ========== BROWSE MODE (existing flashcard logic) ==========
  (function initBrowseMode() {
    let currentCards = [...allCards];
    let currentIdx = 0;
    let isFlipped = false;
    let cardDirection = localStorage.getItem('flashcardDirection') || 'kr-en';
    let reviewMode = false;

    // Sort by mastery (weak first)
    function masteryOrder(card) {
      const mastery = App.getWordMastery();
      const m = mastery[card.kr];
      if (!m) return 2;
      if (m.status === 'dont_know') return 0;
      if (m.status === 'unsure') return 1;
      return 3;
    }
    currentCards.sort((a, b) => masteryOrder(a) - masteryOrder(b));

    const flashcardEl = document.getElementById('flashcard');
    const innerEl = document.getElementById('flashcard-inner');
    const koreanEl = document.getElementById('card-korean');
    const englishEl = document.getElementById('card-english');
    const romEl = document.getElementById('card-romanization');
    const progressEl = document.getElementById('progress');
    const ttsBtn = document.getElementById('card-tts');
    const masteryStatsEl = document.getElementById('mastery-stats');
    const reviewBanner = document.getElementById('review-banner');
    const reviewWeakBtn = document.getElementById('review-weak-btn');
    const reviewExitBtn = document.getElementById('review-exit-btn');

    // Build category tabs
    const tabContainer = document.getElementById('category-tabs');
    const catNames = ['All', ...categories.keys()];
    catNames.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat === 'All' ? ' active' : '');
      const count = cat === 'All' ? allCards.length : (categories.get(cat) || []).length;
      btn.textContent = cat + ' (' + count + ')';
      btn.addEventListener('click', () => {
        exitReviewMode();
        currentCards = cat === 'All' ? [...allCards] : [...(categories.get(cat) || [])];
        currentIdx = 0;
        isFlipped = false;
        tabContainer.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        resetFlipInstant();
        render();
      });
      tabContainer.appendChild(btn);
    });

    function resetFlipInstant() {
      isFlipped = false;
      innerEl.classList.add('no-transition');
      innerEl.classList.remove('flipped');
      void innerEl.offsetWidth;
      innerEl.classList.remove('no-transition');
    }

    function updateMasteryStats() {
      const mastery = App.getWordMastery();
      let know = 0, unsure = 0, dontKnow = 0;
      for (const card of currentCards) {
        const m = mastery[card.kr];
        if (!m) continue;
        if (m.status === 'know') know++;
        else if (m.status === 'unsure') unsure++;
        else if (m.status === 'dont_know') dontKnow++;
      }
      if (masteryStatsEl) {
        masteryStatsEl.innerHTML =
          '<span class="stat-know">&#10003;' + know + '</span>' +
          '&nbsp;&nbsp;<span class="stat-unsure">?' + unsure + '</span>' +
          '&nbsp;&nbsp;<span class="stat-dont-know">&#10007;' + dontKnow + '</span>';
      }
      const weakCount = allCards.filter(c => {
        const m = mastery[c.kr];
        return m && (m.status === 'dont_know' || m.status === 'unsure');
      }).length;
      if (reviewWeakBtn) reviewWeakBtn.textContent = 'Review Weak (' + weakCount + ')';
    }

    function updateCardBadge() {
      const existing = flashcardEl.querySelector('.card-badge');
      if (existing) existing.remove();
      if (currentCards.length === 0) return;
      const card = currentCards[currentIdx];
      const mastery = App.getWordMastery();
      const m = mastery[card.kr];
      if (!m) return;
      const badge = document.createElement('div');
      badge.className = 'card-badge ' + m.status.replace('_', '-');
      flashcardEl.querySelector('.flashcard-front').appendChild(badge);
    }

    function render() {
      if (currentCards.length === 0) {
        koreanEl.textContent = reviewMode ? 'All clear!' : 'No cards';
        englishEl.textContent = '';
        romEl.textContent = '';
        progressEl.textContent = '0 / 0';
        updateMasteryStats();
        return;
      }
      const card = currentCards[currentIdx];
      if (cardDirection === 'en-kr') {
        koreanEl.textContent = card.en;
        englishEl.textContent = card.kr;
        romEl.textContent = card.rom;
      } else {
        koreanEl.textContent = card.kr;
        englishEl.textContent = card.en;
        romEl.textContent = card.rom;
      }
      progressEl.textContent = (currentIdx + 1) + ' / ' + currentCards.length;
      innerEl.classList.toggle('flipped', isFlipped);
      updateCardBadge();
      updateMasteryStats();
    }

    function enterReviewMode() {
      const mastery = App.getWordMastery();
      const weakCards = allCards.filter(c => {
        const m = mastery[c.kr];
        return m && (m.status === 'dont_know' || m.status === 'unsure');
      });
      if (weakCards.length === 0) {
        koreanEl.textContent = 'All clear!';
        englishEl.textContent = '';
        romEl.textContent = '';
        progressEl.textContent = '0 / 0';
        return;
      }
      reviewMode = true;
      currentCards = weakCards;
      currentIdx = 0;
      resetFlipInstant();
      if (reviewBanner) reviewBanner.classList.remove('hidden');
      render();
    }

    function exitReviewMode() {
      reviewMode = false;
      if (reviewBanner) reviewBanner.classList.add('hidden');
    }

    if (reviewWeakBtn) reviewWeakBtn.addEventListener('click', enterReviewMode);
    if (reviewExitBtn) {
      reviewExitBtn.addEventListener('click', () => {
        exitReviewMode();
        currentCards = [...allCards];
        currentIdx = 0;
        resetFlipInstant();
        tabContainer.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
        const allTab = tabContainer.querySelector('.cat-tab');
        if (allTab) allTab.classList.add('active');
        render();
      });
    }

    flashcardEl.addEventListener('click', (e) => {
      if (e.target === ttsBtn || e.target.closest('#card-tts')) return;
      isFlipped = !isFlipped;
      render();
    });

    ttsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentCards.length > 0) App.speak(currentCards[currentIdx].kr);
    });

    const dirBtn = document.getElementById('direction-btn');
    function updateDirBtn() {
      if (dirBtn) dirBtn.innerHTML = cardDirection === 'kr-en' ? 'EN &rarr; KR' : 'KR &rarr; EN';
    }
    updateDirBtn();
    if (dirBtn) {
      dirBtn.addEventListener('click', () => {
        cardDirection = cardDirection === 'kr-en' ? 'en-kr' : 'kr-en';
        localStorage.setItem('flashcardDirection', cardDirection);
        resetFlipInstant();
        updateDirBtn();
        render();
      });
    }

    document.getElementById('prev-btn').addEventListener('click', () => {
      if (currentCards.length === 0) return;
      currentIdx = (currentIdx - 1 + currentCards.length) % currentCards.length;
      resetFlipInstant();
      render();
    });
    document.getElementById('next-btn').addEventListener('click', () => {
      if (currentCards.length === 0) return;
      currentIdx = (currentIdx + 1) % currentCards.length;
      resetFlipInstant();
      render();
    });

    document.getElementById('shuffle-btn').addEventListener('click', () => {
      for (let i = currentCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentCards[i], currentCards[j]] = [currentCards[j], currentCards[i]];
      }
      currentIdx = 0;
      resetFlipInstant();
      render();
    });

    const respContainer = document.getElementById('response-buttons');
    if (respContainer) {
      function handleResponse(status) {
        if (currentCards.length === 0) return;
        const card = currentCards[currentIdx];
        App.trackResponse(card.kr, card.en, status, card.category, 'flashcard');
        if (status === 'dont_know') {
          const reinsertIdx = Math.min(currentIdx + 6, currentCards.length);
          currentCards.splice(reinsertIdx, 0, { ...card });
        }
        const btns = respContainer.querySelectorAll('.resp-btn');
        btns.forEach(b => b.classList.add('resp-used'));
        setTimeout(() => {
          btns.forEach(b => b.classList.remove('resp-used'));
          currentIdx = (currentIdx + 1) % currentCards.length;
          resetFlipInstant();
          render();
        }, 400);
      }
      respContainer.querySelector('[data-resp="know"]').addEventListener('click', () => handleResponse('know'));
      respContainer.querySelector('[data-resp="unsure"]').addEventListener('click', () => handleResponse('unsure'));
      respContainer.querySelector('[data-resp="dont_know"]').addEventListener('click', () => handleResponse('dont_know'));
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => App.exportResponses());

    // Keyboard for browse mode only
    document.addEventListener('keydown', (e) => {
      if (activeMode !== 'browse') return;
      if (e.key === 'ArrowLeft') document.getElementById('prev-btn').click();
      if (e.key === 'ArrowRight') document.getElementById('next-btn').click();
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        isFlipped = !isFlipped;
        render();
      }
      if (respContainer) {
        if (e.key === '1') respContainer.querySelector('[data-resp="know"]').click();
        if (e.key === '2') respContainer.querySelector('[data-resp="unsure"]').click();
        if (e.key === '3') respContainer.querySelector('[data-resp="dont_know"]').click();
      }
    });

    let touchStartX = 0;
    flashcardEl.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    flashcardEl.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) document.getElementById('prev-btn').click();
        else document.getElementById('next-btn').click();
      }
    });

    render();
  })();


  // ========== LEARN MODE (Leitner SRS) ==========
  const GAPS = [0, 0, 1, 3, 7, 30];
  let learnCat = 'all';
  let learnSize = 25;
  let LQ = [], LI = 0, LOPEN = false;

  const box = kr => M[kr] ? M[kr].b : 0;
  const due = kr => {
    const m = M[kr];
    if (!m) return true;
    return Math.floor((Date.now() - m.t) / 864e5) >= GAPS[m.b] || m.b <= 1;
  };

  // Build category pills for Learn
  function buildCatPills(containerId, onChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'pill active';
    allBtn.dataset.cat = 'all';
    allBtn.textContent = 'All';
    container.appendChild(allBtn);
    for (const name of categories.keys()) {
      const btn = document.createElement('button');
      btn.className = 'pill';
      btn.dataset.cat = name;
      btn.textContent = name;
      container.appendChild(btn);
    }
    container.addEventListener('click', e => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      onChange(pill.dataset.cat);
    });
  }

  buildCatPills('learn-cat-pills', cat => { learnCat = cat; renderLearnHome(); });
  buildCatPills('quiz-cat-pills', cat => { quizCat = cat; renderQuizHome(); });

  // Size pills for Learn
  document.getElementById('learn-size-pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.getElementById('learn-size-pills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    learnSize = +pill.dataset.n;
    renderLearnHome();
  });

  function getLearnPool() {
    const pool = learnCat === 'all' ? [...allCards] : [...(categories.get(learnCat) || [])];
    return pool;
  }

  function renderLearnHome() {
    const pool = getLearnPool();
    const bx = [0, 0, 0, 0, 0, 0];
    pool.forEach(w => { bx[Math.min(box(w.kr), 5)]++; });
    for (let i = 0; i < 6; i++) document.getElementById('b' + i).textContent = bx[i];
    const mast = bx[5];
    const pct = pool.length ? Math.round(mast / pool.length * 100) : 0;
    document.getElementById('learn-pct').textContent = pct + '%';
    document.getElementById('learn-bar').style.width = pct + '%';
    const avail = pool.filter(w => box(w.kr) < 5).length;
    const goBtn = document.getElementById('go-learn');
    goBtn.textContent = 'Start Learning (' + avail + ' words)';
    goBtn.disabled = !avail;
  }

  // Start Learn
  document.getElementById('go-learn').addEventListener('click', startLearn);

  function startLearn() {
    const pool = getLearnPool().filter(w => box(w.kr) < 5);
    const dueWords = pool.filter(w => box(w.kr) > 0 && due(w.kr));
    const newWords = pool.filter(w => box(w.kr) === 0);
    let q = [...dueWords, ...newWords];
    if (learnSize > 0) q = q.slice(0, learnSize);
    if (!q.length) return;
    // Shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.random() * i | 0;
      [q[i], q[j]] = [q[j], q[i]];
    }
    LQ = q; LI = 0; LOPEN = false;
    document.getElementById('study-learn').classList.remove('hidden');
    showLearnCard();
  }

  const learnCard = document.getElementById('learn-card');

  function showLearnCard() {
    if (LI >= LQ.length) {
      showDone('learn', LQ.length, LQ.length);
      return;
    }
    LOPEN = false;
    learnCard.classList.remove('open');
    document.getElementById('learn-actions').classList.add('hidden');
    const w = LQ[LI];
    document.getElementById('learn-cat-label').textContent = w.category || '';
    document.getElementById('learn-kr').textContent = w.kr;
    document.getElementById('learn-en').textContent = w.en;
    document.getElementById('learn-rom').textContent = w.rom || '';
    document.getElementById('learn-hint').style.display = '';
    document.getElementById('lc').textContent = LI + 1;
    document.getElementById('lt').textContent = LQ.length;
    document.getElementById('sw-got').style.opacity = 0;
    document.getElementById('sw-again').style.opacity = 0;
    learnCard.style.transform = '';
    learnCard.style.transition = '';
    // Auto-speak
    App.speak(w.kr);
  }

  // Tap to reveal
  learnCard.addEventListener('click', () => {
    if (LOPEN) return;
    LOPEN = true;
    learnCard.classList.add('open');
    document.getElementById('learn-actions').classList.remove('hidden');
  });

  // Rate: Got it / Again
  async function lrate(ok) {
    const w = LQ[LI];
    const b = box(w.kr);
    if (ok) {
      M[w.kr] = { ...(M[w.kr] || {}), b: Math.min(b + 1, 5), t: Date.now() };
    } else {
      M[w.kr] = { ...(M[w.kr] || {}), b: 1, t: Date.now() };
      LQ.splice(Math.min(LI + 3, LQ.length), 0, { ...w });
      document.getElementById('lt').textContent = LQ.length;
    }
    await Storage.saveMastery(M);
    LI++;
    showLearnCard();
  }

  document.getElementById('btn-again').addEventListener('click', () => lrate(false));
  document.getElementById('btn-got-it').addEventListener('click', () => lrate(true));
  document.getElementById('learn-back').addEventListener('click', () => {
    document.getElementById('study-learn').classList.add('hidden');
    renderLearnHome();
  });

  // Swipe gestures for learn card
  let sx = 0, dragging = false, dx = 0;
  const SWIPE_TH = 80;

  function swipeStart(x) { sx = x; dragging = true; dx = 0; }
  function swipeMove(x) {
    if (!dragging || !LOPEN) return;
    dx = x - sx;
    learnCard.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
    document.getElementById('sw-got').style.opacity = dx > 20 ? Math.min(Math.abs(dx) / SWIPE_TH, 1) : 0;
    document.getElementById('sw-again').style.opacity = dx < -20 ? Math.min(Math.abs(dx) / SWIPE_TH, 1) : 0;
  }
  function swipeEnd() {
    if (!dragging) return;
    dragging = false;
    if (LOPEN && Math.abs(dx) > SWIPE_TH) {
      const d = dx > 0 ? 1 : -1;
      learnCard.style.transition = 'transform .18s';
      learnCard.style.transform = `translateX(${d * 300}px) rotate(${d * 12}deg)`;
      setTimeout(() => { learnCard.style.transition = ''; lrate(d > 0); }, 180);
    } else {
      learnCard.style.transform = '';
      document.getElementById('sw-got').style.opacity = 0;
      document.getElementById('sw-again').style.opacity = 0;
    }
  }

  learnCard.addEventListener('touchstart', e => swipeStart(e.touches[0].clientX), { passive: true });
  learnCard.addEventListener('touchmove', e => swipeMove(e.touches[0].clientX), { passive: true });
  learnCard.addEventListener('touchend', swipeEnd);
  learnCard.addEventListener('mousedown', e => { if (LOPEN) { swipeStart(e.clientX); e.preventDefault(); } });
  document.addEventListener('mousemove', e => { if (dragging) swipeMove(e.clientX); });
  document.addEventListener('mouseup', swipeEnd);

  // Learn keyboard
  document.addEventListener('keydown', e => {
    if (activeMode !== 'learn' || document.getElementById('study-learn').classList.contains('hidden')) return;
    if ((e.key === ' ' || e.key === 'Enter') && !LOPEN) {
      e.preventDefault();
      LOPEN = true;
      learnCard.classList.add('open');
      document.getElementById('learn-actions').classList.remove('hidden');
    }
    if (e.key === 'ArrowLeft' && LOPEN) lrate(false);
    if (e.key === 'ArrowRight' && LOPEN) lrate(true);
  });


  // ========== QUIZ MODE (Multiple Choice) ==========
  let quizCat = 'all';
  let quizSize = 25;
  let RQ = [], RI = 0, RSC = 0, RANS = false;

  document.getElementById('quiz-size-pills').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    document.getElementById('quiz-size-pills').querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    quizSize = +pill.dataset.n;
    renderQuizHome();
  });

  function getQuizPool() {
    return quizCat === 'all' ? [...allCards] : [...(categories.get(quizCat) || [])];
  }

  function renderQuizHome() {
    const pool = getQuizPool();
    const tested = pool.filter(w => M[w.kr] && M[w.kr].rv).length;
    const pct = pool.length ? Math.round(tested / pool.length * 100) : 0;
    document.getElementById('quiz-pct').textContent = pct + '%';
    document.getElementById('quiz-bar').style.width = pct + '%';
    const goBtn = document.getElementById('go-quiz');
    goBtn.textContent = 'Start Quiz (' + pool.length + ' words)';
    goBtn.disabled = pool.length < 4;
  }

  document.getElementById('go-quiz').addEventListener('click', startQuiz);

  function startQuiz() {
    let p = getQuizPool();
    if (p.length < 4) return;
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.random() * i | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    RQ = quizSize > 0 ? p.slice(0, quizSize) : p;
    RI = 0; RSC = 0;
    document.getElementById('study-quiz').classList.remove('hidden');
    showQuizQ();
  }

  function showQuizQ() {
    if (RI >= RQ.length) {
      showDone('quiz', RSC, RQ.length);
      return;
    }
    RANS = false;
    const w = RQ[RI];
    document.getElementById('quiz-word').textContent = w.en;
    document.getElementById('rc').textContent = RI + 1;
    document.getElementById('rtt').textContent = RQ.length;
    document.getElementById('quiz-sc').textContent = RSC;
    document.getElementById('quiz-tot').textContent = RI;

    // Build 4 options
    const pool = allCards.filter(x => x.kr !== w.kr);
    const opts = [w];
    while (opts.length < 4 && pool.length) {
      const r = Math.random() * pool.length | 0;
      const pk = pool.splice(r, 1)[0];
      if (!opts.find(o => o.kr === pk.kr)) opts.push(pk);
    }
    // Shuffle options
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.random() * i | 0;
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }

    const grid = document.getElementById('quiz-grid');
    grid.innerHTML = '';
    opts.forEach(o => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = o.kr;
      btn.addEventListener('click', async () => {
        if (RANS) return;
        RANS = true;
        grid.querySelectorAll('.quiz-opt').forEach(x => x.classList.add('off'));
        if (o.kr === w.kr) {
          btn.classList.add('ok');
          RSC++;
          if (!M[w.kr]) M[w.kr] = {};
          M[w.kr].rv = true;
          M[w.kr].rok = (M[w.kr].rok || 0) + 1;
        } else {
          btn.classList.add('bad');
          grid.querySelectorAll('.quiz-opt').forEach(x => {
            if (x.textContent === w.kr) x.classList.add('show');
          });
          if (!M[w.kr]) M[w.kr] = {};
          M[w.kr].rv = true;
          M[w.kr].rfail = (M[w.kr].rfail || 0) + 1;
        }
        await Storage.saveMastery(M);
        document.getElementById('quiz-sc').textContent = RSC;
        document.getElementById('quiz-tot').textContent = RI + 1;
        // Speak correct answer
        App.speak(w.kr);
        setTimeout(() => { RI++; showQuizQ(); }, 1000);
      });
      grid.appendChild(btn);
    });
  }

  document.getElementById('quiz-back').addEventListener('click', () => {
    document.getElementById('study-quiz').classList.add('hidden');
    renderQuizHome();
  });


  // ========== DONE SCREEN ==========
  let lastDoneMode = 'learn';

  function showDone(mode, sc, tot) {
    lastDoneMode = mode;
    const doneEl = document.getElementById('done-screen');
    doneEl.classList.remove('hidden');
    if (mode === 'learn') {
      document.getElementById('study-learn').classList.add('hidden');
      document.getElementById('done-icon').textContent = '\uD83D\uDCAA';
      document.getElementById('done-title').textContent = 'Done!';
      document.getElementById('done-desc').textContent = 'Studied ' + tot + ' words';
    } else {
      document.getElementById('study-quiz').classList.add('hidden');
      const p = tot ? Math.round(sc / tot * 100) : 0;
      document.getElementById('done-icon').textContent = p >= 80 ? '\uD83C\uDFC6' : '\uD83D\uDCD6';
      document.getElementById('done-title').textContent = sc + '/' + tot + ' correct';
      document.getElementById('done-desc').textContent = p + '%';
    }
  }

  document.getElementById('done-again').addEventListener('click', () => {
    document.getElementById('done-screen').classList.add('hidden');
    if (lastDoneMode === 'learn') startLearn(); else startQuiz();
  });
  document.getElementById('done-home').addEventListener('click', () => {
    document.getElementById('done-screen').classList.add('hidden');
    if (lastDoneMode === 'learn') renderLearnHome();
    else renderQuizHome();
  });


  // ========== SRS EXPORT / IMPORT / RESET ==========
  document.getElementById('srs-export').addEventListener('click', () => Storage.exportJSON());
  document.getElementById('srs-import').addEventListener('click', () => document.getElementById('srs-file-input').click());
  document.getElementById('srs-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const count = await Storage.importJSON(file);
      M = await Storage.getMastery();
      renderLearnHome();
      App.showToast('Imported ' + count + ' words');
    } catch (err) {
      App.showToast('Import failed: ' + err.message);
    }
    e.target.value = '';
  });
  document.getElementById('srs-reset').addEventListener('click', async () => {
    if (!confirm('Reset all learning progress? This cannot be undone.')) return;
    await Storage.clearAll();
    M = {};
    renderLearnHome();
    renderQuizHome();
    App.showToast('Progress reset');
  });


  // ========== ADD WORD FEATURE ==========
  const fab = document.getElementById('add-word-fab');
  const modal = document.getElementById('add-word-modal');
  const form = document.getElementById('add-word-form');

  fab.addEventListener('click', () => {
    modal.classList.remove('hidden');
    renderUserWordsList();
  });
  document.getElementById('modal-close').addEventListener('click', () => modal.classList.add('hidden'));
  // Close modal on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const word = {
      kr: document.getElementById('new-kr').value.trim(),
      en: document.getElementById('new-en').value.trim(),
      rom: document.getElementById('new-rom').value.trim().toUpperCase() || '',
      category: document.getElementById('new-cat').value,
      addedAt: new Date().toISOString(),
      source: 'user'
    };
    if (!word.kr || !word.en) return;

    // Duplicate check across all cards
    if (allCards.find(c => c.kr === word.kr)) {
      App.showToast('Word already exists!');
      return;
    }

    const existing = await Storage.getUserWords();
    existing.push(word);
    await Storage.saveUserWords(existing);

    // Inject into live pools
    allCards.push(word);
    if (!categories.has(word.category)) categories.set(word.category, []);
    categories.get(word.category).push(word);

    form.reset();
    App.showToast('Added: ' + word.kr);
    renderUserWordsList();
  });

  async function renderUserWordsList() {
    const list = document.getElementById('user-words-list');
    const words = await Storage.getUserWords();
    if (words.length === 0) {
      list.innerHTML = '<p style="font-size:0.8rem;color:#aaa;text-align:center;padding:12px 0">No custom words yet</p>';
      return;
    }
    list.innerHTML = words.map((w, i) =>
      '<div class="user-word-item">' +
        '<span class="uw-kr">' + w.kr + '</span>' +
        '<span class="uw-en">' + w.en + '</span>' +
        '<button class="uw-del" data-idx="' + i + '">&times;</button>' +
      '</div>'
    ).join('');
    list.querySelectorAll('.uw-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = +btn.dataset.idx;
        const words = await Storage.getUserWords();
        const removed = words.splice(idx, 1)[0];
        await Storage.saveUserWords(words);
        // Remove from live pools
        const ci = allCards.findIndex(c => c.kr === removed.kr && c.source === 'user');
        if (ci >= 0) allCards.splice(ci, 1);
        const catArr = categories.get(removed.category);
        if (catArr) {
          const ci2 = catArr.findIndex(c => c.kr === removed.kr);
          if (ci2 >= 0) catArr.splice(ci2, 1);
        }
        App.showToast('Removed: ' + removed.kr);
        renderUserWordsList();
      });
    });
  }

  document.getElementById('export-user-words').addEventListener('click', async () => {
    const words = await Storage.getUserWords();
    if (words.length === 0) { App.showToast('No words to export'); return; }
    const blob = new Blob([JSON.stringify({
      student: 'Miyahh',
      exported: new Date().toISOString(),
      words: words
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'miyahh_new_words_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });


  // ========== INITIAL RENDER ==========
  renderLearnHome();
  renderQuizHome();
})();
