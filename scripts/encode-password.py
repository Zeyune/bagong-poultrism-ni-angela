#!/usr/bin/env python3
"""Percent-encode a database password for use inside a connection URL.

    python scripts/encode-password.py            # copies to clipboard
    python scripts/encode-password.py --print    # prints instead

Why this exists: an unencoded reserved character in the password truncates the
URL at the parser, and Postgres reports it as "password authentication failed"
— indistinguishable from a genuinely wrong password. See CHANGELOG 2026-07-21.

What this script deliberately does NOT do:
  • no file writes, no logging, no network calls, no imports beyond the stdlib
  • does not accept the password as an argument — argv would land in your shell
    history. It is read with getpass, which does not echo and is not recorded.
  • does not print the input, only the encoded output

Honest limits — this reduces exposure, it does not eliminate it:
  • --print puts the result in terminal scrollback, where it stays.
  • the clipboard holds it until something else overwrites it, and any app can
    read the clipboard.
  • Python strings are immutable and garbage-collected; the value cannot be
    reliably wiped from memory. Do not treat this as a secrets manager.
"""

import sys
from getpass import getpass
from urllib.parse import quote

def main() -> int:
    want_print = "--print" in sys.argv

    # safe="" so that EVERY reserved character is encoded. The default safe="/"
    # would leave a slash intact, which is exactly one of the characters that
    # breaks a connection URL.
    raw = getpass("Password (not echoed): ")
    if not raw:
        print("Nothing entered.", file=sys.stderr)
        return 1

    encoded = quote(raw, safe="")

    if encoded == raw:
        print("\nNo encoding needed — this password contains no reserved characters.")
        print("Paste it into the URL as-is.")
        return 0

    if want_print:
        print(f"\nEncoded:\n{encoded}\n")
        print("⚠️  This is now in your terminal scrollback.")
        return 0

    try:
        import tkinter
        root = tkinter.Tk()
        root.withdraw()
        root.clipboard_clear()
        root.clipboard_append(encoded)
        root.update()  # required, or the clipboard empties when Tk exits
        root.destroy()
    except Exception as exc:  # tkinter missing or no display
        print(f"\nClipboard unavailable ({exc}).", file=sys.stderr)
        print("Re-run with --print to output it instead.", file=sys.stderr)
        return 1

    changed = sum(1 for a, b in zip(raw, encoded) if a != b)
    print(f"\n✓ Copied to clipboard ({len(raw)} chars in, {len(encoded)} out).")
    print("  Paste into the password position of BOTH DATABASE_URL and DIRECT_URL,")
    print("  then run:  npm run check:env .env.cloud --connect")
    print("\n  The clipboard keeps this until you copy something else.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
