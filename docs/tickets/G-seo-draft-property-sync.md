# G — SEO draft pipeline: fix "No Frisco properties found"

## Type
Bug fix

## Description
The SEO draft page shows the error "No Frisco properties found yet. Sync property data before running the SEO draft pipeline." When the button is clicked, nothing happens. The pipeline requires Frisco-market properties to be synced first.

## Root cause (to investigate)
- The SEO pipeline is hardcoded to `MARKET_KEY='frisco-tx'` and `SITE_KEY='stayinfrisco'`
- The pipeline checks for properties associated with that market key before running
- Either no properties are linked to this market, or the sync endpoint is broken/not triggered

## Scope

### 1. Fix the button
- The "Sync property data" button should trigger the property sync for the Frisco market
- Show loading state and success/error feedback after click

### 2. Ensure properties are linkable to a market
- Properties should have a `marketKey` field (or a market association) to be recognized by the SEO pipeline
- Owner/manager should be able to assign a property to a market from the properties page

### 3. Fallback UX
- If no properties are found after sync, show a helpful message explaining what to do (not just the error)
- If the pipeline runs successfully, navigate to or refresh the draft list

## Acceptance criteria
- [ ] "Sync property data" button actually triggers sync and provides feedback
- [ ] After sync, Frisco-market properties are recognized by the pipeline
- [ ] Pipeline runs successfully and generates SEO draft candidates
- [ ] Error message replaced with actionable UX if properties still not found
