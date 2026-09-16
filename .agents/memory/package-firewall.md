---
name: Frontend package firewall
description: Replit package firewall behavior when a frontend lockfile references a blocked vulnerable release.
---

When Replit’s package firewall blocks a locked frontend tarball for a critical CVE, update that direct dependency to the latest compatible safe release rather than bypassing the firewall.

**Why:** A locked vulnerable tarball can prevent both clean installs and build verification even when the application code is unrelated to the vulnerability.

**How to apply:** Check the current package release, update the direct dependency and lockfile together, then rerun the install and production build.