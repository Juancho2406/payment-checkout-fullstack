#!/usr/bin/env python3
import json
import os
import subprocess
import sys

for key in ("PSP_BASE_URL", "PSP_PRIVATE_KEY", "PSP_INTEGRITY_SECRET"):
    if not os.environ.get(key):
        sys.exit(f"missing GitHub secret {key}")

payload = json.dumps(
    {
        "PSP_BASE_URL": os.environ["PSP_BASE_URL"],
        "PSP_PRIVATE_KEY": os.environ["PSP_PRIVATE_KEY"],
        "PSP_INTEGRITY_SECRET": os.environ["PSP_INTEGRITY_SECRET"],
    }
)
name = "checkout/psp"
exists = subprocess.run(
    ["aws", "secretsmanager", "describe-secret", "--secret-id", name],
    capture_output=True,
)
if exists.returncode == 0:
    cmd = [
        "aws",
        "secretsmanager",
        "put-secret-value",
        "--secret-id",
        name,
        "--secret-string",
        payload,
    ]
else:
    cmd = [
        "aws",
        "secretsmanager",
        "create-secret",
        "--name",
        name,
        "--secret-string",
        payload,
    ]
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    sys.stderr.write(result.stderr)
    sys.exit(result.returncode)
print("PSP secret upserted (value not printed)")
