# Critical Bug Fix: Candidate Pulse Memory Leak

## Date: 2026-01-19

## Issue Description
The application was crashing with a `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
Logs indicated an infinite loop in `CandidatePulseService` where `calculatePulse` and `calculateTrend` were recursively calling each other without exit.

## Root Cause
**Infinite Recursion Cycle**:
1. `calculatePulse()` called `calculateTrend()`
2. `calculateTrend()` called `calculatePulse()` to get recent/baseline data
3. This created an infinite call stack, rapidly consuming all available memory

## Solution Implemented

### Refactored `calculateTrend`
Modified the method to accept the **already fetched signals** instead of fetching them again.

**Old Logic (Recursive)**:
```typescript
private async calculateTrend(candidateId, days) {
    // ❌ Calls the main function again
    const recent = await this.calculatePulse(candidateId, 2); 
    const baseline = await this.calculatePulse(candidateId, days);
    // ...
}
```

**New Logic (Memory Safe)**:
```typescript
private async calculateTrend(candidateId, days, allSignals) {
    // ✅ Uses in-memory filtering of existing data
    const recent = allSignals.filter(s => isRecent(s.createdAt));
    // ... calculate directly from arrays
}
```

## Benefits
1. **Eliminated Recursion**: No circular dependency between methods.
2. **Performance Boost**: Reduced database queries. Previously, calculating pulse resulted in 2 additional recursive DB calls. Now it's done in-memory.
3. **Stability**: Prevented heap memory exhaustion crashes.

## Status: ✅ FIXED
The server has been restarted and is running successfully.
