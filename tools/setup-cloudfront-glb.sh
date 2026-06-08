#!/usr/bin/env bash
#
# setup-cloudfront-glb.sh
# -----------------------
# Serves EpochEye's GLB models from CloudFront over a PRIVATE S3 bucket.
# Nothing is ever made public: the bucket blocks all public access and only
# the created CloudFront distribution can read it (via Origin Access Control).
#
# Usage:
#   ./tools/setup-cloudfront-glb.sh ./glb-models/
#
# The argument is the local folder holding your five {class_id}.glb files.
# Files are uploaded under their exact names (no renaming).
#
# Idempotent where AWS allows: re-running skips bucket creation, reuses an
# existing OAC by name, and reuses an existing distribution that already points
# at this bucket. Object uploads and the bucket policy are simply re-applied.
#
# Requires: aws CLI v2, credentials configured (aws configure), jq NOT required.

set -euo pipefail

# ----------------------------------------------------------------------------
# Config (only the bucket name / region are fixed; everything else is derived)
# ----------------------------------------------------------------------------
BUCKET="epocheye-glb-models"
REGION="ap-south-1"
OAC_NAME="epocheye-glb-oac"
ORIGIN_ID="s3-${BUCKET}"
ORIGIN_DOMAIN="${BUCKET}.s3.${REGION}.amazonaws.com"
# AWS-managed "CachingOptimized" cache policy: honors origin Cache-Control,
# long TTLs, no cookies/query/headers forwarded — ideal for immutable assets.
CACHE_POLICY_ID="658327ea-f89d-4fab-a63d-7e88639e58f6"

# ----------------------------------------------------------------------------
# 0. Pre-flight
# ----------------------------------------------------------------------------
# When the AWS CLI is the native Windows binary (e.g. run under Git Bash), it
# cannot read MSYS-style '/tmp/...' paths in a file:// arg. Translate to a
# Windows path it understands; on Linux/WSL cygpath is absent and we pass through.
to_filearg() {
  if command -v cygpath >/dev/null 2>&1; then
    printf 'file://%s' "$(cygpath -m "$1")"
  else
    printf 'file://%s' "$1"
  fi
}

if [ "$#" -lt 1 ]; then
  echo "ERROR: pass the local GLB folder as the first argument, e.g.:"
  echo "       ./tools/setup-cloudfront-glb.sh ./glb-models/"
  exit 1
fi
SRC="${1%/}"   # strip any trailing slash
if [ ! -d "$SRC" ]; then
  echo "ERROR: '$SRC' is not a directory."
  exit 1
fi

echo "==> [0/6] Verifying AWS identity..."
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "    AWS account: ${ACCOUNT_ID}"
echo "    Region:      ${REGION}"
echo "    Bucket:      ${BUCKET} (private)"

# ----------------------------------------------------------------------------
# 1. Private S3 bucket + block all public access
# ----------------------------------------------------------------------------
echo "==> [1/6] Ensuring private S3 bucket '${BUCKET}'..."
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "    Bucket already exists — skipping creation."
else
  echo "    Creating bucket in ${REGION}..."
  aws s3api create-bucket \
    --bucket "${BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration "LocationConstraint=${REGION}" >/dev/null
  echo "    Created."
fi

echo "    Enforcing block-all-public-access..."
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" >/dev/null
echo "    Public access fully blocked."

