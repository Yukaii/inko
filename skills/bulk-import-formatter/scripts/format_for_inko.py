#!/usr/bin/env python3
"""
Format and validate vocabulary data for Inko bulk import.

Supports CSV and TSV formats with smart header detection and field mapping.
"""

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Inko field mappings
INKO_FIELDS = ["target", "reading", "meaning", "romanization", "example", "tags"]
REQUIRED_FIELDS = ["target", "meaning"]

# Header auto-detection patterns
HEADER_PATTERNS = {
    "target": ["target", "word", "kanji", "japanese", "front", "term", "vocabulary"],
    "reading": ["reading", "furigana", "kana", "hiragana", "katakana"],
    "meaning": [
        "meaning",
        "definition",
        "english",
        "translation",
        "back",
        "definition",
    ],
    "romanization": ["romanization", "romaji", "romanji", "hepburn"],
    "example": ["example", "sentence", "context", "usage", "example_sentence"],
    "tags": ["tags", "tag", "category", "categories", "deck", "group", "level"],
}


def detect_delimiter(text: str) -> str:
    """Detect if text uses tabs or commas as delimiter."""
    first_line = text.split("\n")[0] if text else ""
    tab_count = first_line.count("\t")
    comma_count = first_line.count(",")
    return "\t" if tab_count > comma_count else ","


def parse_csv_line(line: str) -> List[str]:
    """Parse a CSV line handling quoted values."""
    result = []
    current = ""
    in_quotes = False

    for i, char in enumerate(line):
        if char == '"':
            if in_quotes and i + 1 < len(line) and line[i + 1] == '"':
                current += '"'
            else:
                in_quotes = not in_quotes
        elif char == "," and not in_quotes:
            result.append(current.strip())
            current = ""
        else:
            current += char

    result.append(current.strip())
    return result


def parse_import_data(text: str) -> Tuple[List[str], List[List[str]]]:
    """Parse import data and detect headers."""
    delimiter = detect_delimiter(text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    if not lines:
        return [], []

    # Parse all rows
    if delimiter == "\t":
        all_rows = [line.split("\t") for line in lines]
    else:
        all_rows = [parse_csv_line(line) for line in lines]

    # Detect if first row is a header
    first_row = all_rows[0]
    header_keywords = [kw for patterns in HEADER_PATTERNS.values() for kw in patterns]
    has_header = any(
        any(keyword in cell.lower() for keyword in header_keywords)
        for cell in first_row
    )

    headers = (
        first_row if has_header else [f"Column {i + 1}" for i in range(len(first_row))]
    )
    data_rows = all_rows[1:] if has_header else all_rows

    return headers, data_rows


def auto_map_columns(headers: List[str]) -> Dict[int, str]:
    """Auto-detect column mappings based on header names."""
    mapping = {}
    lower_headers = [h.lower() for h in headers]

    for idx, header in enumerate(lower_headers):
        for field, patterns in HEADER_PATTERNS.items():
            if any(pattern in header for pattern in patterns):
                mapping[idx] = field
                break

    return mapping


def validate_row(row: List[str], mapping: Dict[int, str]) -> Tuple[bool, List[str]]:
    """Validate a single row against the mapping."""
    errors = []

    # Build field data
    field_data = {}
    for col_idx, field in mapping.items():
        if col_idx < len(row):
            field_data[field] = row[col_idx]
        else:
            field_data[field] = ""

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in field_data or not field_data[field].strip():
            errors.append(f"Missing required field: {field}")

    return len(errors) == 0, errors


def format_row(row: List[str], mapping: Dict[int, str]) -> Dict[str, str]:
    """Format a row into Inko's expected format."""
    result = {field: "" for field in INKO_FIELDS}

    for col_idx, field in mapping.items():
        if col_idx < len(row):
            result[field] = row[col_idx]

    return result


def write_output(data: List[Dict[str, str]], output_path: Path, format_type: str):
    """Write formatted data to output file."""
    if format_type == "tsv":
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, delimiter="\t")
            writer.writerow(INKO_FIELDS)
            for row in data:
                writer.writerow([row.get(field, "") for field in INKO_FIELDS])
    else:
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=INKO_FIELDS)
            writer.writeheader()
            writer.writerows(data)


