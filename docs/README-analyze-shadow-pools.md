# Shadow Pool Analysis Script

This script analyzes Shadow (RamsesV3) pools to extract detailed information about each pool.

## Usage

```bash
npx hardhat run scripts/analyze-shadow-pools.ts --network <network-name>
```

Example:
```bash
npx hardhat run scripts/analyze-shadow-pools.ts --network sonic-mainnet
```

## Input

The script automatically finds and processes all CSV files matching the pattern:
`research/export-internal-transactions-*.csv`

These CSV files should contain Shadow pool deployment transactions with pool addresses in the "To" column. The script will:
- Process all matching CSV files in the research directory
- Automatically deduplicate pool addresses that appear in multiple files
- Skip invalid or zero addresses

## Output

The script generates a new CSV file in the research directory with the following information for each pool:

- **Pool Address**: The RamsesV3Pool contract address
- **Token0 Address**: Address of the first token in the pair
- **Token0 Symbol**: Symbol of the first token
- **Token0 Balance**: Current balance of token0 in the pool
- **Token1 Address**: Address of the second token in the pair
- **Token1 Symbol**: Symbol of the second token
- **Token1 Balance**: Current balance of token1 in the pool
- **Current Liquidity**: The in-range liquidity at the current price
- **Fee Tier**: The pool's fee percentage (e.g., 0.05%, 0.3%, 1%)
- **Current Tick**: The current tick of the pool
- **Sqrt Price X96**: The current price encoded as sqrt(token1/token0) * 2^96

Output file: `research/shadow-pools-analysis-{timestamp}.csv`

## Features

- **Multi-file processing**: Automatically finds and processes all export-internal-transactions-*.csv files
- **Deduplication**: Automatically removes duplicate pool addresses across multiple CSV files
- **Progress tracking**: Shows progress as "[current/total]" during analysis
- **Robust token symbol detection**: Handles both string and bytes32 return types
- **Error handling**: Continues processing even if individual pools or CSV files fail
- **Summary statistics**: Shows:
  - CSV file processing statistics
  - Total unique pools found vs analyzed
  - Success/failure counts
  - Token pair distribution
  - Fee tier breakdown
- **Balance queries**: Gets actual token balances held by each pool
- **Checksummed addresses**: Uses proper Ethereum address checksums for consistency

## Notes

- The script uses fallback mechanisms for tokens that don't properly implement the ERC20 symbol() function
- Balances are returned as raw values (not formatted with decimals)
- Failed pools are logged but don't stop the analysis of other pools
- Invalid addresses are automatically skipped during processing
- The script provides compact output during batch processing to reduce console clutter