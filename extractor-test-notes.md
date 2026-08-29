# Result detection validation plan

Use a completed Testbook attempt and manually verify at least 20 questions covering:

1. correct answer selected
2. incorrect answer selected
3. skipped question
4. a question whose solution text contains the word "correct"
5. a question with negative marks shown in the card
6. a question with a long solution

For each record, verify:
- `selectedOption` matches the highlighted first-attempt option.
- `correctOption` matches the option carrying Testbook's correct-answer state.
- `result` is calculated from selected vs correct when selected state exists.
- `resultSource` identifies whether the result was calculated or fallback.
- `dataWarning` is true whenever selected/correct state was not fully captured.

Do not rely on the raw question text containing the word "Correct" as the primary result signal.
