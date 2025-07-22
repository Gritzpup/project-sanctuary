#!/usr/bin/env node

/**
 * Strategy Restore Script
 * 
 * Usage: node restore-strategy.js [strategy-name]
 * Example: node restore-strategy.js grid-trading-v1
 */

const fs = require('fs');
const path = require('path');

const strategyName = process.argv[2];

if (!strategyName) {
  console.log('Usage: node restore-strategy.js [strategy-name]');
  console.log('Available strategies:');
  
  const workingDir = path.join(__dirname, 'working');
  const files = fs.readdirSync(workingDir);
  const paramFiles = files.filter(f => f.endsWith('-params.json'));
  
  paramFiles.forEach(file => {
    const data = JSON.parse(fs.readFileSync(path.join(workingDir, file), 'utf8'));
    console.log(`  - ${file.replace('-params.json', '')} (${data.status})`);
  });
  
  process.exit(1);
}

const paramsFile = path.join(__dirname, 'working', `${strategyName}-params.json`);

if (!fs.existsSync(paramsFile)) {
  console.error(`Strategy "${strategyName}" not found!`);
  process.exit(1);
}

const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));

console.log(`\nRestoring strategy: ${params.strategyName}`);
console.log(`Status: ${params.status}`);
console.log(`Date: ${params.date}`);
console.log(`Commit: ${params.commit}`);

console.log('\n📋 Default Parameters:');
console.log(JSON.stringify(params.defaultParams, null, 2));

console.log('\n📦 Presets:');
Object.entries(params.presets).forEach(([key, preset]) => {
  console.log(`\n${preset.name}:`);
  delete preset.name;
  console.log(JSON.stringify(preset, null, 2));
});

console.log('\n⚠️  Critical Notes:');
Object.entries(params.criticalFixes).forEach(([key, value]) => {
  console.log(`- ${key}: ${value}`);
});

console.log('\n✅ To apply these parameters:');
console.log('1. Copy the parameters above');
console.log('2. Update strategyParams in Backtesting.svelte');
console.log('3. Or restore the TypeScript file from backup');
console.log(`   File: working/${strategyName}.ts`);