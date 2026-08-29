# Result Detection V2

This branch changes result extraction so per-option DOM state is the preferred source of truth.

## What changed

- Detect selected option from the option element state/classes instead of relying on `selectedAnswer` text.
- Detect the correct option from `correct-option` on the option element, with solution-text fallback.
- Calculate `correct` / `incorrect` when both selected and correct option indices are available.
- Use the visible card status only as a fallback and only when the status appears at the start of the question card.
- Add `resultSource` and `dataWarning` to every question.
- Add a top-level `validation` object showing whether question count, correct answers, and selected-answer capture are trustworthy.

## Important limitation

The current solution depends on the Testbook DOM class names observed by the extractor. If Testbook changes its frontend markup, the extension may need selector updates.

## Validation target

A healthy export should report:

- `count: 100`
- `validation.correctAnswerCaptureWorking: true`
- `validation.unknown: 0`
- `validation.correctAnswerCaptureWorking: true`
- and, on a completed attempt where selected states are rendered, `validation.selectedAnswerCaptureWorking: true`
