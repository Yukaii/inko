---
name: bulk-import-formatter
description: Format and validate bulk import datasets for Inko vocabulary deck imports. Use when preparing CSV or TSV files for importing words into Inko decks, cleaning inconsistent source columns, enforcing required fields, generating import-ready files with proper field mapping.
---

# Bulk Import Formatter for Inko

## Overview

Prepare raw vocabulary data for bulk import into Inko decks. The Inko bulk import supports:

**Supported Fields:**
- `target` (required) - The word in target language (e.g., "勉強")
- `reading` - Hiragana/katakana reading (e.g., "べんきょう")
- `meaning` (required) - English translation (e.g., "study")
- `romanization` - Romaji representation (e.g., "benkyou")
- `example` - Example sentence (e.g., "毎日日本語を勉強しています")
- `tags` - Comma-separated tags (e.g., "n5, verb")

**Supported Formats:**
- CSV (comma-separated, supports quoted values)
- TSV (tab-separated)
- Files: `.csv`, `.tsv`, `.txt`

**Smart Features:**
- Auto-detects header rows
- Auto-maps columns based on header names
- Custom field mapping support
- Preview before import

## Workflow

1. Collect the import requirements.
   - Confirm source file path and format
   - Identify which columns map to which Inko fields
   - Note any required transformations

2. Run the formatter.
   - Execute the formatting script
   - Review the field mapping suggestions
   - Verify the preview output

3. Generate import-ready file.
   - Produce validated CSV/TSV
   - Review any rejected rows
   - Import into Inko

## Quick Commands

```bash
# Format and validate CSV for Inko
python3 skills/bulk-import-formatter/scripts/format_for_inko.py \
  --input ./vocabulary.csv \
  --output ./inko-ready.csv

# With custom field mapping
python3 skills/bulk-import-formatter/scripts/format_for_inko.py \
  --input ./anki-export.csv \
  --output ./inko-ready.tsv \
  --format tsv \
  --mapping '{"Front": "target", "Back": "meaning", "Reading": "reading"}'

# Validate only, no output
python3 skills/bulk-import-formatter/scripts/format_for_inko.py \
  --input ./vocabulary.csv \
  --validate-only
```

## Header Auto-Mapping

The formatter automatically recognizes these header patterns:

| Inko Field | Recognized Headers |
|------------|-------------------|
| target | target, word, kanji, japanese, front, term |
| reading | reading, furigana, kana, hiragana |
| meaning | meaning, definition, english, translation, back |
| romanization | romanization, romaji, romanji |
| example | example, sentence, context |
| tags | tags, tag, category, categories, deck |

## Example Input/Output

**Input CSV:**
```csv
Word,Reading,Definition,Romaji,Example
食べる,たべる,to eat,taberu,私は寿司を食べます
飲む,のむ,to drink,nomu,お茶を飲みます
```

**Output CSV (Inko-ready):**
```csv
target,reading,meaning,romanization,example,tags
食べる,たべる,to eat,taberu,私は寿司を食べます,
飲む,のむ,to drink,nomu,お茶を飲みます,
```

## Validation Rules

- **target**: Required, non-empty string
- **meaning**: Required, non-empty string
- **reading**: Optional, preserved as-is
- **romanization**: Optional, preserved as-is
- **example**: Optional, preserved as-is
- **tags**: Optional, comma-separated or single value

## Output Contract

- Writes valid rows to `--output` in the specified format
- Prints field mapping suggestions to stdout
- Shows preview of first 5 rows
- Exit code 0 on success, 1 on structural failures
- Reports validation errors per row

## References

- Use [`references/inko-import-schema.md`](references/inko-import-schema.md) for detailed schema documentation
- Use [`scripts/format_for_inko.py`](scripts/format_for_inko.py) for the formatting script
