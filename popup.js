let latest = null;
const status = document.getElementById('status');
const autoButton = document.getElementById('auto');
const scanButton = document.getElementById('scan');
const exportButton = document.getElementById('export');
const copyButton = document.getElementById('copy');

function setStatus(message) { status.textContent = message; }

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]);
}

function validTestbookTab(tab) {
  return !!tab?.id && /^https:\/\/(.*\.)?testbook\.com\//i.test(tab.url || '');
}

document.getElementById('scan').addEventListener('click', async () => {
  try {
    const tab = await activeTab();
    if (!validTestbookTab(tab)) { setStatus('Open the Testbook completed-test page first.'); return; }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TEST' });
    if (!response?.ok) throw new Error(response?.error || 'Extraction failed');
    latest = response.data;
    exportButton.disabled = false;
    copyButton.disabled = false;
    setStatus(`Found ${latest.count} question container(s).`);
  } catch (error) {
    setStatus(`Could not scan this page.\n${error.message}`);
  }
});

autoButton.addEventListener('click', async () => {
  autoButton.disabled = true;
  scanButton.disabled = true;
  setStatus('Starting automatic scan...\nYou do not need to click anything.');
  try {
    const tab = await activeTab();
    if (!validTestbookTab(tab)) throw new Error('Open the Testbook completed-test page first.');

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'AUTO_EXTRACT_TEST' });
    if (!response?.ok) throw new Error(response?.error || 'Automatic scan failed');
    latest = response.data;
    exportButton.disabled = false;
    copyButton.disabled = false;
    setStatus(`DONE. Captured ${latest.count}/100 questions.\nExport JSON or copy the AI prompt.`);
  } catch (error) {
    setStatus(`Automatic scan stopped.\n${error.message}`);
  } finally {
    autoButton.disabled = false;
    scanButton.disabled = false;
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'AUTO_PROGRESS') {
    const p = message.progress;
    setStatus(`Scanning automatically...\nQuestion ${p.questionNumber} of ${p.total}\nCaptured: ${p.done}`);
  }
});

exportButton.addEventListener('click', () => {
  if (!latest) return;
  const blob = new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: `testbook-analysis-${Date.now()}.json`,
    saveAs: true
  }, () => setTimeout(() => URL.revokeObjectURL(url), 5000));
});

copyButton.addEventListener('click', async () => {
  if (!latest) return;
  const prompt = [
    'Analyze this Testbook mock-test attempt.',
    'Give me: (1) score/accuracy insights if present, (2) question-level mistakes,',
    '(3) likely conceptual vs careless errors, (4) weak topics, and',
    '(5) a prioritized revision plan. Do not invent missing data.',
    '',
    JSON.stringify(latest, null, 2)
  ].join('\n');
  await navigator.clipboard.writeText(prompt);
  setStatus('AI analysis prompt copied. Paste it into ChatGPT.');
});
