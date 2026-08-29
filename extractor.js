(() => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const textOf = (el) => clean(el?.innerText || el?.textContent || '');
  const visible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
  };

  const OPTION_SELECTOR = 'li[ng-repeat*="option in getOptions"]';
  const hasClassToken = (el, token) => String(el?.className || '').split(/\s+/).some(c => c === token);

  function getOptions(card) {
    return [...card.querySelectorAll(OPTION_SELECTOR)]
      .filter(visible)
      .map((li, index) => {
        const valueEl = li.querySelector('.ans-view-box, [ng-bind-html*="parseDesc"]');
        const text = textOf(valueEl || li)
          .replace(/Your first attempt/gi, '')
          .replace(/\d+% answered correctly/gi, '')
          .trim();
        const selected = hasClassToken(li, 'first-attempt-option') ||
          li.getAttribute('aria-selected') === 'true' ||
          !!li.querySelector('[aria-selected="true"]');
        const correct = hasClassToken(li, 'correct-option') && !hasClassToken(li, 'incorrect-option');
        const incorrect = hasClassToken(li, 'incorrect-option');
        return { number: index + 1, text, selected, correct, incorrect, rawClass: String(li.className || '') };
      })
      .filter(o => o.text);
  }

  function findQuestionCards() {
    const result = [];
    const seen = new Set();
    for (const li of document.querySelectorAll(OPTION_SELECTOR)) {
      if (!visible(li)) continue;
      let node = li.parentElement;
      let best = null;
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

    const solutionMatch = raw.match(/correct answer is\s*["']?Option\s*(\d+)/i);
    const classCorrectIndex = options.findIndex(o => o.correct);
    const correctOption = classCorrectIndex >= 0 ? classCorrectIndex + 1 :
      (solutionMatch ? Number(solutionMatch[1]) : null);

    const selectedIndex = options.findIndex(o => o.selected);
    const selectedOption = selectedIndex >= 0 ? selectedIndex + 1 : null;

    let result = null;
    let resultSource = null;
    if (selectedOption !== null && correctOption !== null) {
      result = selectedOption === correctOption ? 'correct' : 'incorrect';
      resultSource = 'selected-vs-correct-option';
    } else {
      // Fallback ONLY to a dedicated status token at the start of the card,
      // not any arbitrary occurrence of the word "Correct" in the question.
      const statusMatch = raw.match(/^\s*(Correct|IncorrectMarks\s*-?\d*\.?\d*|Incorrect|Skipped)\b/i);
      if (statusMatch) {
        const status = statusMatch[1].toLowerCase();
        if (status === 'skipped') result = 'skipped';
        else if (status.startsWith('incorrect')) result = 'incorrect';
        else if (status === 'correct') result = 'correct';
        resultSource = 'explicit-card-status-fallback';
      }
    }

    let question = raw;
    if (numMatch) question = question.replace(numMatch[0], '');
    question = question
      .replace(/^\s*(Correct|IncorrectMarks\s*-?\d*\.?\d*|Incorrect|Skipped)\b/i, '')
      .replace(/Your:\s*\d{1,2}:\d{2}\s*Avg:\s*\d{1,2}:\d{2}/i, '')
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
      options: options.map(o => ({ text: o.text, selected: o.selected, correct: o.correct || false })),
      selectedAnswer: selectedOption ? options[selectedOption - 1].text : null,
      selectedOption,
      correctAnswer: correctOption && options[correctOption - 1] ? options[correctOption - 1].text : null,
      correctOption,
      result,
      resultSource,
      dataWarning: selectedOption === null || correctOption === null || resultSource === 'explicit-card-status-fallback',
      timeSeconds: timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : null,
      averageTimeSeconds: avgMatch ? Number(avgMatch[1]) * 60 + Number(avgMatch[2]) : null,
      marks: marksMatch ? Number(marksMatch[1]) : null,
      answeredCorrectlyPercent: pctMatch ? Number(pctMatch[1]) : null,
      source: location.href
    };
  }

  function validate(records) {
    const total = records.length;
    const correct = records.filter(q => q.result === 'correct').length;
    const incorrect = records.filter(q => q.result === 'incorrect').length;
    const skipped = records.filter(q => q.result === 'skipped').length;
    const unknown = records.filter(q => !q.result).length;
    const selectedMissing = records.filter(q => q.selectedOption === null).length;
    const correctMissing = records.filter(q => q.correctOption === null).length;
    return {
      totalQuestions: total,
      correct,
      incorrect,
      skipped,
      unknown,
      selectedMissing,
      correctMissing,
      resultCountValid: total === correct + incorrect + skipped + unknown,
      selectedAnswerCaptureWorking: selectedMissing === 0,
      correctAnswerCaptureWorking: correctMissing === 0,
      validated: total > 0 && unknown === 0 && correctMissing === 0
    };
  }

  function extract() {
    const cards = findQuestionCards();
    const questions = cards.map(parseQuestion).filter(Boolean);
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
      validation: validate(unique),
      questions: unique
    };
  }

  window.TestbookAnalyzer = { extract };
})();
