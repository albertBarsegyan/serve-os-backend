#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# minio-init.sh — Create bucket, set access policies, configure lifecycle.
#
# Usage:
#   ./scripts/minio-init.sh [ENDPOINT] [ACCESS_KEY] [SECRET_KEY] [BUCKET]
#
# Defaults (all overridable via args or env vars):
#   ENDPOINT    http://localhost:9000
#   ACCESS_KEY  minioadmin
#   SECRET_KEY  minioadmin
#   BUCKET      serve-os-dev
#
# Requires: mc (MinIO Client) — https://min.io/docs/minio/linux/reference/minio-mc.html
# ---------------------------------------------------------------------------
set -e

ENDPOINT="${1:-${S3_ENDPOINT:-http://localhost:9000}}"
ACCESS_KEY="${2:-${S3_ACCESS_KEY:-minioadmin}}"
SECRET_KEY="${3:-${S3_SECRET_KEY:-minioadmin}}"
BUCKET="${4:-${S3_BUCKET:-serve-os-dev}}"

ALIAS="serve-os-init-$$"

echo "→ Connecting to MinIO at $ENDPOINT (bucket: $BUCKET)"
mc alias set "$ALIAS" "$ENDPOINT" "$ACCESS_KEY" "$SECRET_KEY" --quiet

# ── 1. Create bucket ───────────────────────────────────────────────────────
echo "→ Creating bucket '$BUCKET' (if not exists)"
mc mb --ignore-existing "$ALIAS/$BUCKET"

# ── 2. Bucket policy: public read on public/* only ────────────────────────
echo "→ Setting public-read policy on $BUCKET/public/*"
POLICY_FILE=$(mktemp /tmp/serve-os-bucket-policy.XXXXXX.json)
cat > "$POLICY_FILE" << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::${BUCKET}/public/*"]
    }
  ]
}
EOF
mc anonymous set-json "$POLICY_FILE" "$ALIAS/$BUCKET"
rm -f "$POLICY_FILE"

# ── 3. Lifecycle: auto-delete temp/ after 24 hours ────────────────────────
echo "→ Adding lifecycle rule: delete temp/* after 1 day"
mc ilm rule add --expire-days 1 --prefix "temp/" "$ALIAS/$BUCKET"

echo "✓ MinIO bucket '$BUCKET' ready."
mc alias remove "$ALIAS" --quiet
