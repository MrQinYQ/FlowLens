# FlowLens reusable distribution

User scope: extract the existing viewer into Documents/GitHub/flowlens, ship a self-contained skill, installation guide and copyable installation prompt. Keep project switching at its existing level; do not add a persistent multi-project library.

## Packaging contract

- The only maintained runtime is `skills/flowlens/assets/viewer`; installed copies contain all HTML, JS, CSS, examples and server code.
- `skills/flowlens/scripts/flowlens.py` provides init / serve / validate. Init creates a separate writable work directory, reads an optional JSON and asset folder, and configures the initial project without editing viewer code.
- Python 3.9+ and a modern browser suffice for viewing. Node.js 20+ is used for full schema validation and the engine tests. No npm/pip install, CDN, API key, external service or original ad-dsp checkout is required.
- Serve binds only 127.0.0.1, prints its actual URL, tries another port if occupied, blocks hidden files and paths resolving outside the project. It does not kill unrelated servers.
- The skill is installed by copying into `~/.agents/skills/flowlens` (current official Codex user skill location). Existing installs are not overwritten without --update; managed updates back up the old directory outside skill discovery paths.
- Installable zip contains the same self-contained skill, including its own installer. Repository source and installation archives are local outputs; no remote repository publication is authorized.
- Generic instructions distinguish requirements from examples and never invent content when a source cannot be read. Agent writes project JSON and assets in the generated directory, validates, serves and returns a browser preview.

## Verification

Existing 29 engine tests; new CLI tests for output creation, independent installed runtime, malformed inputs, overwrite protection, updates/backups and packaging; loopback integration tests for serving, port fallback and file boundaries; skill frontmatter validator; independent installed-skill use in a temporary workspace; browser check of the installed runtime.
