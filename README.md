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

## Troubleshooting

### UI Not Loading (Checkboxes Missing)

If the checkboxes don't appear in Profit Target settings:

1. **Method 1: Manual module registration (temporary)**
   - Open browser DevTools (`F12`)  
   - Go to Console tab
   - Paste:
     ```javascript
     // Temporarily inject the module
     angular.module('app.settings.indicatorrrenforcer', ['sqplugin'])
     .run(function($injector, $templateCache) {
       console.log('[IndicatorRREnforcer] Manual injection started');
       // [rest of ui/module.js code here]
     });
     angular.module('app').requires.push('app.settings.indicatorrrenforcer');
     location.reload();
     ```

2. **Method 2: Automatic registration (permanent)**
   - SQX UI modules need to be in a discoverable path. Copy:
     - From: `user/extend/Plugins/IndicatorRREnforcer/ui/module.js`
     - To: `internal/plugins/IndicatorRREnforcer/ui/module.js` (create folder if needed)
   - Restart SQX

3. **Method 3: Check logs**
   - Open browser DevTools Console
   - Look for `[IndicatorRREnforcer]` messages
   - If you see error messages, they'll help diagnose the issue

## Notes

- The Java plugin compiles against SQX libraries.
- The UI patch depends on internal Angular template/service names used by current SQX builds.
- If SQX changes those names in a future build, adjust `ui/module.js` accordingly.

