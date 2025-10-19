#!/usr/bin/env node
// @ts-check
import { run } from './js/cli.js';

run().catch(err => {
  console.error('👾 error:', err.message);
  process.exit(1);
});
