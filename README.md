# SQX Indicator RR Enforcer

StrategyQuant X user plugin scaffold to replace internal-only RR indicator-level toggles with a portable user plugin.

## Goal

Convert the internal overlay changes into a regular user plugin so updates between SQX builds do not require patching internal files.

## Feasibility Summary

Based on diffing your custom overlay against SQX 144:

- Modified files are UI/template/task-default files only.
- No Java backend/snippet changes were found in your overlay (`ProfitTarget.java` is identical to stock 144).
- Custom keys introduced:
  - `EnforceIndicatorRRRatio`
  - `IndicatorRRAdjustPT`

This strongly suggests migration to user plugin is feasible by decorating frontend services/templates and injecting default task XML values through plugin hooks.

## Current Status

This repository contains:

- plugin skeleton (`IndicatorRREnforcerPlugin.java`)
- frontend module scaffold (`ui/module.js`)
- migration notes and implementation checklist

## Next Steps

1. Implement Angular decorator for `ProfitTargetService` load/save/reset/getDescription.
2. Inject / override the Profit Target HTML template in `$templateCache` to add the 2 toggles.
3. Add optional task-template migration helper for existing projects.
4. Build `.sxp` package and validate on SQX 144+.
