# Monitoring and Rollback Baseline

## Deploy Observability

Every deployment writes machine-readable manifests:

1. `velox-manifest.json` (build artifact inventory)
2. `velox-deploy.json` (local deployment record)
3. `velox-cloud-deploy.json` (cloud bundle deployment record)

## Operational Logging

1. Keep deploy command output logs in CI artifacts.
2. Store the deployment manifest with each release tag.

## Rollback Procedure

1. Choose last known-good deployment from manifest history.
2. Re-publish that deployment directory.
3. Verify homepage + primary route + API route integration checks.

