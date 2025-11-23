const fs = require('fs');

// Read the ABI file
const content = fs.readFileSync('./abi/MetroVault.abi.ts', 'utf8');

// Extract the ABI array
const abiMatch = content.match(/export const METRO_VAULT_ABI = (\[.*\]);/s);
if (abiMatch) {
  const abi = JSON.parse(abiMatch[1]);
  
  // Find all function names
  const functions = abi
    .filter(item => item.type === 'function')
    .map(item => item.name)
    .sort();
  
  console.log('Available functions in MetroVault ABI:');
  functions.forEach(name => console.log(`- ${name}`));
  
  // Look for specific functions we're trying to use
  const targetFunctions = ['getPendingRewards', 'getQueuedWithdrawal', 'getCurrentRound', 'getRedeemableAmounts'];
  console.log('\nChecking target functions:');
  targetFunctions.forEach(target => {
    const found = functions.find(name => name.toLowerCase().includes(target.toLowerCase()));
    console.log(`${target}: ${found || 'NOT FOUND'}`);
  });
} else {
  console.log('Could not parse ABI');
}
