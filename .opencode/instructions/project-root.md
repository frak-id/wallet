# Project Root (Absolute Path)

**The absolute path to this project on the current developer's machine is:**

```
{env:PWD}
```

## Rules

- Always use `{env:PWD}` (resolved above) as the project root when constructing absolute paths.
- NEVER guess or hallucinate absolute paths (e.g. `/Users/<someone>/...`, `/home/<someone>/...`). Paths from prior sessions or other developers are not valid here.
- Prefer relative paths from the project root whenever possible. Use absolute paths only when a tool explicitly requires them.
- If a tool returns "file not found" for an absolute path, re-check against the root above before retrying.
