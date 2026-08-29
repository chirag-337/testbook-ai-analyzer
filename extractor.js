(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const textOf = (el) => clean(el?.innerText || el?.textContent || '');

  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  function optionState(el) {
    const classes = `${el.className || ''}`.toLowerCase();
    const aria = `${el.getAttribute('aria-checked') || ''} ${el.getAttribute('aria-selected') || ''}`.toLowerCase();
    const data = Array.from(el.attributes || [])
      .filter(a => /correct|answer|selected|checked/i.test(a.name))
      .map(a => `${a.name}=${a.value}`)
      .join(' ')
      .toLowerCase();

    return {
      selected: /selected|checked|active/.test(`${classes} ${aria} ${data}`),
      correct: /correct|right-answer|is-correct/.test(`${classes} ${data}`)
    };
  }

  function extractQuestionNumber(container, index) {
    const label = clean(container.querySelector('[aria-label*="Question" i]')?.getAttribute('aria-label'));
    const text = textOf(container).slice(0, 150);
    const match = `${label} ${text}`.match(/(?:question\s*)?(\d{1,3})\s*(?:[.:)\-]|of\b)/i);
    return match ? Number(match[1]) : index + 1;
  }

  function extractSection(container) {
    const candidates = [
      container.querySelector('[class*="section" i]'),
      container.closest('[class*="section" i]')?.querySelector('[class*="title" i]')
    ];
    return clean(candidates.find(isVisible) ? textOf(candidates.find(isVisible)) : '');
  }

  function findQuestionContainers() {
    const candidates = Array.from(document.querySelectorAll(
      '[class*="question" i], [data-question], [data-testid*="question" i], article'
    )).filter(isVisible);

    const unique = [];
    const seen = new Set();
    for (const el of candidates) {
      const text = textOf(el);
      if (text.length < 20 || text.length > 5000) continue;
      if (/^(question|answer|option)$/i.test(text)) continue;
      const key = text.slice(0, 300);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(el);
      }
    }

    return unique.filter(el => {
      const options = el.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="option"], label');
      return options.length >= 2;
    });
  }

  function extractOptions(container) {
    const raw = Array.from(container.querySelectorAll(
      'label, [role="radio"], [role="option"], input[type="radio"], input[type="checkbox"]'
    )).filter(isVisible);

    const options = [];
    const seen = new Set();
    for (const el of raw) {
      const owner = el.closest('label') || el;
      const text = clean(owner.innerText || owner.getAttribute('aria-label') || el.value || '');
      if (!text || text.length > 300 || seen.has(text)) continue;
      seen.add(text);
      const state = optionState(el);
      options.push({ text, selected: state.selected, correct: state.correct });
    }
    return options.slice(0, 8);
  }

  function extract() {
    const containers = findQuestionContainers();
    const questions = containers.map((container, index) => {
      const options = extractOptions(container);
      const full = textOf(container);
      const optionTexts = new Set(options.map(o => o.text));
      const questionText = clean(full.split('\n').filter(line => {
        const t = clean(line);
        return t && !optionTexts.has(t) && !/^\d+\s*(?:[.:)\-])?$/.test(t);
      }).join(' '));

      return {
        questionNumber: extractQuestionNumber(container, index),
        section: extractSection(container) || null,
        question: questionText,
        options,
        selectedAnswer: options.find(o => o.selected)?.text || null,
        correctAnswer: options.find(o => o.correct)?.text || null,
        source: location.href
      };
    });

    return {
      extractedAt: new Date().toISOString(),
      pageTitle: document.title,
      url: location.href,
      count: questions.length,
      questions
    };
  }

  window.TestbookAnalyzer = { extract };
})();