# ----------------------------------------------------------------------------
# 2. Upload the GLB files (correct Content-Type + long immutable cache)
# ----------------------------------------------------------------------------
echo "==> [2/6] Uploading *.glb from '${SRC}'..."
shopt -s nullglob
GLB_FILES=("${SRC}"/*.glb)
shopt -u nullglob
if [ "${#GLB_FILES[@]}" -eq 0 ]; then
  echo "ERROR: no .glb files found in '${SRC}'."
  exit 1
fi
if [ "${#GLB_FILES[@]}" -ne 5 ]; then
  echo "    NOTE: expected 5 files, found ${#GLB_FILES[@]} — uploading all of them anyway."
fi

FIRST_KEY=""
for f in "${GLB_FILES[@]}"; do
  key="$(basename "$f")"
  [ -z "$FIRST_KEY" ] && FIRST_KEY="$key"
  echo "    -> ${key}"
  aws s3 cp "$f" "s3://${BUCKET}/${key}" \
    --content-type "model/gltf-binary" \
    --cache-control "public, max-age=31536000, immutable" \
    --only-show-errors
done
echo "    Uploaded ${#GLB_FILES[@]} file(s)."

# ----------------------------------------------------------------------------
# 3a. Origin Access Control (reuse by name if it exists)
# ----------------------------------------------------------------------------
echo "==> [3/6] Ensuring CloudFront Origin Access Control '${OAC_NAME}'..."
OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id | [0]" \
  --output text 2>/dev/null || true)"
if [ -n "${OAC_ID}" ] && [ "${OAC_ID}" != "None" ]; then
  echo "    Reusing existing OAC: ${OAC_ID}"
else
  OAC_ID="$(aws cloudfront create-origin-access-control \
    --origin-access-control-config \
      "Name=${OAC_NAME},Description=EpochEye GLB OAC,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query "OriginAccessControl.Id" --output text)"
  echo "    Created OAC: ${OAC_ID}"
fi

# ----------------------------------------------------------------------------
# 3b. CloudFront distribution (reuse one already pointing at this bucket)
# ----------------------------------------------------------------------------
echo "==> [4/6] Ensuring CloudFront distribution for origin '${ORIGIN_DOMAIN}'..."
DIST_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?DomainName=='${ORIGIN_DOMAIN}']].Id | [0]" \
  --output text 2>/dev/null || true)"

if [ -n "${DIST_ID}" ] && [ "${DIST_ID}" != "None" ]; then
  echo "    Reusing existing distribution: ${DIST_ID}"
else
  echo "    Creating new distribution..."
  DIST_CONFIG_FILE="$(mktemp)"
  cat > "${DIST_CONFIG_FILE}" <<JSON
{
  "CallerReference": "epocheye-glb-$(date +%s)",
  "Comment": "EpochEye GLB models CDN (private S3 via OAC)",
  "Enabled": true,
  "Aliases": { "Quantity": 0 },
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "${ORIGIN_ID}",
        "DomainName": "${ORIGIN_DOMAIN}",
        "OriginPath": "",
        "CustomHeaders": { "Quantity": 0 },
        "S3OriginConfig": { "OriginAccessIdentity": "" },
        "OriginAccessControlId": "${OAC_ID}",
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": { "Enabled": false }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "${ORIGIN_ID}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": { "Quantity": 2, "Items": ["GET", "HEAD"] }
    },
    "Compress": true,
    "SmoothStreaming": false,
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "${CACHE_POLICY_ID}"
  },
  "CacheBehaviors": { "Quantity": 0 },
  "PriceClass": "PriceClass_All",
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true,
  "Restrictions": { "GeoRestriction": { "RestrictionType": "none", "Quantity": 0 } },
  "ViewerCertificate": { "CloudFrontDefaultCertificate": true },
  "WebACLId": "",
  "Logging": { "Enabled": false, "IncludeCookies": false, "Bucket": "", "Prefix": "" }
}
JSON
  DIST_ID="$(aws cloudfront create-distribution \
    --distribution-config "$(to_filearg "${DIST_CONFIG_FILE}")" \
    --query "Distribution.Id" --output text)"
  rm -f "${DIST_CONFIG_FILE}"
  echo "    Created distribution: ${DIST_ID}"
fi

DIST_DOMAIN="$(aws cloudfront get-distribution --id "${DIST_ID}" \
  --query "Distribution.DomainName" --output text)"
DIST_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"

# ----------------------------------------------------------------------------
# 4. Bucket policy: allow read ONLY from this distribution (OAC source-arn)
# ----------------------------------------------------------------------------
echo "==> [5/6] Applying private bucket policy (CloudFront-only read)..."
POLICY_FILE="$(mktemp)"
cat > "${POLICY_FILE}" <<JSON
{
  "Version": "2008-10-17",
  "Id": "PolicyForCloudFrontPrivateContent",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/*",
      "Condition": {
        "StringEquals": { "AWS:SourceArn": "${DIST_ARN}" }
      }
    }
  ]
}
JSON
aws s3api put-bucket-policy --bucket "${BUCKET}" --policy "$(to_filearg "${POLICY_FILE}")" >/dev/null
rm -f "${POLICY_FILE}"
echo "    Bucket policy applied — only ${DIST_ID} can read; nothing is public."

# ----------------------------------------------------------------------------
# 5. Output
# ----------------------------------------------------------------------------
GLB_BASE_URL="https://${DIST_DOMAIN}"
echo ""
echo "==> [6/6] DONE."
echo "============================================================"
echo " CloudFront domain : ${DIST_DOMAIN}"
echo " Distribution ID   : ${DIST_ID}"
echo ""
echo " GLB_BASE_URL (paste into epocheye/.env):"
echo ""
echo "   GLB_BASE_URL=${GLB_BASE_URL}"
echo ""
echo " The app builds model URLs as {GLB_BASE_URL}/{class_id}.glb"
echo "------------------------------------------------------------"
echo " Test (after the distribution finishes deploying):"
echo ""
echo "   curl -I ${GLB_BASE_URL}/${FIRST_KEY}"
echo ""
echo " Expect: HTTP/2 200  and  content-type: model/gltf-binary"
echo "------------------------------------------------------------"
echo " NOTE: a NEW distribution takes ~5-15 min to deploy globally."
echo "       Until 'Deployed', the CloudFront URL may return errors."
echo "       Watch status with:"
echo ""
echo "   aws cloudfront wait distribution-deployed --id ${DIST_ID}"
echo "   (returns when it's live), or check the CloudFront console."
echo "============================================================"
