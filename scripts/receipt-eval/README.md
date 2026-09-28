# Receipt extraction test set

Scores the two receipt extractors — Tesseract + regex (current default) and
Claude vision (`RECEIPT_EXTRACTOR=claude`) — against hand-checked receipts,
so accuracy changes are measured rather than guessed.

The photos are real member receipts (names, card digits), so `fixtures/`
and `results.json` are gitignored. Keep the folder somewhere private; never
commit it.

## 1. Build the fixture set

Seed it from receipts already in the database, flagged/rejected ones first
if you want the hard cases:

```sh
DATABASE_URL=... npm run eval:export -- --limit 40
DATABASE_URL=... npm run eval:export -- --limit 20 --flagged-only
```

This writes `<receipt-id>.jpg` plus a draft `<receipt-id>.expected.json`
pre-filled from what the old scanner stored. **The drafts are the old
scanner's output, not the truth.** Open each photo, correct every field,
fill in the date, then set `"verified": true`. Only verified fixtures are
scored. You can also drop in any photo with a hand-written expected file.

```json
{
  "verified": true,
  "merchantName": "Strand Golf Club",
  "receiptNumber": "INV-20931",
  "date": "2026-09-03",
  "time": "14:32",
  "items": [
    { "description": "Titleist Pro V1 Dozen", "quantity": 2, "price": 1798.0 },
    { "description": "9 Hole Round", "quantity": 1, "price": 250.0 }
  ],
  "subtotal": 2048.0,
  "vat": 267.13,
  "grandTotal": 2048.0
}
```

Leave a field out to skip scoring it; set it to `null` when it isn't
printed on the slip (the extractor must then also return nothing). `price`
is the line total; an item marked PAID/COMP or charged to an account is `0`.

## 2. Run it

```sh
ANTHROPIC_API_KEY=... npm run eval:receipts                     # both
npm run eval:receipts -- --extractor tesseract                  # no API key needed
npm run eval:receipts -- --extractor claude
```

It prints per-field accuracy, item precision/recall, the share of receipts
read fully correctly, failures and average seconds per scan for each
extractor, and writes every receipt's result to `results.json`.

Scoring rules: merchant name is a fuzzy match (≥ 0.8 similarity); receipt
numbers ignore spacing and punctuation; dates and times are normalised
(day-first for ambiguous dates); amounts must match to the cent; an item
counts as found when quantity and price match exactly and the description
is close.

Claude runs cost money per receipt, so a 40-receipt run is a small but real
API charge.

## Turning Claude on in the app

Set in the Vercel project's environment:

| Variable | Value |
| --- | --- |
| `RECEIPT_EXTRACTOR` | `claude` (unset = Tesseract) |
| `ANTHROPIC_API_KEY` | your key |
| `RECEIPT_EXTRACTION_MODEL` | optional, default `claude-opus-5` |
| `RECEIPT_EXTRACTION_EFFORT` | optional, `low` / `medium` / `high`, default `medium` |

Any Claude failure (timeout, outage, bad response) falls back to Tesseract
for that scan.
