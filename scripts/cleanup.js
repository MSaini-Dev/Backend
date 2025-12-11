#!/usr/bin/env node

const { cleanupOldFiles } = require('../utils/cleanup');

console.log('Running manual cleanup...');
cleanupOldFiles();
console.log('Cleanup complete!');
