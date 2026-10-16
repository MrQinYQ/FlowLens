---
name: flowlens
description: Use when users want a locally runnable product prototype and interaction flow canvas from requirements, JSON, or existing prototype images, including draggable and zoomable pages, clickable transitions, hotspots, and interaction details. Not for production business backends or Figma editing.
---

# FlowLens

Use the bundled viewer to turn readable requirements into a local interactive prototype. Keep application code in `assets/viewer` unchanged; write business data in a separate generated workspace.

## Start a workspace

Resolve the skill directory from this loaded `SKILL.md`, never from a remembered machine path. Read [data-format.md](references/data-format.md) when producing or updating JSON or image hotspots.

```sh
python3 "<skill-dir>/scripts/flowlens.py" init --output "<workspace>/prototype" --data "<project.json>"
python3 "<skill-dir>/scripts/flowlens.py" serve --project "<workspace>/prototype" --port 4173
```

Omit `--data` for a working demo. For a screenshot folder, add `--assets "<image-dir>"`; reference the copied images as `./assets/name.png`. `init` requires a new or empty directory. Existing workspaces are updated by editing their project JSON and image files, not by reinitializing or overwriting the installed skill. Windows can use `py -3` instead of `python3`.

The server prints `FLOWLENS_URL=` with its actual loopback address; occupied ports are skipped. Keep the process running while presenting the preview and open that exact URL with the host's browser tool. Python 3.9+ is enough to view. Node.js 20+ enables full schema validation:

```sh
python3 "<skill-dir>/scripts/flowlens.py" validate "<workspace>/prototype/project.json"
```

## Populate and verify

Map source roles, screens, actions, branches and feedback into v1 data. Label assumptions and demonstration content. If requirements are unavailable, request readable content; a generic sample does not establish product requirements. Conditions and rules are explanatory text; only configured required fields and transitions execute.

After changes, validate JSON and check the relevant page, transition or hotspot in the browser. Report the preview URL, workspace path and any unverified source content. The viewer switches datasets but has no persistent project library, shared backend or automatic saving of demonstration form state. Data stays local except explicitly configured remote images.
