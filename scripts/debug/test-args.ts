// Test script to verify argument passing
console.log("process.argv:", process.argv);
console.log("Args after slice(2):", process.argv.slice(2));

const args = process.argv.slice(2);
const resumeIndex = args.indexOf("--resume");
const vaultsIndex = args.indexOf("--vaults");

console.log("resumeIndex:", resumeIndex);
console.log("vaultsIndex:", vaultsIndex);
console.log("resume flag present:", resumeIndex !== -1);

if (vaultsIndex !== -1 && args[vaultsIndex + 1]) {
  console.log("vaults:", args[vaultsIndex + 1]);
}