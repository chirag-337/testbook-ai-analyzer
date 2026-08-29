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
    const text = textOf(container).slice(0, 250);
    const match = `${label} ${text}`.match(/(?:question\s*)?(\d{1,3})\s*(?:[.:)\-]|of\b)/i);
    return match ? Number(match[1]) : index + 1;
  }

  function extractSection(container) {
    const candidates = [
      container.querySelector('[class*="section" i]'),
      container.closest('[class*="section" i]')?.querySelector('[class*="title" i]')
    ].filter(Boolean);
    const visible = candidates.find(isVisible);
    return visible ? textOf(visible) : '';
  }

  function looksLikeQuestionText(text) {
    return /^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.:)\-]/i.test(text) ||
      /^(?:question\s*)?\d{1,3}\b/i.test(text);
  }

  function findQuestionContainers() {
    const selector = [
      '[class*="question" i]',
      '[class*="question-card" i]',
      '[class*="question-container" i]',
      '[class*="question-panel" i]',
      '[class*="test-question" i]',
      '[class*="question-wrapper" i]',
      '[data-question]',
      '[data-question-id]',
      '[data-testid*="question" i]',
      '[data-cy*="question" i]',
      '[aria-label*="question" i]',
      'article'
    ].join(',');

    const candidates = Array.from(document.querySelectorAll(selector)).filter(isVisible);
    const unique = [];
    const seen = new Set();

    for (const el of candidates) {
      const text = textOf(el);
      if (text.length < 20 || text.length > 8000) continue;
      if (/^(question|answer|option)$/i.test(text)) continue;

      // Prefer the smallest useful container so nested question elements don't duplicate the same question.
      const hasQuestionAncestor = Array.from(el.parentElement ? el.parentElement.querySelectorAll('[class*="question" i],[data-question],[data-question-id]') : [])
        .some(parent => parent !== el && parent.contains(el) && textOf(parent).length > text.length * 1.5);
      if (hasQuestionAncestor) continue;

      const key = text.slice(0, 500);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(el);
      }
    }

    // Fallback: locate visible blocks whose first line looks like Q1/Q2/etc.
    if (!unique.length) {
      const blocks = Array.from(document.querySelectorAll('div, li, article, section')).filter(isVisible);
      for (const el of blocks) {
        const text = textOf(el);
        if (text.length < 30 || text.length > 5000 || !looksLikeQuestionText(text)) continue;
        const childMatch = Array.from(el.children).some(child => looksLikeQuestionText(textOf(child)));
        if (childMatch) continue;
        const key = text.slice(0, 500);
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(el);
        }
      }
    }

    return unique;
  }

  function extractOptions(container) {
    const raw = Array.from(container.querySelectorAll(
      'label, [role="radio"], [role="option"], [class*="option" i], [class*="answer" i], input[type="radio"], input[type="checkbox"]'
    )).filter(isVisible);

    const options = [];
    const seen = new Set();
    for (const el of raw) {
      const owner = el.closest('label') || el;
      const text = clean(owner.innerText || owner.getAttribute('aria-label') || el.value || '');
      if (!text || text.length > 500 || seen.has(text)) continue;
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