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
  return /correct answer is\s*["']?Option\s*\d+/i.test(text) || /Solution\s*$/im.test(text) && /BODMAS|Hence,? the correct answer/i.test(text);
}

function nextButtonExists() {
  return [...document.querySelectorAll('button, a, [role="button"]')]
    .some(el => visible(el) && clean(el.innerText || el.textContent).toLowerCase() === 'next');
}

async function waitForQuestionChange(oldNumber, timeout = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const n = currentQuestionNumber();
    if (n && n !== oldNumber) return n;
    await wait(150);
  }
  return currentQuestionNumber();
}

async function ensureSolution() {
  if (solutionVisible()) return;
  await clickByText('View Solution', 5000);
  const started = Date.now();
  while (!solutionVisible() && Date.now() - started < 6000) await wait(150);
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
      if (!nextButtonExists()) throw new Error(`Stopped at question ${qn}: Next button not found.`);
      await clickByText('Next', 5000);
      await waitForQuestionChange(qn, 7000);
      await wait(250);
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
