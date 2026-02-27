# Inko Bulk Import Schema

## Overview

Inko supports importing vocabulary words in bulk via CSV or TSV files. This document describes the complete schema, validation rules, and best practices.

## Supported File Formats

### CSV (Comma-Separated Values)
- Extension: `.csv`
- Delimiter: Comma (`,`)
- Supports quoted values for fields containing commas
- Encoding: UTF-8

### TSV (Tab-Separated Values)
- Extension: `.tsv`, `.txt`
- Delimiter: Tab (`\t`)
- No quoting necessary for most content
- Encoding: UTF-8

## Field Schema

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `target` | **Yes** | String | The word in the target language (Japanese kanji/kana) | `勉強` |
| `reading` | No | String | Hiragana/katakana reading | `べんきょう` |
| `meaning` | **Yes** | String | English translation/definition | `study; learning` |
| `romanization` | **Yes** | String | Romaji (Latin alphabet) representation | `benkyou` |
| `example` | No | String | Example sentence using the word | `毎日日本語を勉強しています。` |
| `tags` | No | String or Array | Comma-separated tags/categories | `n5, verb, daily` |

## Header Auto-Detection

Inko automatically recognizes these header variations:

### Target Field
- `target`
- `word`
- `kanji`
- `japanese`
- `front` (Anki-style)
- `term`
- `vocabulary`

### Reading Field
- `reading`
- `furigana`
- `kana`
- `hiragana`
- `katakana`

### Meaning Field
- `meaning`
- `definition`
- `english`
- `translation`
- `back` (Anki-style)

### Romanization Field
- `romanization`
- `romaji`
- `romanji`
- `hepburn`

### Example Field
- `example`
- `sentence`
- `context`
- `usage`
- `example_sentence`

### Tags Field
- `tags`
- `tag`
- `category`
- `categories`
- `deck`
- `group`
- `level`

## Validation Rules

### Required Fields
- `target`: Must be non-empty string
- `meaning`: Must be non-empty string
- `romanization`: Must be non-empty string (used for practice mode typing)

### Optional Fields
- All other fields are optional
- Empty values are treated as `null`/unset
- Whitespace is trimmed from all fields

### Tags Format
Tags can be provided as:
- Single value: `verb`
- Comma-separated: `n5, verb, daily`
- Multi-value cells are split on commas

## Example Files

### Minimal CSV (Headers Detected)
```csv
Word,Meaning,Romaji
食べる,to eat,taberu
飲む,to drink,nomu
読む,to read,yomu
```

### Full CSV with All Fields
```csv
target,reading,meaning,romanization,example,tags
食べる,たべる,to eat,taberu,私は寿司を食べます。,"verb, n5, food"
飲む,のむ,to drink,nomu,お茶を飲みます。,"verb, n5, beverage"
読む,よむ,to read,yomu,本を読みます。,"verb, n5, activity"
```

### TSV Format
```tsv	target	reading	meaning	romanization	example
食べる	たべる	to eat	taberu	私は寿司を食べます。
飲む	のむ	to drink	nomu	お茶を飲みます。
```

### No-Header CSV (Columns Named Automatically)
```csv
食べる,たべる,to eat,taberu,私は寿司を食べます。
飲む,のむ,to drink,nomu,お茶を飲みます。
読む,よむ,to read,yomu,本を読みます。
```
When no headers are detected, columns are named: `Column 1`, `Column 2`, etc. You will need to map columns manually in the UI.

## Data Import Workflow

1. **Prepare Data**: Create CSV/TSV with your vocabulary
2. **Upload/Paste**: Upload file or paste text in Inko
3. **Field Mapping**: Review/adjust column-to-field mappings
4. **Preview**: See first 5 rows before importing
5. **Import**: Import all valid rows into selected deck

## Error Handling

### Row-Level Errors
Rows missing required fields (`target`, `meaning`, or `romanization`) are rejected with an error message.

### Common Issues
- **Empty target/meaning/romanization**: Row is skipped (these are all required)
- **Wrong delimiter**: File may not parse correctly (use comma for CSV, tab for TSV)
- **Encoding issues**: Save files as UTF-8
- **Extra columns**: Unmapped columns are ignored

## Best Practices

1. **Use Headers**: Include descriptive headers for auto-mapping
2. **Consistent Format**: Stick to one format per file (don't mix CSV and TSV)
3. **UTF-8 Encoding**: Ensure special characters (日本語) save correctly
4. **Quote Commas**: In CSV, quote fields containing commas: `"tag1, tag2"`
5. **Preview First**: Always check the preview before bulk importing
6. **Test Small**: Test with 5-10 rows first, then import the full dataset

## Exporting from Other Apps

### Anki
Export as "Notes in Plain Text" (.txt), then convert to CSV with proper headers.

### Spreadsheets (Excel/Google Sheets)
Save as CSV (UTF-8) with headers in the first row.

### JSON
Convert to CSV using tools like `jq` or the Inko formatter script.

## Script Usage

Use the formatter script to prepare and validate data:

```bash
# Basic formatting
python3 skills/bulk-import-formatter/scripts/format_for_inko.py \
  --input vocabulary.csv \
  --output inko-ready.csv

# Custom mapping for non-standard headers
python3 skills/bulk-import-formatter/scripts/format_for_inko.py \
  --input anki-export.txt \
  --output inko-ready.tsv \
  --format tsv \
  --mapping '{"Front": "target", "Back": "meaning", "Tags": "tags"}'

# Validate only
python3 skills/bulk-import-formatter/scripts/format_for_inko.py \
  --input vocabulary.csv \
  --validate-only
```
