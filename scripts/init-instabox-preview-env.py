#!/usr/bin/env python3
"""Create an InstaBox-only Lajur. trial .env with fresh secrets.

Runs locally, does not contact any service, and NEVER prints generated secrets
or the private preview token. Refuses to replace any existing .env.
"""
from __future__ import annotations

import os
import re
import secrets
import sys
from pathlib import Path
from urllib.parse import urlsplit


def parse_origin(value: str) -> str:
    """Accept a private InstaBox HTTPS link, but retain only its public origin."""
    try:
        parsed = urlsplit(value.strip())
        host = parsed.hostname or ""
        if (
            parsed.scheme != "https"
            or not host.endswith(".instabox.tech")
            or host.startswith(".")
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port not in (None, 443)
            or parsed.path not in ("", "/")
        ):
            raise ValueError("expected an InstaBox HTTPS preview URL")
    except ValueError as exc:
        raise ValueError("Enter a valid https://...instabox.tech preview link (optional _token query is ignored)") from exc
    return f"https://{host}"


def replace_required(text: str, key: str, value: str) -> str:
    updated, count = re.subn(
        rf"(?m)^{re.escape(key)}=[^\r\n]*$",
        lambda _: f"{key}={value}",
        text,
    )
    if count != 1:
        raise ValueError(f"Expected exactly one active {key} line in .env.example, got {count}")
    return updated


def build_trial_env(template: str, origin: str) -> str:
    for key, value in {
        "BETTER_AUTH_URL": origin,
        "AUTH_ORIGIN": origin,
        "APPLICATION_JWT_SECRET": secrets.token_hex(32),
        "APP_SESSION_ID_SECRET": secrets.token_hex(32),
        "BETTER_AUTH_SECRET": secrets.token_hex(32),
        "APPLICATION_DB_PASSWORD": secrets.token_hex(32),
    }.items():
        template = replace_required(template, key, value)
    for old, new in {
        "# HTTP_PORT=8080": "HTTP_PORT=8080",
        "# SYSTEM_MAX_SIGNUPS_ALLOWED=1": "SYSTEM_MAX_SIGNUPS_ALLOWED=0",
        "# SYSTEM_DEMO_DISABLED=true": "SYSTEM_DEMO_DISABLED=true",
    }.items():
        if template.count("\n" + old + "\n") != 1:
            raise ValueError(f"Missing or ambiguous .env.example anchor: {old}")
        template = template.replace("\n" + old + "\n", "\n" + new + "\n", 1)
    return template


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    template_path = root / "self-hosting" / ".env.example"
    target = root / "self-hosting" / ".env"
    if target.exists() or target.is_symlink():
        print("Refusing to overwrite existing self-hosting/.env.", file=sys.stderr)
        return 1
    if not template_path.is_file():
        print("Cannot find self-hosting/.env.example.", file=sys.stderr)
        return 1

    print("Paste the PRIVATE InstaBox port-8080 HTTPS preview URL.", flush=True)
    print("The _token query, if present, will NOT be written to the .env file.", flush=True)
    try:
        origin = parse_origin(input("Preview URL: "))
        contents = build_trial_env(template_path.read_text(encoding="utf-8"), origin)
    except (EOFError, KeyboardInterrupt, ValueError) as exc:
        print(f"Configuration cancelled/invalid: {type(exc).__name__}.", file=sys.stderr)
        return 1

    try:
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(contents)
    except FileExistsError:
        print("Existing .env detected; no changes made.", file=sys.stderr)
        return 1
    except OSError:
        print("Could not create .env safely; check filesystem permissions.", file=sys.stderr)
        return 1

    print("Created self-hosting/.env (mode 0600) with FOUR independent secrets.")
    print("Auth origin set to the HTTPS preview hostname; no private token was saved.")
    print("Public signups are OFF (cap=0); demo accounts are disabled.")
    print("Do not paste the file, private link or generated secrets into chat.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
