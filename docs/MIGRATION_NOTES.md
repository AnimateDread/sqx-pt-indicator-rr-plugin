# Migration Notes

## Verified Internal Overlay Delta

Custom-only keys and UI fields are present in:

- internal/plugins/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html
- internal/plugins/SettingsWhatToBuild/views/settings/profitTarget/ProfitTargetService.js
- internal/plugins/TaskBuild/task_forex.xml
- internal/plugins/TaskBuild/task_futures.xml
- internal/plugins/TaskBuild/task_stockpicker.xml
- internal/web/BUILDER/templates/tpl_build.xml
- internal/web/common/templates.html
- internal/web/common/Batch1/libs.js

`internal/extend/Snippets/SQ/ExitMethods/ProfitTarget.java` is identical to stock SQX 144.

## Implication

A pure user plugin conversion is likely possible without patching Java internals, because your overlay appears to be frontend + defaults only.

## Open Technical Checks

1. Confirm the plugin JS can decorate `ProfitTargetService` in current Angular boot order.
2. Confirm template override key path for the ProfitTarget settings partial.
3. Confirm where to persist defaults for new tasks without internal `task_*.xml` edits.
