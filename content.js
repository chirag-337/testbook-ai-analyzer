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
});