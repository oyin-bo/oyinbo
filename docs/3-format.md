# Daebug Format Enhancement — Rich Context Templates

## Purpose and Agent Benefits

The daebug.md manifest and individual REPL log files currently contain raw session data but lack contextual explanation. **Without rich explanatory content**, agents and users must rely on external documentation to understand what they're looking at and how to interact with the system.

**With format enhancement**, the files become self-documenting:
- **Immediate orientation**: Opening daebug.md explains what daebug is and how to use it
- **Session lifecycle clarity**: Active vs shutdown states are explicitly communicated
- **Navigation helpers**: Each file provides clear pathways to related content
- **Reduced cognitive load**: No need to consult external docs to understand the format

---

## Proposed Format Structure

### Main Index (daebug.md) — Active State

```
# Title (including start time)
Subtitle
Short mission statement

<list of references to daebug REPL pages>

3-5 paragraph explainer:
- What daebug is and its purpose
- How to navigate and use debugging sessions
- Key features and workflow patterns
```

### Main Index (daebug.md) — Shutdown State

When session exits:
- Title updated to indicate shutdown and shutdown time
- List of REPL pages replaced with extended shutdown message
- Message includes restart instructions and session preservation notes

### REPL Log Pages

Individual daebug REPL log files enriched with:
- Session context header
- Timestamp and metadata
- Navigation links back to main index

---

## Implementation Approach

### Template as Function

Templates defined as separate files containing functions that return template strings. The template file is mostly just the templated string literal with minimal function wrapper, making it easy to edit prose content.

```javascript
// templates/daebug-index.js
export function activeIndex({ title, startTime, subtitle, mission, replPages }) {
  return `# ${title} - Started ${startTime}
${subtitle}
${mission}

${replPages}

[3-5 paragraph explainer text here...]
`;
}

export function shutdownIndex({ title, times, summary }) {
  return `# ${title} - Completed
${times}

${summary}

[Extended shutdown message and restart instructions...]
`;
}
```

### Integration Points

- Writer module imports and invokes templates with current session state
- Templates called at session start, session end, and REPL logging
- Parameters extracted from registry and passed to template functions

### File Organization

```
templates/
  daebug-index.js       # Main index templates (active/shutdown)
  daebug-repl.js        # REPL page templates
```

---

## Benefits

- **Self-documenting files**: Each file explains itself
- **Easy prose editing**: Template strings are straightforward to modify
- **Consistent UX**: All sessions follow same helpful format
- **State awareness**: Clear distinction between active and completed sessions
