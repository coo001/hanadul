#!/usr/bin/env node
import { readSino } from '../src/sino.js';

const arg = process.argv[2];
if (arg === undefined || !/^\d+$/.test(arg)) {
  console.error('Usage: hanadul <integer from 0 to 9999>');
  process.exit(2);
}
// Quote the text as typed. Converting first would drop leading zeros and
// turn a 20-digit input into a different number in the message.
if (!/^(0|[1-9]\d{0,3})$/.test(arg)) {
  console.error(`hanadul reads integers from 0 to 9999 written without leading zeros, got "${arg}"`);
  process.exit(1);
}
console.log(readSino(Number(arg)));
