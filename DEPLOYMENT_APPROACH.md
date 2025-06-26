# 🚀 Arca Deployment Approach

## **Two-Tier Testing Strategy**

This project uses a streamlined **two-tier approach** for deployment and testing:

### **Tier 1: Local Development** 🏠
- **Localhost testing** with mocks for rapid development
- **Mainnet fork testing** with real Metropolis contracts via Alchemy
- Zero cost, safe experimentation environment

### **Tier 2: Production** 🌐  
- **Direct mainnet deployment** via Alchemy for production readiness
- Real value, real contracts, real liquidity

## **Why We Skip Sonic Testnet** ❌

**Testnet Limitation**: Sonic testnet (Blaze) **does not have Metropolis DLMM contracts deployed**. This creates a fundamental blocker:

- ✅ **Mainnet**: Full Metropolis ecosystem (router, factory, pools, tokens)
- ❌ **Testnet**: Missing critical DeFi infrastructure

### **Business Impact**
Testing on testnet would require:
1. **Mock contracts** for Metropolis (defeating the purpose of testnet)
2. **Different addresses** than production
3. **Separate test configurations** that don't match mainnet
4. **Additional complexity** without production accuracy

### **Solution: Mainnet Fork**
Instead of testnet, we use **mainnet forks** which provide:
- ✅ **Real contracts** and liquidity
- ✅ **Zero cost** testing
- ✅ **Production accuracy** 
- ✅ **Real token balances** for comprehensive testing

## **Deployment Flow**

```
Development → Localhost Testing → Mainnet Fork → Mainnet Deployment
     ↓              ↓                 ↓               ↓
   Mocks         Mocks           Real DeFi        Production
   Fast          Fast            Safe Test        Live System
```

## **Technical Benefits**

1. **Reduced Complexity**: Two environments instead of three
2. **Production Accuracy**: Fork testing matches mainnet exactly  
3. **Cost Efficiency**: No testnet token acquisition needed
4. **DeFi Reality**: Test against real liquidity and contracts
5. **Faster Iteration**: No waiting for testnet confirmations

## **Commands**

```bash
# Local development
npm run deploy:local
npm run test

# Fork testing (production accuracy)
npm run fork:deploy
npm run fork:verify

# Production deployment
npm run deploy:mainnet:alchemy
npm run deploy:verify:mainnet:alchemy
```

---

**Decision Date**: December 2024  
**Rationale**: Maximize testing accuracy while minimizing complexity  
**Status**: ✅ Implemented and validated