def main():
    parser = argparse.ArgumentParser(
        description="Format vocabulary data for Inko bulk import"
    )
    parser.add_argument(
        "--input", "-i", required=True, help="Input file path (CSV or TSV)"
    )
    parser.add_argument("--output", "-o", help="Output file path")
    parser.add_argument(
        "--format",
        "-f",
        choices=["csv", "tsv"],
        default="csv",
        help="Output format (default: csv)",
    )
    parser.add_argument(
        "--mapping",
        "-m",
        help='Custom field mapping as JSON (e.g., \'{"Column 1": "target"}\')',
    )
    parser.add_argument(
        "--validate-only",
        "-v",
        action="store_true",
        help="Only validate, don't write output",
    )
    parser.add_argument(
        "--preview",
        "-p",
        type=int,
        default=5,
        help="Number of rows to preview (default: 5)",
    )

    args = parser.parse_args()

    # Read input
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading input file: {e}", file=sys.stderr)
        sys.exit(1)

    # Parse data
    headers, data_rows = parse_import_data(content)

    if not headers:
        print("Error: No data found in input file", file=sys.stderr)
        sys.exit(1)

    print(f"Detected {len(headers)} columns: {', '.join(headers)}")
    print(f"Found {len(data_rows)} data rows")
    print()

    # Determine mapping
    if args.mapping:
        try:
            custom_mapping = json.loads(args.mapping)
            # Convert header names to column indices
            mapping = {}
            for header, field in custom_mapping.items():
                if header in headers:
                    mapping[headers.index(header)] = field
                elif header.startswith("Column "):
                    try:
                        col_num = int(header.split()[1]) - 1
                        mapping[col_num] = field
                    except (IndexError, ValueError):
                        pass
        except json.JSONDecodeError as e:
            print(f"Error parsing mapping JSON: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        mapping = auto_map_columns(headers)

    # Show mapping
    print("Field Mapping:")
    for col_idx, field in sorted(mapping.items()):
        header = headers[col_idx] if col_idx < len(headers) else f"Column {col_idx + 1}"
        required = " (required)" if field in REQUIRED_FIELDS else ""
        print(f"  {header} -> {field}{required}")

    # Check for missing required fields
    mapped_fields = set(mapping.values())
    missing_required = [f for f in REQUIRED_FIELDS if f not in mapped_fields]
    if missing_required:
        print(f"\nWarning: Required fields not mapped: {', '.join(missing_required)}")

    print()

    # Validate rows
    valid_rows = []
    invalid_count = 0

    for i, row in enumerate(data_rows):
        is_valid, errors = validate_row(row, mapping)
        if is_valid:
            valid_rows.append(format_row(row, mapping))
        else:
            invalid_count += 1
            if i < args.preview:
                print(f"Row {i + 1} errors: {'; '.join(errors)}")

    if invalid_count > args.preview:
        print(f"... and {invalid_count - args.preview} more invalid rows")

    print(f"\nValid rows: {len(valid_rows)}")
    print(f"Invalid rows: {invalid_count}")

    # Show preview
    if valid_rows and args.preview > 0:
        print(f"\nPreview (first {min(args.preview, len(valid_rows))} rows):")
        print("-" * 80)
        for i, row in enumerate(valid_rows[: args.preview]):
            print(f"Row {i + 1}:")
            for field in INKO_FIELDS:
                if row.get(field):
                    value = (
                        row[field][:50] + "..." if len(row[field]) > 50 else row[field]
                    )
                    print(f"  {field}: {value}")
        print("-" * 80)

    # Write output
    if not args.validate_only and args.output:
        output_path = Path(args.output)
        write_output(valid_rows, output_path, args.format)
        print(f"\nWrote {len(valid_rows)} rows to {output_path}")
    elif args.validate_only:
        print("\nValidation complete (no output written)")
    else:
        print("\nNo output file specified (use --output to write)")

    # Exit with error if any rows invalid
    if invalid_count > 0:
        sys.exit(0 if args.validate_only else 0)  # Still exit 0, but report errors


if __name__ == "__main__":
    main()
