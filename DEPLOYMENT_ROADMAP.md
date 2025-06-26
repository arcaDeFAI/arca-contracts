# Arca Vault System - Deployment Roadmap

## 📋 Project Overview

The Arca vault system is a decentralized vault for automated liquidity provision on the Sonic blockchain. It provides intelligent vault management for Metropolis DLMM (Dynamic Liquidity Market Maker) pools with automated reward compounding and yield optimization.

### Core Architecture
- **ArcaTestnetV1**: Main vault contract handling deposits, withdrawals, and liquidity management
- **ArcaQueueHandlerV1**: Manages deposit/withdrawal queues for batched processing
- **ArcaRewardClaimerV1**: Handles METRO reward claiming and automatic compounding
- **ArcaFeeManagerV1**: Manages fee configuration and collection (0.5% deposit/withdraw, 10% performance)

All contracts use **OpenZeppelin's UUPS upgradeable proxy pattern** for future upgrades.

## ✅ COMPLETED PHASES

### Phase 1: Project Setup ✅
- [x] Hardhat configuration with TypeScript
- [x] OpenZeppelin Upgrades plugin integration
- [x] Dependencies and submodules (Joe V2)
- [x] Development environment setup

### Phase 2: Smart Contract Development ✅
- [x] Core vault contracts with UUPS proxy pattern
- [x] Queue-based deposit/withdrawal system
- [x] Dual token share tracking (TokenX/TokenY)
- [x] METRO reward claiming and compounding
- [x] Fee management system
- [x] Comprehensive error handling and validation

### Phase 3: Testing & Quality Assurance ✅
- [x] **151/151 tests passing (100% success)**
- [x] Test-Driven Development (TDD) methodology
- [x] Unit tests for all contract functions
- [x] Integration tests for full workflow
- [x] Precise value testing (no vague assertions)
- [x] Production bug discovery and fixes via TDD
- [x] Edge case coverage and error handling

#### Critical Bugs Fixed Through TDD:
- Division by zero in `getPricePerFullShare` when `tokenBalance == 0` but `totalSupply > 0`
- Division by zero in withdrawal processing when `totalShares[tokenIdx] == 0`
- Performance fee collection consistency (now collected on all rewards regardless of swap threshold)

## 🔄 IN PROGRESS PHASES

### Phase 4: Deployment Infrastructure
**Status**: 75% Complete  
**Priority**: High

#### 4.1 Script-Based Deployment 
- [x] **Create TypeScript deployment scripts for UUPS proxy system**
- [x] **Handle complex initialization parameters** (via deployment config)
- [x] **Implement proper dependency injection** (contracts reference each other correctly)
- [x] **Set up deployment parameter management** (network config files)

#### 4.2 Network Configuration ✅
- [x] **Configure deployment networks** (localhost, Sonic Blaze testnet, Sonic mainnet)
- [x] **Set up environment variables and secrets management** (.env support)
- [x] **Configure gas settings and deployment optimization** (per-network settings)
- [x] **Set up contract verification settings** (Sonic block explorer integration)

#### 4.3 UUPS Proxy Deployment Strategy
- [x] **Implement OpenZeppelin's deployment best practices** (mixed UUPS + Beacon proxies)
- [x] **Handle proxy initialization and implementation deployment** (atomic deployment)
- [x] **Set up upgrade authorization flow** (owner-only UUPS upgrades)
- [ ] **Document upgrade procedures** (create upgrade scripts and documentation)

#### 4.4 Deployment Scripts & Automation
- [x] **Create comprehensive deployment scripts** (`deployArcaSystem.ts`, `deploy-local.ts`, `deploy-testnet.ts`)
- [x] **Implement deployment validation checks** (37-check verification system)
- [x] **Set up post-deployment configuration** (ownership transfers, registry integration)
- [ ] **Create deployment rollback procedures** (emergency rollback scripts)

### Phase 5: Local Development Environment  
**Status**: 70% Complete
**Dependencies**: Phase 4 (mostly complete)
**Priority**: High

#### 5.1 Local Hardhat Node Setup
- [x] **Configure local node with appropriate settings** (hardhat.config.ts)
- [ ] **Set up persistent local blockchain state** (state persistence between restarts)
- [x] **Create local development reset scripts** (`npm run local:reset`)
- [x] **Configure local account management** (pre-funded test accounts)

#### 5.2 Complete System Deployment
- [x] **Deploy full vault system to local network** (`npm run deploy:local`)
- [x] **Validate all contract interactions locally** (37-check verification system)
- [ ] **Test upgrade scenarios locally** (create upgrade testing scripts)
- [x] **Verify ownership transfer flows** (part of comprehensive verification)

#### 5.3 Development Workflow Scripts
- [x] **Create developer onboarding scripts** (automated local deployment)
- [ ] **Set up automated testing against deployed contracts** (script to run tests against live contracts)
- [x] **Create contract interaction utilities** (verification, export scripts)
- [x] **Document development workflows** (DEPLOYMENT_GUIDE.md)

