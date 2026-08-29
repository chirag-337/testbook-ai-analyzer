let latest = null;
const status = document.getElementById('status');
const exportButton = document.getElementById('export');
const copyButton = document.getElementById('copy');

function setStatus(message) {
  status.textContent = message;
}

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0]);
}

document.getElementById('scan').addEventListener('click', async () => {
  try {
    const tab = await activeTab();
    if (!tab?.id || !/^https:\/\/(.*\.)?testbook\.com\//i.test(tab.url || '')) {
      setStatus('Open a Testbook page first.');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TEST' });
    if (!response?.ok) throw new Error(response?.error || 'Extraction failed');

    latest = response.data;
    exportButton.disabled = false;
    copyButton.disabled = false;
    setStatus(`Found ${latest.count} question container(s).\nReview the JSON before relying on it.`);
  } catch (error) {
    setStatus(`Could not scan this page.\n${error.message}`);
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