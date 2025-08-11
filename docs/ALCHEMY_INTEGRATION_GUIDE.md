# 🔗 Alchemy Integration Guide for Sonic Blockchain

## 🎯 Why Use Alchemy for Sonic?

### ✅ **Benefits of Alchemy RPC**
1. **Enhanced Reliability** - 99.9% uptime SLA
2. **Better Performance** - Optimized node infrastructure
3. **Advanced Analytics** - Dashboard with request metrics, error tracking
4. **Rate Limiting Protection** - Higher throughput than public endpoints
5. **Developer Tools** - Built-in debugging and monitoring
6. **Enterprise Support** - Up to $5k in credits for Sonic projects

### 🆚 **Alchemy vs Public RPC Comparison**

| Feature | Public RPC | Alchemy RPC |
|---------|------------|-------------|
| Cost | Free | Free tier + paid plans |
| Rate Limits | Shared limits | Dedicated limits |
| Reliability | Basic | 99.9% SLA |
| Analytics | None | Comprehensive dashboard |
| Support | Community | Enterprise support |
| Performance | Variable | Optimized |

## 🛠️ **Setup Instructions**

### Step 1: Create Alchemy Account
1. Go to [dashboard.alchemy.com](https://dashboard.alchemy.com)
2. Sign up for free account
3. Complete email verification

### Step 2: Create Sonic App
1. Click "Create New App" in dashboard
2. Fill out app details:
   ```
   Name: Arca Vault Sonic
   Description: DeFi vault system for Sonic blockchain
   Chain: Sonic
   Network: Mainnet (or Testnet if available)
   ```
3. Click "Create App"

### Step 3: Get API Credentials
1. Click on your new app
2. Click "View Key" button
3. Copy the **API Key** (not the URL)
4. Save this key securely

### Step 4: Configure Environment
1. Edit your `.env` file:
   ```bash
   # Add your Alchemy API key
   ALCHEMY_API_KEY=your_actual_api_key_here
   
   # Optional: Use Alchemy RPC URLs (uncomment these)
   # SONIC_TESTNET_RPC_URL=https://sonic-testnet.g.alchemy.com/v2/your_actual_api_key_here
   # SONIC_MAINNET_RPC_URL=https://sonic-mainnet.g.alchemy.com/v2/your_actual_api_key_here
   ```

## 🚀 **Deployment Commands with Alchemy**


### Using Alchemy for Mainnet
```bash
# Deploy using Alchemy mainnet endpoint  
npm run deploy:mainnet:alchemy

# Verify deployment
npm run deploy:verify:mainnet:alchemy
```

### Fallback to Public RPC
```bash
# This command uses public RPC (fallback if Alchemy fails)
npm run deploy:mainnet
```

## 📊 **Monitoring & Analytics**

### Alchemy Dashboard Features
Once you start using Alchemy, you can monitor:

1. **Request Analytics**
   - Total requests per day/hour
   - Response times
   - Error rates
   - Method usage breakdown

2. **Performance Metrics**
   - Average response time
   - 99th percentile latency
   - Throughput (requests/second)
   - Error distribution

3. **Usage Tracking**
   - Requests remaining in your plan
   - Bandwidth usage
   - Cost projection

### Key Metrics to Monitor
- **Deployment Success Rate** - Track failed deployments
- **Contract Interaction Latency** - Monitor rebalance operation speed
- **Error Patterns** - Identify network issues early
- **Gas Usage Trends** - Optimize transaction costs

## 🛡️ **Best Practices**

### Security
```bash
# Never commit API keys to git
echo ".env" >> .gitignore

# Use environment variables in production
export ALCHEMY_API_KEY="your_key_here"

# Rotate API keys regularly
# Create separate keys for development/production
```

### Performance Optimization
```javascript
// Configure proper timeouts in hardhat.config.ts
networks: {
  "sonic-testnet-alchemy": {
    timeout: 120000, // 2 minutes
    httpHeaders: {
      "User-Agent": "Arca-Vault/1.0"
    }
  }
}
```

### Error Handling
```javascript
// Implement retry logic for network requests
const maxRetries = 3;
let attempt = 0;

while (attempt < maxRetries) {
  try {
    await vault.rebalance(params);
    break;
  } catch (error) {
    if (attempt === maxRetries - 1) throw error;
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempt++;
  }
}
```

## 🔧 **Troubleshooting**

### Common Issues & Solutions

**"API key not found"**
```bash
# Check your .env file
cat .env | grep ALCHEMY_API_KEY

# Ensure no spaces around the = sign
ALCHEMY_API_KEY=abc123def456  # ✅ Correct
ALCHEMY_API_KEY = abc123def456  # ❌ Wrong
```

**"Request timeout"**
```bash
# Increase timeout in hardhat.config.ts
timeout: 300000  # 5 minutes for large deployments
```

**"Rate limit exceeded"**
```bash
# Check your Alchemy dashboard for usage
# Consider upgrading to paid plan
# Implement request batching
```

**"Network unreachable"**
```bash
# Test connectivity
curl -X POST https://sonic-mainnet.g.alchemy.com/v2/YOUR_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Should return current block number
```

### Debug Commands
```bash
# Test Alchemy connection
npx hardhat console --network sonic-testnet-alchemy
> const blockNumber = await ethers.provider.getBlockNumber()
> console.log("Current block:", blockNumber)

# Compare performance
time npm run deploy:testnet        # Public RPC
time npm run deploy:testnet:alchemy # Alchemy RPC
```

## 💰 **Cost Considerations**

### Free Tier Limits
- **Compute Units**: 300M/month (generous for most projects)
- **Requests**: ~30M basic requests/month
- **Archive Data**: Limited access

### When to Upgrade
Consider paid plans if you experience:
- Rate limiting during peak usage
- Need for archive node access
- Require guaranteed SLA
- Want priority support

### Cost Optimization Tips
```javascript
// Batch requests when possible
const [block, balance, nonce] = await Promise.all([
  provider.getBlock('latest'),
  provider.getBalance(address),
  provider.getTransactionCount(address)
]);

// Use caching for repeated calls
const cache = new Map();
const cachedGetBlock = async (blockNumber) => {
  if (cache.has(blockNumber)) return cache.get(blockNumber);
  const block = await provider.getBlock(blockNumber);
  cache.set(blockNumber, block);
  return block;
};
```

## 🎯 **Integration Testing with Alchemy**

### Test Alchemy Connection
```bash
# Create a simple test script
cat > test-alchemy.js << 'EOF'
const { ethers } = require("hardhat");

async function testAlchemy() {
  console.log("Testing Alchemy connection...");
  const blockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block number:", blockNumber);
  
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  
  console.log("✅ Alchemy connection successful!");
}

testAlchemy().catch(console.error);
EOF

# Run test
npx hardhat run test-alchemy.js --network sonic-mainnet-alchemy
```

### Performance Comparison
```bash
# Benchmark deployment times
echo "Testing public RPC..."
time npm run deploy:mainnet > public_deploy.log 2>&1

echo "Testing Alchemy RPC..."  
time npm run deploy:mainnet:alchemy > alchemy_deploy.log 2>&1

# Compare results
echo "Public RPC deployment time:" && grep "real" public_deploy.log
echo "Alchemy RPC deployment time:" && grep "real" alchemy_deploy.log
```

## 📚 **Additional Resources**

### Alchemy Documentation
- [Sonic API Reference](https://docs.alchemy.com/reference/sonic-api-endpoints)
- [Alchemy Dashboard](https://dashboard.alchemy.com)
- [SDK Documentation](https://github.com/alchemyplatform/alchemy-sdk-js)

### Sonic Resources
- [Official Sonic Docs](https://docs.soniclabs.com)
- [Sonic Explorer](https://sonicscan.org)
- [Community Discord](https://discord.gg/sonic)

### Support Channels
- **Alchemy Support**: [support.alchemy.com](https://support.alchemy.com)
- **Sonic Community**: [Discord](https://discord.gg/sonic) 
- **GitHub Issues**: [Our repository issues](https://github.com/your-repo/issues)

---

**Quick Start**: Get API key → Add to `.env` → Run `npm run deploy:mainnet:alchemy`

**Status**: ✅ Ready for use with Sonic blockchain  
**Last Updated**: December 2024