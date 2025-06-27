# Dashboard UI Business Requirements

## 🎯 Core Business Objectives

### Primary Goal
**Fast, user-focused dashboard that scales to any number of vaults while maintaining excellent UX**

### Key Principles
1. **User-Centric**: Show only what matters to the user (their positions)
2. **Performance First**: Fast loading, minimal unnecessary API calls
3. **Scalable**: Works with 3 vaults or 300+ vaults
4. **Discovery Separation**: Portfolio view vs vault exploration are different use cases

## 📊 Dashboard Features

### Portfolio Overview (Primary Focus)
- **Total Portfolio Value**: USD sum across all user positions
- **Total Deposited**: Historical deposits from transaction history
- **Total Earnings**: Current value minus deposits
- **Total ROI**: Percentage return with loss handling
- **Active Positions Count**: Number of vaults with user funds

### Individual Position Cards
- **Per-Vault Breakdown**: TokenX + TokenY values
- **Shares Display**: User's shares in each token
- **Vault APY**: Current yield rates
- **Quick Actions**: Navigate to individual vault management

### Smart Loading States
- **Empty State**: Clean design for users with no positions
- **Loading State**: Progressive loading of position data
- **Error Handling**: Graceful degradation when data unavailable

## 🔍 Vault Discovery (Separate from Dashboard)

### Browse All Vaults
- **Search & Filter**: Find vaults by token pair, APY, etc.
- **Pagination**: Handle 100+ vaults efficiently
- **Minimal Data**: Basic info until user shows interest
- **Performance**: Virtual scrolling or lazy loading

## 💡 UX Flow Requirements

### Dashboard Page
```
User lands on dashboard
↓
Instantly see their portfolio value
↓
Browse their active positions
↓
Click position → Manage that vault
↓
OR click "Discover Vaults" → Separate discovery flow
```

### Technical Performance Requirements
- **Dashboard Load**: <2 seconds for any number of user positions
- **Position Detection**: Smart detection of user's active vaults
- **No Wasted Calls**: Don't fetch data for vaults user doesn't use
- **React Compliance**: Respect hooks rules while being dynamic

## 🏗️ Architecture Questions (Need Clarity)

### Position Detection Strategy
**Question**: How should we detect user positions efficiently?

**Options**:
1. **Event Scanning**: Check blockchain events for user interactions
2. **Balance Checking**: Quick balance checks across vaults
3. **Subgraph Query**: Use The Graph for efficient position detection
4. **Local Storage**: Cache known positions with periodic refresh

### React Hooks Compliance
**Question**: How do we handle dynamic vault loading while respecting React rules?

**Options**:
1. **Component Composition**: Individual components per position
2. **Two-Phase Loading**: Position scan → detailed loading
3. **Hook Array Pattern**: Fixed hooks for detected positions
4. **External State**: Move vault fetching outside React hooks

### Data Architecture
**Question**: Should dashboard be purely client-side or have server support?

**Options**:
1. **Pure Client**: All logic in React hooks
2. **API Aggregation**: Backend endpoint for portfolio data
3. **Hybrid**: Position detection client-side, data server-side
4. **Cached Approach**: Smart caching with invalidation

## ✅ Success Criteria

### User Experience
- [ ] Dashboard loads user positions in <2 seconds
- [ ] Clean, focused interface showing only relevant data
- [ ] Separate discovery flow for exploring new vaults
- [ ] Proper loading states and error handling

### Technical Requirements
- [ ] Truly dynamic vault support (no hardcoded limits)
- [ ] React hooks compliance
- [ ] Performance optimized (minimal API calls)
- [ ] Scalable architecture (works with 100+ total vaults)

### Test Coverage
- [ ] All TDD tests pass (11/11 dashboard hook tests)
- [ ] Multi-vault arbitrary token pair support validated
- [ ] Edge cases properly handled (no positions, errors, etc.)

## ✅ Architecture Decisions Made

### **Scale & Performance Requirements**
- **Total Vaults**: 1-100 vaults (starting with 1, growing over time)
- **User Positions**: Typically <10 positions per user
- **Performance Target**: Dashboard load <2 seconds for any number of user positions

### **Technical Architecture Decisions**
1. **Position Detection**: Quick balance checks across all vaults (1-100)
2. **Loading Strategy**: Two-phase loading with loading UX indicators
3. **Data Architecture**: Pure client-side for now (can add backend later)
4. **React Compliance**: Separate position detection from detailed data loading
5. **Implementation**: TDD approach with comprehensive test coverage

### **Two-Phase Loading Architecture**
```
Phase 1: Position Detection (Fast)
├── Check user balance across all vaults (1-100)
├── Identify vaults with >0 shares
├── Show loading indicator
└── Return vault addresses with positions

Phase 2: Detailed Data Loading 
├── Fetch detailed data only for position vaults
├── Calculate portfolio metrics
├── Show individual position details
└── Complete dashboard rendering
```

### **Implementation Strategy**
- **TDD First**: Write tests defining two-phase behavior
- **Incremental**: Build position detection → detailed loading → UX
- **Performance**: Only fetch what's needed, when needed
- **Scalable**: Works with 1 vault or 100 vaults

---

*This document defines what we're building and why. Architecture decisions have been made - ready for TDD implementation.*