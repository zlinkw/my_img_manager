# Recovery

- Source discovery path: `C:\Users\ZLK\Documents\Codex\2026-07-06\ui-3-ui-plan-agent-agent`
- Migration time: `2026-07-07T01:18:23.4946207+08:00`
- Original `.git` found: yes
- Migration command: `git clone "C:\Users\ZLK\Documents\Codex\2026-07-06\ui-3-ui-plan-agent-agent" "D:\GitRepo\my_img_manager"`
- Excluded by git clone/gitignore: `node_modules/`, `work/`, `outputs/*.xpi`, `outputs/*.zip`, `outputs/*.sha256`, `dist/`, `build/`, `*.xpi`, `*.zip`, `*.log`, `.DS_Store`, `Thumbs.db`, `zotero.sqlite`, `*.sqlite`
- Not copied: ignored build/package outputs and dependency directories.
- Safety notes: source directory was copied by clone, not moved; no Zotero database, cache directory, Zotero application unpack directory, `node_modules`, or temp build output was used as source.