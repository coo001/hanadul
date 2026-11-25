#!/usr/bin/env node
import { readSino } from '../src/sino.js';

const arg = process.argv[2];
if (arg === undefined || !/^\d+$/.test(arg)) {
  console.error('Usage: hanadul <integer from 0 to 9999>');
  process.exit(2);
}
try {
  console.log(readSino(Number(arg)));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
