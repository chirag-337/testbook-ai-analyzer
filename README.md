# Testbook AI Analyzer

A Chrome Extension (Manifest V3) that extracts mock-test data from Testbook pages and turns it into a portable JSON report for AI-powered analysis.

## Current scope

- Detect question-like cards on Testbook pages
- Extract question text and visible options
- Detect selected and correct options using common UI/accessibility signals
- Capture question number and section when available
- Export extracted data as JSON
- Copy a ready-to-paste analysis prompt to the clipboard

## Architecture

```text
Testbook page
    |
    v
content.js  ---- DOM extraction ----> normalized question records
    |
    v
chrome.runtime message
    |
    v
popup.js ---- JSON export / prompt generation
```

## Important limitation

Testbook's frontend can change its DOM structure. The extractor therefore uses multiple heuristics instead of depending on one CSS selector. If a new Testbook layout is not recognized, update `extractor.js` with the site's current DOM patterns.

## Install locally

1. Clone the repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository folder.
6. Open a Testbook mock-test/results page.
7. Click the extension and choose **Scan page**.

No API key is required for the extractor.

## Privacy

The extension does not send extracted test data to a server. Data stays in the browser until the user exports or copies it.

## Roadmap

- Testbook-specific selectors based on real captured layouts
- Score/time/accuracy extraction
- Topic-wise analysis
- Error classification
- CSV export
- One-click handoff workflow to ChatGPT
- Automated regression fixtures for Testbook layouts

## Disclaimer

This is an independent utility and is not affiliated with or endorsed by Testbook. Use it only with pages/data you are authorized to access.