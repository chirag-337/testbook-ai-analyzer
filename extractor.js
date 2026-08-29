(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const textOf = (el) => clean(el?.innerText || el?.textContent || '');
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };

  // Testbook's solution UI uses <li ng-repeat="option in getOptions()">.
  const OPTION_SELECTOR = 'li[ng-repeat*="option in getOptions"]';

  function optionFromLi(li) {
    const valueEl = li.querySelector('.ans-view-box, [ng-bind-html*="parseDesc"]');
    const text = textOf(valueEl || li);
    const cls = String(li.className || '').toLowerCase();
    return {
      text,
      selected: /first-attempt-option/.test(cls) || /selected/.test(cls),
      correct: /correct-option/.test(cls) && !/incorrect-option/.test(cls),
      incorrect: /incorrect-option/.test(cls),
      rawClass: String(li.className || '')
    };
  }

  function findCardFromOption(li) {
    let node = li.parentElement;
    for (let depth = 0; node && depth < 10; depth++, node = node.parentElement) {
      const options = [...node.querySelectorAll(OPTION_SELECTOR)].filter(visible);
      const text = textOf(node);
      if (options.length >= 4 && /Question\s*No\.\s*\d+/i.test(text)) return node;
    }
    return null;
  }

  function parseQuestion(card, index) {
    const raw = textOf(card);
    const num = raw.match(/Question\s*No\.\s*(\d+)/i);
    const optionLis = [...card.querySelectorAll(OPTION_SELECTOR)].filter(visible);
    const options = optionLis.map(optionFromLi).filter(o => o.text && !/^your first attempt$/i.test(o.text));
    if (options.length < 4) return null;

    let question = raw;
    if (num) question = question.replace(num[0], '');
    const firstOptionIndex = options[0]?.text ? question.indexOf(options[0].text) : -1;
    if (firstOptionIndex > 0) question = question.slice(0, firstOptionIndex);
    question = question
      .replace(/\bCorrect\b|\bIncorrect\b|\bSkipped\b/gi, '')
      .replace(/You:\s*\d{1,2}:\d{2}\s*Avg:\s*\d{1,2}:\d{2}/i, '')
      .replace(/Marks\s*\d+(?:\.\d+)?/i, '')
      .replace(/\d+%\s*answered correctly/i, '')
      .trim();

    const timeMatch = raw.match(/You:\s*(\d{1,2}):(\d{2})/i);
    const avgMatch = raw.match(/Avg:\s*(\d{1,2}):(\d{2})/i);
    const solutionMatch = raw.match(/correct answer is\s*["']?Option\s*(\d+)/i);
    const classCorrect = options.findIndex(o => o.correct);
    const correctOption = classCorrect >= 0 ? classCorrect + 1 : (solutionMatch ? Number(solutionMatch[1]) : null);
    const selectedIndex = options.findIndex(o => o.selected);

    let result = null;
    if (selectedIndex >= 0 && correctOption) result = selectedIndex + 1 === correctOption ? 'correct' : 'incorrect';
    else if (/\bCorrect\b/i.test(raw)) result = 'correct';
    else if (/\bIncorrect\b/i.test(raw)) result = 'incorrect';
    else if (/\bSkipped\b/i.test(raw)) result = 'skipped';

    return {
      questionNumber: num ? Number(num[1]) : index + 1,
      section: null,
      question,
      options: options.slice(0, 4),
      selectedAnswer: selectedIndex >= 0 ? options[selectedIndex].text : null,
      selectedOption: selectedIndex >= 0 ? selectedIndex + 1 : null,
      correctAnswer: correctOption && options[correctOption - 1] ? options[correctOption - 1].text : null,
      correctOption,
      result,
      timeSeconds: timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : null,
      averageTimeSeconds: avgMatch ? Number(avgMatch[1]) * 60 + Number(avgMatch[2]) : null,
      source: location.href
    };
  }

  function extract() {
    const cards = [];
    const seen = new Set();
    for (const li of document.querySelectorAll(OPTION_SELECTOR)) {
      if (!visible(li)) continue;
      const card = findCardFromOption(li);
      if (!card || seen.has(card)) continue;
      seen.add(card);
      cards.push(card);
    }
    const questions = cards.map(parseQuestion).filter(Boolean);
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