#### 5.4 Local Testing & Validation
- [x] **End-to-end testing on local deployment** (verification covers integration)
- [ ] **Performance testing and gas optimization** (gas analysis scripts)
- [x] **Security validation on deployed contracts** (ownership, access control verification)
- [ ] **User flow testing** (actual deposit/withdraw/rebalance flow testing)

## 🎯 UPCOMING PHASES

### Phase 6: Testnet Deployment
**Dependencies**: Phase 5  
**Priority**: Medium

#### 6.1 Sonic Testnet Configuration
- [ ] Configure Sonic testnet network settings
- [ ] Set up testnet RPC endpoints and configuration
- [ ] Configure testnet account management
- [ ] Set up testnet monitoring tools

#### 6.2 Testnet Deployment & Verification
- [ ] Deploy complete system to Sonic testnet
- [ ] Verify contracts on Sonic block explorer
- [ ] Document all deployed contract addresses
- [ ] Set up testnet monitoring and alerts

#### 6.3 Testnet Validation
- [ ] Comprehensive testing on testnet environment
- [ ] Real-world scenario testing
- [ ] Performance monitoring and optimization
- [ ] Community testing coordination

#### 6.4 Testnet Documentation
- [ ] Create testnet interaction guides
- [ ] Document testnet contract addresses
- [ ] Provide testnet user guides
- [ ] Set up testnet support channels

### Phase 7: Frontend Integration Preparation
**Dependencies**: Phase 6  
**Priority**: Medium

#### 7.1 TypeScript Interface Generation
- [ ] Generate TypeScript interfaces from ABIs
- [ ] Create type-safe contract interaction utilities
- [ ] Set up automated interface generation pipeline
- [ ] Document interface usage patterns

#### 7.2 ABI & Contract Artifacts
- [ ] Export optimized ABI files for frontend
- [ ] Create contract artifact management system
- [ ] Set up artifact distribution pipeline
- [ ] Implement artifact versioning

#### 7.3 Deployment Address Management
- [ ] Create deployment address registry
- [ ] Implement environment-specific address resolution
- [ ] Set up address update automation
- [ ] Create address validation utilities

#### 7.4 Integration Documentation
- [ ] Create comprehensive integration guides
- [ ] Document all contract interactions
- [ ] Provide code examples and tutorials
- [ ] Set up developer support resources

### Phase 8: Production Deployment
**Dependencies**: Phase 7  
**Priority**: Critical

#### 8.1 Security & Audit Preparation
- [ ] Conduct comprehensive security review
- [ ] Prepare for external security audits
- [ ] Implement security best practices
- [ ] Create incident response procedures

#### 8.2 Mainnet Deployment
- [ ] Deploy to Sonic mainnet with multi-sig governance
- [ ] Verify all contracts on mainnet explorer
- [ ] Set up mainnet monitoring and alerting
- [ ] Implement emergency procedures

#### 8.3 Production Configuration
- [ ] Transfer ownership to production multi-sig
- [ ] Configure production fee recipients
- [ ] Set up production monitoring dashboards
- [ ] Implement automated health checks

#### 8.4 Production Validation
- [ ] Comprehensive mainnet testing
- [ ] Performance monitoring setup
- [ ] User acceptance testing
- [ ] Go-live procedures and support

## 🔧 Technical Considerations

### Deployment Challenges
1. **Contract Size Limits**: Avoid factory contracts that exceed 24.5KB limit
2. **UUPS Proxy Complexity**: Proper initialization and upgrade authorization
3. **Inter-Contract Dependencies**: Contracts must reference each other correctly
4. **Ownership Transfer**: Complex ownership flow during deployment

### Key Requirements
- All contracts must use UUPS upgradeable proxy pattern
- Supporting contracts (QueueHandler, FeeManager, RewardClaimer) owned by main vault
- Proper fee recipient configuration
- Secure upgrade authorization (owner-only)

### Success Metrics
- All contracts deployed and verified successfully
- All ownership transfers completed correctly
- All integration tests pass on deployed contracts
- Frontend can interact with deployed contracts
- Production monitoring shows healthy system state

## 📚 Resources & References

### Documentation
- [Hardhat Deployment Guide](https://hardhat.org/hardhat-runner/docs/getting-started#overview)
- [OpenZeppelin Upgrades Plugin](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [Sonic Labs Documentation](https://docs.soniclabs.com/)

### Current Infrastructure
- Deployment scripts: `/scripts/deployArcaSystem.ts`
- Network configurations: `/config/networks/`
- Test infrastructure: `/test/` (151 tests, 100% passing)
- Configuration: `hardhat.config.ts`

## 🚀 Next Immediate Action

**Complete Phase 4**: Finish deployment infrastructure and upgrade procedures.

This involves:
1. Creating upgrade scripts and documentation
2. Implementing deployment rollback procedures
3. Setting up persistent local blockchain state
4. Testing upgrade scenarios locally

---

*Last Updated: December 2024*  
*Test Status: 151/151 passing (100%)*  
*Ready for: Phase 4 - Deployment Infrastructure*