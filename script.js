'use strict';

(function () {
    // Mode controls (Tailwind buttons)
    const modeEnRuBtn = document.getElementById('modeEnRuBtn');
    const modeRuEnBtn = document.getElementById('modeRuEnBtn');
    const startBtn = document.getElementById('startBtn');
    const countSelect = document.getElementById('countSelect');

    const settingsCard = document.getElementById('settingsCard');
    const gameCard = document.getElementById('gameCard');
    const promptEl = document.getElementById('prompt');
    const answerInput = document.getElementById('answerInput');
    const revealBtn = document.getElementById('revealBtn');
    const nextBtn = document.getElementById('nextBtn');
    const feedbackEl = document.getElementById('feedback');
    const progressEl = document.getElementById('progress');
    const scoreEl = document.getElementById('score');

    const resultCard = document.getElementById('resultCard');
    const finalCorrectEl = document.getElementById('finalCorrect');
    const finalTotalEl = document.getElementById('finalTotal');
    const accuracyEl = document.getElementById('accuracy');
    const restartBtn = document.getElementById('restartBtn');
    const homeBtn = document.getElementById('homeBtn');
    const homeBtn2 = document.getElementById('homeBtn2');
    const feedbackCardEl = document.getElementById('feedbackCard');
    const feedbackBodyEl = document.getElementById('feedbackBody');

    /** @type {{en: string|string[], ru: string|string[], phonetic?: string}[]} */
    let allWords = [];

    let mode = 'en-ru';
    let queue = [];
    let total = 0;
    let index = 0;
    let correct = 0;
    let awaitingNext = false; // true when the answer has been shown/correct and waiting for "Далее"

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function toArray(v) {
        if (Array.isArray(v)) return v;
        if (v == null) return [];
        return [String(v)];
    }

    function normalize(s) {
        return String(s).trim().toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[.,!?;:()\[\]{}"'`]/g, '');
    }

    function pickNRandom(arr, n) {
        const copy = [...arr];
        shuffle(copy);
        return copy.slice(0, Math.min(n, copy.length));
    }

    // ---- UI helpers for nicer feedback ----
    function setAnswerState(state) {
        // state: 'success' | 'reveal' | null
        answerInput.classList.remove('ring-2', 'ring-green-400', 'ring-amber-400', 'bg-green-50', 'bg-amber-50');
        if (state === 'success') {
            answerInput.classList.add('ring-2', 'ring-green-400', 'bg-green-50');
        } else if (state === 'reveal') {
            answerInput.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50');
        }
    }

    function feedbackIcon(type) {
        if (type === 'success') {
            return '<svg class="w-5 h-5 text-green-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 6.543-6.543a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
        }
        // info/reveal
        return '<svg class="w-5 h-5 text-amber-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-9-3a1 1 0 112 0 1 1 0 01-2 0zm.25 2.75a.75.75 0 000 1.5H10v3.5a.75.75 0 001.5 0v-4.25a.75.75 0 00-.75-.75h-1.5z" clip-rule="evenodd"/></svg>';
    }

    function feedbackCard({ type, title, lines }) {
        // Kept for compatibility but now unused by UI; rendering goes into fixed card
        const items = (lines || []).map(l => `<div>${l}</div>`).join('');
        return `<div><div class="font-semibold">${title}</div><div class="mt-1 text-sm">${items}</div></div>`;
    }

    function setFeedbackDefault() {
        if (!feedbackCardEl || !feedbackBodyEl) return;
        feedbackCardEl.classList.remove('bg-green-50', 'border-green-200', 'text-green-800', 'items-start', 'gap-3', 'justify-start');
        feedbackCardEl.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-800', 'items-center', 'justify-center');
        feedbackBodyEl.innerHTML = 'Результат';
    }

    function setFeedback(type, title, lines) {
        if (!feedbackCardEl || !feedbackBodyEl) return;
        // base sizing/layout
        feedbackCardEl.classList.add('p-4', 'h-24', 'flex', 'rounded-xl', 'border');
        feedbackCardEl.classList.remove('items-center', 'justify-center');
        feedbackCardEl.classList.add('items-start');
        // color scheme
        feedbackCardEl.classList.remove(
            'bg-amber-50', 'border-amber-200', 'text-amber-800',
            'bg-green-50', 'border-green-200', 'text-green-800',
            'bg-blue-50', 'border-blue-200', 'text-blue-800'
        );
        if (type === 'success') {
            feedbackCardEl.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
        } else {
            feedbackCardEl.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-800');
        }
        const items = (lines || []).map(l => `<div>${l}</div>`).join('');
        feedbackBodyEl.innerHTML = `<div class="font-semibold">${title}</div><div class="mt-1 text-sm">${items}</div>`;
    }

    // helpers to toggle visibility (support both Bootstrap d-none and Tailwind hidden)
    function showEl(el) {
        if (!el) return;
        el.classList.remove('d-none');
        el.classList.remove('hidden');
    }
    function hideEl(el) {
        if (!el) return;
        el.classList.add('hidden');
        el.classList.add('d-none');
    }

    function setModeFromUI() {
        // mode already stored; buttons update it via click handlers
    }
    function applyModeButtons() {
        if (mode === 'en-ru') {
            modeEnRuBtn?.classList.add('mode-button-active');
            modeRuEnBtn?.classList.remove('mode-button-active');
        } else {
            modeRuEnBtn?.classList.add('mode-button-active');
            modeEnRuBtn?.classList.remove('mode-button-active');
        }
    }

    function updateProgress() {
        progressEl.textContent = `${Math.min(index + 1, total)} / ${total}`;
        scoreEl.textContent = String(correct);
    }

    function currentItem() {
        return queue[index];
    }

    function buildPrompt(item) {
        const showRu = mode === 'en-ru';
        const source = showRu ? toArray(item.en)[0] : toArray(item.ru)[0];
        const direction = showRu ? 'Переведите на русский:' : 'Переведите на английский:';
        return { text: source, direction };
    }

    function expectedAnswers(item) {
        if (mode === 'en-ru') {
            return toArray(item.ru).map(normalize);
        } else {
            return toArray(item.en).map(normalize);
        }
    }

    function showItem() {
        const item = currentItem();
        if (!item) return;
        const p = buildPrompt(item);
        promptEl.innerHTML = `<div class="text-muted mb-1">${p.direction}</div><div class="fw-semibold">${p.text}</div>`;
        answerInput.value = '';
        answerInput.focus();
        setFeedbackDefault();
        setAnswerState(null);
        awaitingNext = false;
        revealBtn.classList.remove('hidden');
        revealBtn.classList.remove('d-none');
        nextBtn.disabled = true;
        updateProgress();
    }

    function showCorrectAndNext(item, markIncorrect = false) {
        const ruList = toArray(item.ru).join(', ');
        const enWord = toArray(item.en)[0] || '';
        const ph = item.phonetic ? ` <span class="text-muted">[${item.phonetic}]</span>` : '';
        const header = 'Правильный ответ';
        setFeedback('reveal', header, [
            `RU: <strong>${ruList}</strong>`,
            `EN: <strong>${enWord}</strong>${ph}`
        ]);
        setAnswerState('reveal');
        awaitingNext = true;
        nextBtn.disabled = false;
    }

    function checkAnswer() {
        if (awaitingNext) return;
        const item = currentItem();
        if (!item) return;

        const ans = normalize(answerInput.value);
        const exp = expectedAnswers(item);

        if (ans && exp.includes(ans)) {
            correct += 1;
            const enWord = toArray(item.en)[0] || '';
            const ph = item.phonetic ? ` <span class="text-muted">[${item.phonetic}]</span>` : '';
            const ruList = toArray(item.ru).join(', ');
            setFeedback('success', 'Верно!', [
                `RU: <strong>${ruList}</strong>`,
                `EN: <strong>${enWord}</strong>${ph}`
            ]);
            setAnswerState('success');
            awaitingNext = true;
            nextBtn.disabled = false;
        } else {
            // При вводе не показываем ошибку, просто не реагируем
            // reveal доступен после явного пропуска
        }
        updateProgress();
    }

    function onTypeCheck() {
        if (awaitingNext) return;
        const item = currentItem();
        if (!item) return;
        const ans = normalize(answerInput.value);
        if (!ans) {
            setFeedbackDefault();
            return;
        }
        const exp = expectedAnswers(item);
        if (exp.includes(ans)) {
            correct += 1;
            const enWord = toArray(item.en)[0] || '';
            const ph = item.phonetic ? ` <span class="text-muted">[${item.phonetic}]</span>` : '';
            const target = mode === 'en-ru' ? toArray(item.ru) : toArray(item.en);
            const expected = target.join(', ');
            setFeedback('success', 'Верно!', [
                `RU: <strong>${toArray(item.ru).join(', ')}</strong>`,
                `EN: <strong>${enWord}</strong>${ph}`
            ]);
            setAnswerState('success');
            awaitingNext = true;
            nextBtn.disabled = false;
            updateProgress();
        }
    }

    function next() {
        index += 1;
        if (index >= total) {
            finish();
            return;
        }
        showItem();
    }

    function finish() {
        hideEl(gameCard);
        showEl(resultCard);
        finalCorrectEl.textContent = String(correct);
        finalTotalEl.textContent = String(total);
        const acc = total ? Math.round((correct / total) * 100) : 0;
        accuracyEl.textContent = `Точность: ${acc}%`;
    }

    function startGame() {
        setModeFromUI();
        const count = Number(countSelect.value) || 50;
        if (!allWords.length) {
            alert('Список слов не загружен. Использую встроенный небольшой набор. Для загрузки words.json откройте проект через локальный сервер.');
        }
        const chosen = pickNRandom(allWords.length ? allWords : defaultEmbeddedWords, count);

        // Normalize items to have both en and ru arrays and carry phonetic if present
        queue = chosen.map(w => ({
            en: toArray(w.en),
            ru: toArray(w.ru),
            phonetic: w.phonetic || undefined
        }));

        total = queue.length;
        index = 0;
        correct = 0;

        hideEl(resultCard);
        hideEl(settingsCard);
        showEl(gameCard);
        showItem();
    }

    function loadWords() {
        function splitMany(v) {
            if (v == null) return [];
            if (Array.isArray(v)) return v;
            // split by common separators and trim
            return String(v)
                .split(/[,/;]|\s{2,}/)
                .map(s => s.trim())
                .filter(Boolean);
        }

        return fetch('words.json', { cache: 'no-store' })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(json => {
                if (!Array.isArray(json)) throw new Error('Invalid words.json format');
                allWords = json
                    .map(w => {
                        if (w.en || w.ru) {
                            return { en: splitMany(w.en), ru: splitMany(w.ru), phonetic: w.phonetic };
                        }
                        // support schema: { word, phonetic, translation }
                        if (w.word && (w.translation != null)) {
                            return { en: splitMany(w.word), ru: splitMany(w.translation), phonetic: w.phonetic };
                        }
                        // unknown shape; skip
                        return null;
                    })
                    .filter(Boolean)
                    .filter(w => w.en.length > 0 && w.ru.length > 0);
            })
            .catch(err => {
                console.warn('Не удалось загрузить words.json:', err);
                // keep allWords = [] so fallback will be used
            });
    }

    // Small embedded fallback sample (you should replace this by running via server to load words.json)
    const defaultEmbeddedWords = [
        { en: 'apple', ru: ['яблоко'] },
        { en: 'house', ru: ['дом'] },
        { en: 'car', ru: ['машина', 'автомобиль'] },
        { en: 'book', ru: ['книга'] },
        { en: 'cat', ru: ['кот', 'кошка'] },
        { en: 'dog', ru: ['собака'] },
        { en: 'sun', ru: ['солнце'] },
        { en: 'water', ru: ['вода'] },
        { en: 'food', ru: ['еда', 'пища'] },
        { en: 'city', ru: ['город'] },
        { en: 'friend', ru: ['друг', 'подруга'] },
        { en: 'family', ru: ['семья'] },
        { en: 'work', ru: ['работа'] },
        { en: 'school', ru: ['школа'] },
        { en: 'computer', ru: ['компьютер'] },
        { en: 'phone', ru: ['телефон'] },
        { en: 'music', ru: ['музыка'] },
        { en: 'movie', ru: ['фильм'] },
        { en: 'game', ru: ['игра'] },
        { en: 'road', ru: ['дорога'] },
        { en: 'river', ru: ['река'] },
        { en: 'mountain', ru: ['гора'] },
        { en: 'forest', ru: ['лес'] },
        { en: 'sea', ru: ['море'] },
        { en: 'bread', ru: ['хлеб'] },
        { en: 'milk', ru: ['молоко'] },
        { en: 'coffee', ru: ['кофе'] },
        { en: 'tea', ru: ['чай'] },
        { en: 'sugar', ru: ['сахар'] },
        { en: 'salt', ru: ['соль'] }
    ];

    // Events
    startBtn.addEventListener('click', startGame);
    revealBtn.addEventListener('click', () => {
        const item = currentItem();
        if (!item) return;
        showCorrectAndNext(item, true);
    });
    nextBtn.addEventListener('click', () => {
        if (!awaitingNext) return;
        nextBtn.disabled = true;
        next();
    });
    answerInput.addEventListener('input', onTypeCheck);
    restartBtn.addEventListener('click', () => {
        hideEl(gameCard);
        hideEl(resultCard);
        showEl(settingsCard);
    });
    homeBtn?.addEventListener('click', () => {
        hideEl(gameCard);
        hideEl(resultCard);
        showEl(settingsCard);
    });
    homeBtn2?.addEventListener('click', () => {
        hideEl(gameCard);
        hideEl(resultCard);
        showEl(settingsCard);
    });

    // Mode button events
    modeEnRuBtn?.addEventListener('click', () => { mode = 'en-ru'; applyModeButtons(); });
    modeRuEnBtn?.addEventListener('click', () => { mode = 'ru-en'; applyModeButtons(); });

    // Keyboard shortcuts: Ctrl (tap) => Reveal, Enter => Next (if active)
    let ctrlPressed = false;
    let ctrlComboUsed = false;

    document.addEventListener('keydown', (e) => {
        const gameHidden = gameCard.classList.contains('hidden') || gameCard.classList.contains('d-none');
        if (gameHidden) return;

        // Track Ctrl combinations to avoid triggering on Ctrl+C, Ctrl+V, etc.
        if (e.key === 'Control') {
            ctrlPressed = true;
            ctrlComboUsed = false;
            return;
        }
        if (ctrlPressed) {
            ctrlComboUsed = true;
        }

        // Enter -> Next when awaiting and button enabled
        if (e.key === 'Enter') {
            if (awaitingNext && !nextBtn.disabled) {
                e.preventDefault();
                nextBtn.click();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        const gameHidden = gameCard.classList.contains('hidden') || gameCard.classList.contains('d-none');
        if (gameHidden) return;

        if (e.key === 'Control') {
            if (ctrlPressed && !ctrlComboUsed && !awaitingNext) {
                e.preventDefault();
                revealBtn.click();
            }
            ctrlPressed = false;
            ctrlComboUsed = false;
        }
    });

    // init
    applyModeButtons();
    loadWords();
})();
