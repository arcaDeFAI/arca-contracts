# arca-contracts
## Setup
Open the folder in VS Code, and select "Reopen in Container".  
For a first time setup, you will need to run `git submodule update --init --recursive` to clone the required joe-v2 library.

# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

