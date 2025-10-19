#!/usr/bin/env node
// @ts-check
import { run } from './js/cli.js';

run().catch(err => {
  console.error('[oyinbo] error:', err.message);
  process.exit(1);
});
