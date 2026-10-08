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
- Demo: 5 sample files uploaded to `EComercial/2026-06-01/` (removable).

## Backlog / Remaining
- P1: Per-tenant/prefix auth before production (IAM role on AWS compute instead of access keys).
- P2: "Download All" as a server-zipped bundle.
- P2: Checksum verification / copy-checksum per file.
- P2: Multi-module once more modules (EFatura, etc.) are added.

## Next Tasks
- Harden IAM to least-privilege role at deploy time; remove long-lived keys.
- Optional auth layer if access must be restricted.
