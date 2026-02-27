---
name: bulk-import-formatter
description: Format and validate bulk import datasets against a target schema. Use when preparing CSV, JSON, or JSONL files for batch import APIs/CRMs/ERPs, cleaning inconsistent source columns, enforcing required fields and types, normalizing dates/booleans, generating reject reports, or producing deterministic import-ready output.
---

# Bulk Import Formatter

## Overview

Prepare raw bulk-import files into schema-safe output with reproducible transformations. Use the bundled script for deterministic conversion, and use the reference file to define field mapping and validation rules quickly.

## Workflow

1. Collect the import contract.
- Confirm source file path, target format (`csv`, `json`, or `jsonl`), and required destination fields.
- Confirm normalization rules: date formats, booleans, enum constraints, defaults, and required fields.

2. Create a transform spec.
- Build a JSON spec following [`references/formatting-rules.md`](references/formatting-rules.md).
- Map each destination field to a source key plus validation/coercion rules.

3. Run the formatter.
- Execute `scripts/format_bulk_import.py`.
- Always produce an error report and optionally a reject file.

4. Verify and summarize.
- Check error count and rejected rows.
- Report any lossy transformations (default fills, parsing fallbacks, dropped extras).
- Provide final output file path plus quick import-readiness summary.

## Quick Commands

```bash
# Convert CSV to normalized CSV
python3 scripts/format_bulk_import.py \
  --input ./raw.csv \
  --output ./import-ready.csv \
  --spec ./customer-import-spec.json \
  --errors ./import-errors.csv \
  --rejects ./import-rejects.csv

# Convert JSONL to normalized JSONL
python3 scripts/format_bulk_import.py \
  --input ./raw.jsonl \
  --output ./import-ready.jsonl \
  --spec ./customer-import-spec.json \
  --errors ./import-errors.csv
```

## Output Contract

- Write valid rows to `--output`.
- Write validation/coercion errors to `--errors` as CSV.
- Write rejected rows to `--rejects` when provided.
- Exit non-zero only for structural failures (missing files/spec syntax/unsupported format), not for row-level validation failures.

## References

- Use [`references/formatting-rules.md`](references/formatting-rules.md) for spec schema and examples.
- Use [`scripts/format_bulk_import.py`](scripts/format_bulk_import.py) for deterministic normalization.
