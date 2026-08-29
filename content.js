let autoRunning = false;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function visible(el) {
  if (!el) return false;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
}

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function clickByText(text, timeout = 4000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const candidates = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')]
        .filter(visible)
        .filter(el => clean(el.innerText || el.textContent || el.value).toLowerCase() === text.toLowerCase());
      if (candidates.length) {
        candidates[0].click();
        resolve(true);
        return;
      }
      if (Date.now() - started > timeout) {
        reject(new Error(`Could not find visible "${text}" button.`));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

function currentQuestionNumber() {
  const text = clean(document.body.innerText);
  const m = text.match(/Question\s*No\.\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function solutionVisible() {
  const text = clean(document.body.innerText);
  if (/correct answer is\s*["']?Option\s*\d+/i.test(text)) return true;
  if (/BODMAS|Hence,? the correct answer/i.test(text) && /Solution/i.test(text)) return true;
  if ([...document.querySelectorAll('li[ng-repeat*="option in getOptions"]')]
    .some(li => visible(li) && /correct-option/.test(String(li.className || '')))) return true;
  return false;
}

function viewSolutionButtonExists() {
  return [...document.querySelectorAll('button, a, [role="button"]')]
    .some(el => visible(el) && /view\s+solution/i.test(clean(el.innerText || el.textContent)));
}

function nextButtonExists() {
  return [...document.querySelectorAll('button, a, [role="button"]')]
    .some(el => visible(el) && clean(el.innerText || el.textContent).toLowerCase() === 'next');
}

async function waitForQuestionChange(oldNumber, timeout = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const n = currentQuestionNumber();
    if (n && n !== oldNumber) return n;
    await wait(150);
  }
  return currentQuestionNumber();
}

async function ensureSolution() {
  if (solutionVisible()) return true;

  if (viewSolutionButtonExists()) {
    try {
      await clickByText('View Solution', 2500);
    } catch (_) {
      // Testbook may rerender between detection and click.
    }

    const started = Date.now();
    while (!solutionVisible() && Date.now() - started < 5000) await wait(150);
    return solutionVisible();
  }

  // Testbook can automatically open the solution. Never make this fatal.
  const started = Date.now();
  while (!solutionVisible() && Date.now() - started < 2500) await wait(150);
  return solutionVisible();
}

function getSectionTabs() {
  const candidates = [...document.querySelectorAll('button, a, [role="button"], div, span')]
    .filter(visible)
    .map(el => ({ el, text: clean(el.innerText || el.textContent), r: el.getBoundingClientRect() }))
    .filter(x => x.text && x.text.length >= 3 && x.text.length <= 45)
    .filter(x => x.r.top >= 120 && x.r.top <= 220 && x.r.left >= 70 && x.r.left < window.innerWidth * 0.65)
    .filter(x => !/^(SECTIONS|English|Hindi|Save|Report|Analytics|Filter)$/i.test(x.text));

  const byText = new Map();
  for (const x of candidates) {
    const old = byText.get(x.text);
    if (!old || x.r.width * x.r.height > old.r.width * old.r.height) byText.set(x.text, x);
  }

  return [...byText.values()]
    .sort((a, b) => a.r.left - b.r.left)
    .map(x => x.el)
    .filter(el => el.parentElement);
}

function currentSectionName() {
  const heading = [...document.querySelectorAll('body *')]
    .find(el => visible(el) && /^SECTION\s*:/i.test(clean(el.innerText || el.textContent)) && clean(el.innerText || el.textContent).length < 100);
  return heading ? clean(heading.innerText || heading.textContent).replace(/^SECTION\s*:\s*/i, '') : '';
}

async function moveToNextSection(currentNumber) {
  const tabs = getSectionTabs();
  if (tabs.length < 2) throw new Error(`Reached section end at question ${currentNumber}, but could not find the section tabs.`);

  const sectionName = currentSectionName();
  let currentIndex = -1;

  if (sectionName) {
    currentIndex = tabs.findIndex(tab =>
      clean(tab.innerText || tab.textContent).toLowerCase().includes(sectionName.toLowerCase())
    );
  }

  if (currentIndex < 0) {
    currentIndex = tabs.findIndex(tab => /active|selected/i.test(String(tab.className || '')));
  }

  if (currentIndex < 0) currentIndex = 0;
  const nextTab = tabs[currentIndex + 1];
  if (!nextTab) return false;

  const oldSection = sectionName.toLowerCase();
  nextTab.click();

  const started = Date.now();
  while (Date.now() - started < 8000) {
    await wait(150);
    const newSection = currentSectionName().toLowerCase();
    const n = currentQuestionNumber();
    if ((newSection && newSection !== oldSection) || (n && n > currentNumber)) return true;
  }
  return false;
}

async function autoExtract(sendProgress) {
  if (autoRunning) throw new Error('An automatic scan is already running.');
  autoRunning = true;
  const all = [];
  const seen = new Set();

  try {
    for (let guard = 0; guard < 110; guard++) {
      const qn = currentQuestionNumber();
      if (!qn) throw new Error('Could not detect the current question number.');

      if (!seen.has(qn)) {
        await ensureSolution();
        await wait(200);
        const record = window.TestbookAnalyzer?.extract();
        if (record?.questions?.length) {
          const q = record.questions.find(x => x.questionNumber === qn) || record.questions[0];
          all.push(q);
          seen.add(qn);
          sendProgress?.({ done: all.length, total: 100, questionNumber: qn });
        }
      }

      if (qn >= 100) break;

      // Do NOT infer section boundaries from the visible question grid.
      // Testbook can render only part of the grid, and that caused false
      // section-end detections (e.g. stopping at Q22 in a 25-question section).
      // Instead, click Next normally and detect a section transition only if
      // Testbook fails to advance or wraps to a lower question number.
      if (!nextButtonExists()) {
        const moved = await moveToNextSection(qn);
        if (!moved) throw new Error(`Stopped at question ${qn}: Next button not found and could not move to the next section.`);
        await wait(350);
        continue;
      }

      await clickByText('Next', 5000);
      const nextQ = await waitForQuestionChange(qn, 7000);
      await wait(250);

      // Normal case: Q22 -> Q23, Q25 -> Q26, etc.
      if (nextQ && nextQ > qn) continue;

      // Section-end case: Testbook's Next can wrap/reset instead of moving
      // globally. Recover by clicking the next section tab automatically.
      const moved = await moveToNextSection(qn);
      if (!moved) throw new Error(`Reached question ${qn}, but could not move to the next section.`);
      await wait(350);
    }

    all.sort((a, b) => a.questionNumber - b.questionNumber);
    return {
      extractedAt: new Date().toISOString(),
      pageTitle: document.title,
      url: location.href,
      count: all.length,
      questions: all
    };
  } finally {
    autoRunning = false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EXTRACT_TEST') {
    try {
      const data = window.TestbookAnalyzer?.extract();
      sendResponse({ ok: true, data });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  }

  if (message?.type === 'AUTO_EXTRACT_TEST') {
    autoExtract(progress => {
      chrome.runtime.sendMessage({ type: 'AUTO_PROGRESS', progress }).catch(() => {});
    })
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
