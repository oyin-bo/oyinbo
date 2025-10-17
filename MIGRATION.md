# Migration from serve.js to new implementation

## What changed

The new implementation (`js/cli.js` + modules) is a complete rewrite following the spec precisely:

### Old (serve.js)
- Single monolithic file (~800 lines)
- Complex state management
- Mixed concerns
- Single `debug.md` file for everything

### New (js/*.js)
- 9 focused modules (~400 lines total)
- Minimal state tracking
- Clear separation of concerns
- Per-instance `debug/*.md` files as per spec

## Running the new version

```bash
node js/cli.js
```

## Key differences

1. **Per-instance files**: Each browser tab gets its own `debug/<name>.md` file
2. **Simpler state**: One job per page at a time
3. **Clean modules**: Easy to test and understand
4. **Spec compliant**: Follows 1-jsrepl.md exactly

## File structure

```
debug.md                    # Master registry
debug/
  index-7-zen-a1b2c3.md    # Per-instance logs
  12-nova-x9y8z7.md
```

## Migration path

1. Stop old `serve.js` if running
2. Run `node js/cli.js`
3. Old `debug.md` won't be used (new one auto-created)
4. Per-instance files created on first page connection

## What to delete eventually

- `serve.js` (legacy, replaced by `js/*.js`)
