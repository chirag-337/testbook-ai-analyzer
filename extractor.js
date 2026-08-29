(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const textOf = (el) => clean(el?.innerText || el?.textContent || '');
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
  };

  // Confirmed from Testbook's current DOM in DevTools.
  const OPTION_SELECTOR = 'li[ng-repeat*="option in getOptions"]';

  function getOptions(card) {
    return [...card.querySelectorAll(OPTION_SELECTOR)]
      .filter(visible)
      .map((li) => {
        const valueEl = li.querySelector('.ans-view-box, [ng-bind-html*="parseDesc"]');
        const text = textOf(valueEl || li)
          .replace(/Your first attempt/gi, '')
          .replace(/\d+% answered correctly/gi, '')
          .trim();
        const cls = String(li.className || '').toLowerCase();
        return {
          text,
          selected: /first-attempt-option/.test(cls),
          correct: /correct-option/.test(cls) && !/incorrect-option/.test(cls),
          incorrect: /incorrect-option/.test(cls),
          rawClass: String(li.className || '')
        };
      })
      .filter((o) => o.text);
  }

  function findQuestionCards() {
    const result = [];
    const seen = new Set();

    for (const li of document.querySelectorAll(OPTION_SELECTOR)) {
      if (!visible(li)) continue;

      let node = li.parentElement;
      let best = null;

      // Walk upward and prefer the smallest visible ancestor containing
      // exactly 4 option <li>s and question metadata.
      for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
        if (!visible(node)) continue;
        const opts = [...node.querySelectorAll(OPTION_SELECTOR)].filter(visible);
        if (opts.length === 4) {
          const txt = textOf(node);
          if (/Question\s*No\.\s*\d+/i.test(txt) || /Your:\s*\d{1,2}:\d{2}/i.test(txt)) {
            best = node;
            break;
          }
        }
      }

      if (best && !seen.has(best)) {
        seen.add(best);
        result.push(best);
      }
    }
    return result;
  }

  function parseQuestion(card, index) {
    const raw = textOf(card);
    const numMatch = raw.match(/Question\s*No\.\s*(\d+)/i);
    const options = getOptions(card).slice(0, 4);
    if (options.length !== 4) return null;

    const timeMatch = raw.match(/You:\s*(\d{1,2}):(\d{2})/i);
    const avgMatch = raw.match(/Avg:\s*(\d{1,2}):(\d{2})/i);
    const marksMatch = raw.match(/Marks\s*([\d.]+)/i);
    const pctMatch = raw.match(/(\d+)%\s*answered correctly/i);

    // Testbook exposes the official answer in the solution text as
    // "correct answer is \"Option N\"". This is safer than guessing from color.
    const solutionMatch = raw.match(/correct answer is\s*["']?Option\s*(\d+)/i);
    const classCorrectIndex = options.findIndex((o) => o.correct);
    const correctOption = classCorrectIndex >= 0
      ? classCorrectIndex + 1
      : (solutionMatch ? Number(solutionMatch[1]) : null);

    const selectedIndex = options.findIndex((o) => o.selected);

    let result = null;
    if (/\bCorrect\b/i.test(raw) && !/\bIncorrect\b/i.test(raw)) result = 'correct';
    else if (/\bIncorrect\b/i.test(raw)) result = 'incorrect';
    else if (/\bSkipped\b/i.test(raw)) result = 'skipped';
    else if (selectedIndex >= 0 && correctOption) {
      result = selectedIndex + 1 === correctOption ? 'correct' : 'incorrect';
    }

    // Remove page chrome and the four option strings from the question text.
    let question = raw;
    if (numMatch) question = question.replace(numMatch[0], '');
    question = question
      .replace(/\bCorrect\b|\bIncorrect\b|\bSkipped\b/gi, '')
      .replace(/You:\s*\d{1,2}:\d{2}\s*Avg:\s*\d{1,2}:\d{2}/i, '')
      .replace(/Marks\s*[\d.]+/i, '')
      .replace(/\d+%\s*answered correctly/i, '')
      .replace(/Re-attempt mode:\s*ON/gi, '')
      .replace(/Now You can re-attempt the question/gi, '')
      .replace(/View Solution.*?(?=Previous|Next|$)/gi, '')
      .replace(/Previous\s+Next.*/i, '')
      .trim();

    const firstOptionPosition = options[0]?.text ? question.indexOf(options[0].text) : -1;
    if (firstOptionPosition > 0) question = question.slice(0, firstOptionPosition).trim();

    return {
      questionNumber: numMatch ? Number(numMatch[1]) : index + 1,
      section: null,
      question,
      options: options.map((o) => ({
        text: o.text,
        selected: o.selected,
        correct: o.correct || false
      })),
      selectedAnswer: selectedIndex >= 0 ? options[selectedIndex].text : null,
      selectedOption: selectedIndex >= 0 ? selectedIndex + 1 : null,
      correctAnswer: correctOption && options[correctOption - 1] ? options[correctOption - 1].text : null,
      correctOption,
      result,
      timeSeconds: timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : null,
      averageTimeSeconds: avgMatch ? Number(avgMatch[1]) * 60 + Number(avgMatch[2]) : null,
      marks: marksMatch ? Number(marksMatch[1]) : null,
      answeredCorrectlyPercent: pctMatch ? Number(pctMatch[1]) : null,
      source: location.href
    };
  }

  function extract() {
    const cards = findQuestionCards();
    const questions = cards.map(parseQuestion).filter(Boolean);

    // Testbook may render duplicate wrappers for the same question. Keep the
    // first complete record for each question number.
    const unique = [];
    const seenNumbers = new Set();
    for (const q of questions) {
      if (seenNumbers.has(q.questionNumber)) continue;
      seenNumbers.add(q.questionNumber);
      unique.push(q);
    }

    return {
      extractedAt: new Date().toISOString(),
      pageTitle: document.title,
      url: location.href,
      count: unique.length,
      questions: unique
    };
  }

  window.TestbookAnalyzer = { extract };
})();
