# SQX Indicator RR Enforcer

StrategyQuant X user plugin that exposes two Profit Target options for indicator-level RR handling without patching SQX internal files.

## What It Adds

- `EnforceIndicatorRRRatio`
- `IndicatorRRAdjustPT`

The plugin does this by:

1. Patching Profit Target settings template at runtime (adds 2 checkboxes).
2. Wrapping `ProfitTargetService` methods at runtime so the two flags:
   - load from task XML
   - save back to task XML
   - reset correctly
   - appear in settings description
3. Exposing a lightweight servlet endpoint for plugin health/status (`/indicatorrr/status`).
4. Writing startup diagnostics to the browser console with patch results.

## Plugin Layout

- `user/extend/Plugins/IndicatorRREnforcer/IndicatorRREnforcerPlugin.java`
- `user/extend/Plugins/IndicatorRREnforcer/IndicatorRREnforcerServlet.java`
- `user/extend/Plugins/IndicatorRREnforcer/ui/module.js`
- `user/extend/Plugins/IndicatorRREnforcer/.project`
- `user/extend/Plugins/IndicatorRREnforcer/.classpath`

This matches normal SQX plugin structure like your existing AutoRename plugin.

## Install (No .sxp)

1. Copy this repo's `user` folder into your SQX installation root (merge folders).
2. In SQX, open Code Editor and compile plugins (or restart SQX).

## Notes

- The Java plugin compiles against SQX libraries.
- The UI patch depends on internal Angular template/service names used by current SQX builds.
- If SQX changes those names in a future build, adjust `ui/module.js` accordingly.
