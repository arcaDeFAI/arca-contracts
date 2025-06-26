# 🚀 Arca Vault Testing Quick Reference

## Essential Commands for Localhost Testing

### 🏗️ Setup Phase
```bash
# Terminal 1 - Start blockchain (keep running)
npx hardhat node --reset

# Terminal 2 - Run tests
npm run test              # All 151 automated tests
npm run deploy:local      # Deploy with mocks
npm run deploy:verify:local  # Verify deployment (37 checks)
```

### 🧪 Manual Testing Options

**Option 1: Automated Manual Tests (Recommended)**
```bash
npm run local:test
```
*Runs comprehensive scripted tests automatically*

**Option 2: Interactive Console Testing**
```bash
npx hardhat console --network localhost
# Copy/paste test scripts from LOCALHOST_TESTING_GUIDE.md
```
*Full interactive control, detailed feedback*

**Option 3: Custom Testing**
```bash
# Reset and start fresh
npm run local:reset
npm run deploy:local
# Run your own test scenarios
```

## 📋 Success Criteria Checklist

### Foundation ✅
- [ ] 151/151 automated tests pass
- [ ] 37/37 deployment verification checks pass
- [ ] All contracts deploy successfully

### Core Functionality ✅
- [ ] Users can deposit tokens
- [ ] Deposits are queued properly
- [ ] Rebalance processes deposits → shares
- [ ] Users can withdraw shares
- [ ] Withdrawals are processed properly
- [ ] Multi-user scenarios work

### Fee System ✅
- [ ] 0.5% deposit fees collected
- [ ] 0.5% withdrawal fees collected
- [ ] Fee recipient receives fees
- [ ] Fee calculations are accurate

### Error Handling ✅
- [ ] Zero deposits rejected
- [ ] Insufficient allowance rejected
- [ ] Non-owners can't call owner functions
- [ ] Invalid operations fail gracefully

### Performance ✅
- [ ] Operations complete in reasonable time
- [ ] Large deposits (10K tokens) work
- [ ] System handles multiple users

## 🎯 Key Test Scenarios

### Scenario 1: Basic User Flow
```
User deposits 100 TokenX + 100 TokenY
→ Rebalance processes deposits
→ User receives shares (minus 0.5% fee)
→ User withdraws 25% of shares
→ Rebalance processes withdrawal
→ User receives tokens (minus 0.5% fee)
```

### Scenario 2: Multi-User
```
User1: 100 TokenX + 100 TokenY
User2: 200 TokenX + 150 TokenY
→ Both get proportional shares
→ Withdrawals work independently
→ Share accounting is accurate
```

### Scenario 3: Edge Cases
```
Zero deposit → Rejected ✅
No allowance → Rejected ✅
Non-owner access → Rejected ✅
Large amounts → Works ✅
```

## 🔧 Troubleshooting

### Common Issues & Solutions

**"No deployment found"**
```bash
npm run deploy:local
```

**"Tests failing"**
```bash
npx hardhat node --reset  # Restart blockchain
npm run test              # Check basic functionality
```

**"Connection refused"**
```bash
# Make sure hardhat node is running in Terminal 1
npx hardhat node --reset
```

**"Contract interaction fails"**
```bash
npm run deploy:verify:local  # Check deployment status
```

### Debug Commands
```bash
# Check contract sizes
npx hardhat size-contracts

# Manual console debugging
npx hardhat console --network localhost

# View deployment details
cat deployments/localhost/latest.json | jq

# Check logs
npm run deploy:verify:local
```

## 📊 Expected Output Examples

### Successful Deployment
```
✅ All checks passed - you can deploy to testnet
🎉 ALL CHECKS PASSED! (37/37)
✅ Deployment is ready for use!
```

### Successful Manual Testing
```
✅ Deposits Queued: 2 deposits queued
✅ Rebalance Processing: Shares minted
✅ Withdrawal Processing: Tokens received
✅ Multi-User Support: User2 shares minted
🎉 ALL TESTS PASSED! (9/9)
✅ System is ready for testnet deployment!
```

## 🚀 Next Steps After Success

If all localhost tests pass:

1. **✅ System Validated** - Core functionality works
2. **📋 Ready for Testnet** - Follow TESTNET_DEPLOYMENT_CHECKLIST.md
3. **🔍 Get Metropolis Addresses** - Use FINDING_METROPOLIS_ADDRESSES.md
4. **⚡ Deploy to Testnet** - When addresses are available

## ⏱️ Time Estimates

- **Automated Tests**: 2-3 minutes
- **Deployment**: 1-2 minutes  
- **Verification**: 30 seconds
- **Manual Testing (Script)**: 1-2 minutes
- **Manual Testing (Interactive)**: 15-20 minutes
- **Total**: 5-30 minutes depending on method

## 🎯 Pro Tips

1. **Always start with automated tests** - catch issues early
2. **Use scripted manual tests** for speed and consistency
3. **Keep hardhat node running** - avoid restart delays
4. **Check verification output** - 37/37 checks should pass
5. **Save deployment artifacts** - they contain useful info
6. **Test edge cases** - they reveal real-world issues

---

**Quick Start**: `npx hardhat node --reset` → `npm run test` → `npm run deploy:local` → `npm run local:test`