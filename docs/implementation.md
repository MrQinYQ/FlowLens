# Distribution implementation

- [x] Prepare the canonical skill runtime from the tested engine; replace hardcoded initial data with viewer.config.json.
- [x] Write and observe failing CLI / installation tests.
- [x] Implement dependency-free init, validate, local server, installer and zip builder.
- [x] Write a compact skill with schema reference and runnable instructions; generate UI metadata.
- [x] Write README, installation guide and installation prompt with no invented repository URL or old absolute paths.
- [x] Validate engine tests, distribution tests, real server and installed payload independently.
- [x] Move the completed project to Documents/GitHub/flowlens; install the validated skill for this user; verify that installed code runs independently.

Baseline: a read-only independent agent found that the original bundle requires manual copying, entrypoint changes, fixed-port npm startup and guessing image paths. The skill and CLI must remove those gaps without rewriting the viewer.
