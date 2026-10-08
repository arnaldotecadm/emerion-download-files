# PRD — Emerion Release Vault (S3 Artifact Distribution Portal)

## Original Problem Statement
A React app (deployed on AWS) that reads the latest version of a folder in S3, lists its contents, and makes them available for download using AWS best practices for short-lived (presigned) download links.

## Architecture
- Frontend: React 19 + Vite + Tailwind v4 + shadcn/ui + framer-motion. Dark "Swiss tactical dev portal" theme (JetBrains Mono / Plus Jakarta Sans).
- Backend: FastAPI + boto3 (SigV4). All routes under /api.
- Storage: AWS S3 bucket `emerion-program-fles` (region eu-north-1). No database used for core flow.
- Auth: none (open access, per user choice).

## User Personas
- Internal/external user downloading the newest release artifacts of a module.

## Core Requirements (static)
- Detect the newest dated version folder per module (structure `<module>/<YYYY-MM-DD>/<files>`).
- List files with name/size/modified, excluding S3 folder-marker objects.
- Generate 15-minute (ExpiresIn=900) presigned GET URLs for secure downloads.
- Keys scoped to base prefix; reject path traversal.

## Implemented (2026-06-08)
- Backend endpoints: `/api/status`, `/api/modules`, `/api/modules/{module}?version=`, `/api/download` (presigned, ResponseContentDisposition=attachment).
- Latest-version resolution (sorted desc) — verified resolves 2026-06-01 over 2026-01-01.
- Frontend: module sidebar, latest-release banner (version dropdown, download-all, stats), artifact table with search + category filters, per-file download, secure-link modal with live 15:00 countdown + copy.
- Live AWS S3 integration verified end-to-end (real presigned download HTTP 200). Tested 100% backend + frontend.

## Re-architected to fully client-side (2026-06-08)
- Dropped backend dependency: the React app now talks to S3 directly via AWS SDK v3 + a Cognito **Identity Pool** (`eu-north-1:904ac5e6-6753-4caf-a153-94fecab60d0e`). Backend (`server.py`) left clean but unused.
- Public (guest) browse + 15-min presigned downloads with no login (guest IAM role: s3:ListBucket + GetObject).
- Cognito Hosted UI (OIDC code+PKCE via react-oidc-context) login; `cognito:groups` drives the UI.
- ADMIN-only upload: `UploadModal` writes directly to S3 (PutObject). Enforced by IAM role mapping — ADMIN group → `EmerionReleaseVault-Admin` role (adds s3:PutObject). Fixed browser SDK PutObject (checksum WHEN_REQUIRED + Uint8Array body).
- AWS provisioning (via root keys): Identity Pool + guest/auth/admin IAM roles, ADMIN group role, bucket CORS, and app-client callback/logout URLs for the preview origin.
- Verified end-to-end in-browser: guest list/download, ADMIN login, ADMIN upload (PUT 200, file appears). Latest-version dropdown tags newest as LATEST; filter pills removed (search only).
- Test ADMIN user: releasevault-admin@emerion.test / Rel3aseVault!2026 (deletable).

## Backlog / Remaining
- P1: Per-tenant/prefix auth before production (IAM role on AWS compute instead of access keys).
- P2: "Download All" as a server-zipped bundle.
- P2: Checksum verification / copy-checksum per file.
- P2: Multi-module once more modules (EFatura, etc.) are added.

## Next Tasks
- Harden IAM to least-privilege role at deploy time; remove long-lived keys.

## Delete + Upload-guard + README (2026-06-08)
- Delete (ADMIN): per-file delete button and "Delete version" (removes all files incl. folder marker) with AlertDialog confirm. Added `s3:DeleteObject` to admin IAM role and `DELETE` to bucket CORS. api: `deleteKey`, `deleteVersion`.
- Overwrite guard: UploadModal checks module/version contents (`listVersionFiles`) and warns "already contains N file(s)" + lists filename collisions.
- Free-text version with next-minor suggestion; drag-and-drop + per-file progress bars (presigned PUT + XHR).
- New module creation from upload dialog; optional summary saved as `README.md` inside `module/version/` (no DB, not editable).
- All verified in-browser end-to-end (create module+README, overwrite warning, delete file, delete version). Test data cleaned from bucket.
- Optional auth layer if access must be restricted.
