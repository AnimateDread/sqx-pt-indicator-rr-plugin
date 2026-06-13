angular.module('app.settings.indicatorrrenforcer', ['sqplugin'])
.run(function($injector, $templateCache) {
    var TEMPLATE_ID = '../../../internal/plugins/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html';
    var FLAG_1 = 'EnforceIndicatorRRRatio';
    var FLAG_2 = 'IndicatorRRAdjustPT';

    patchProfitTargetTemplate();
    patchProfitTargetService();

    function patchProfitTargetTemplate() {
        var tpl = $templateCache.get(TEMPLATE_ID);
        if (!tpl || tpl.indexOf('enforceIndicatorRRRatio') >= 0) {
            return;
        }

        var marker = '<div class="row row-smaller indicator-levels">';
        var markerIndex = tpl.indexOf(marker);
        if (markerIndex < 0) {
            return;
        }

        var insertAt = tpl.indexOf('\n    <br />\n</fieldset>', markerIndex);
        if (insertAt < 0) {
            insertAt = tpl.indexOf('<br />\n</fieldset>', markerIndex);
        }
        if (insertAt < 0) {
            return;
        }

        var extra = '' +
            '\n\n    <div class="row row-smaller">' +
            '\n        <div class="col col-sm-4">' +
            '\n            <div class="sq-checkbox">' +
            '\n                <input type="checkbox" ng-model="config.enforceIndicatorRRRatio" ng-disabled="!config.indicatorBased" id="enforceIndicatorRRRatio" />' +
            '\n                <label for="enforceIndicatorRRRatio" tsq>Enforce RR for indicator levels</label>' +
            '\n            </div>' +
            '\n        </div>' +
            '\n        <div class="col col-sm-8 help">' +
            '\n            <label><tsq>Enable Use indicator levels above to activate this option</tsq></label>' +
            '\n        </div>' +
            '\n    </div>' +
            '\n\n    <div class="row row-smaller">' +
            '\n        <div class="col col-sm-4">' +
            '\n            <div class="sq-checkbox">' +
            '\n                <input type="checkbox" ng-model="config.indicatorRRAdjustPT" ng-disabled="!config.indicatorBased || !config.enforceIndicatorRRRatio" id="indicatorRRAdjustPT" />' +
            '\n                <label for="indicatorRRAdjustPT" tsq>Adjust PT instead of skip</label>' +
            '\n            </div>' +
            '\n        </div>' +
            '\n        <div class="col col-sm-8 help">' +
            '\n            <label><tsq>Off: skip invalid trades. On: keep SL and adjust PT to nearest valid RR boundary</tsq></label>' +
            '\n        </div>' +
            '\n    </div>';

        tpl = tpl.slice(0, insertAt) + extra + tpl.slice(insertAt);
        $templateCache.put(TEMPLATE_ID, tpl);
    }

    function patchProfitTargetService() {
        var service;
        try {
            service = $injector.get('ProfitTargetService');
        } catch (e) {
            return;
        }

        if (!service || service.__indicatorRRPatchApplied) {
            return;
        }
        service.__indicatorRRPatchApplied = true;

        var appService = safeGet('AppService');
        var rememberedConfig = {
            enforceIndicatorRRRatio: false,
            indicatorRRAdjustPT: false
        };

        wrapLoadSettings();
        wrapSaveSettings();
        wrapResetSettings();
        wrapGetDescription();

        ensureFlags(false);

        function safeGet(name) {
            try {
                return $injector.get(name);
            } catch (e) {
                return null;
            }
        }

        function ensureFlags(useRemembered) {
            if (!service.config) {
                return;
            }

            if (typeof service.config.enforceIndicatorRRRatio === 'undefined') {
                service.config.enforceIndicatorRRRatio = useRemembered ? !!rememberedConfig.enforceIndicatorRRRatio : false;
            }
            if (typeof service.config.indicatorRRAdjustPT === 'undefined') {
                service.config.indicatorRRAdjustPT = useRemembered ? !!rememberedConfig.indicatorRRAdjustPT : false;
            }
        }

        function rememberFlags() {
            rememberedConfig.enforceIndicatorRRRatio = !!service.config.enforceIndicatorRRRatio;
            rememberedConfig.indicatorRRAdjustPT = !!service.config.indicatorRRAdjustPT;
        }

        function loadFlagsFromXml() {
            if (!appService || typeof appService.getCurrentTaskTabSettings !== 'function') {
                return;
            }

            try {
                var whatToBuildElem = appService.getCurrentTaskTabSettings('WhatToBuild');
                var slptOptionsElem = getChildElement(whatToBuildElem, 'SLPTOptions');
                if (!slptOptionsElem) {
                    return;
                }

                service.config.enforceIndicatorRRRatio = getNodeBooleanValue(slptOptionsElem, FLAG_1, !!service.config.enforceIndicatorRRRatio);
                service.config.indicatorRRAdjustPT = getNodeBooleanValue(slptOptionsElem, FLAG_2, !!service.config.indicatorRRAdjustPT);
            } catch (e) {
                // Ignore and keep defaults if parsing fails.
            }
        }

        function saveFlagsToXml(whatToBuildElem) {
            try {
                var slptOptionsElem = getChildElement(whatToBuildElem, 'SLPTOptions');
                if (!slptOptionsElem) {
                    slptOptionsElem = createChild(whatToBuildElem, 'SLPTOptions', appService.xmlDoc);
                }

                var node = createChild(slptOptionsElem, FLAG_1, appService.xmlDoc);
                setNodeValue(node, !!service.config.enforceIndicatorRRRatio, appService.xmlDoc);

                node = createChild(slptOptionsElem, FLAG_2, appService.xmlDoc);
                setNodeValue(node, !!service.config.indicatorRRAdjustPT, appService.xmlDoc);
            } catch (e) {
                // Ignore and keep original save behavior.
            }
        }

        function wrapLoadSettings() {
            var original = service.loadSettings;
            if (typeof original !== 'function') {
                return;
            }

            service.loadSettings = function() {
                var result = original.apply(service, arguments);
                ensureFlags(true);
                loadFlagsFromXml();
                rememberFlags();
                return result;
            };
        }

        function wrapSaveSettings() {
            var original = service.saveSettings;
            if (typeof original !== 'function') {
                return;
            }

            service.saveSettings = function(whatToBuildElem) {
                ensureFlags(false);
                var result = original.apply(service, arguments);
                if (whatToBuildElem) {
                    saveFlagsToXml(whatToBuildElem);
                }
                rememberFlags();
                return result;
            };
        }

        function wrapResetSettings() {
            var original = service.resetSettings;
            if (typeof original !== 'function') {
                return;
            }

            service.resetSettings = function(useOldSettings) {
                var result = original.apply(service, arguments);
                ensureFlags(!!useOldSettings);
                if (!useOldSettings) {
                    service.config.enforceIndicatorRRRatio = false;
                    service.config.indicatorRRAdjustPT = false;
                }
                return result;
            };
        }

        function wrapGetDescription() {
            var original = service.getDescription;
            if (typeof original !== 'function') {
                return;
            }

            service.getDescription = function(settingName) {
                var description = original.apply(service, arguments);
                ensureFlags(false);

                if (service.config.indicatorBased && service.config.enforceIndicatorRRRatio) {
                    description += ', ' + 'Enforce indicator RR';
                    description += ', ' + (service.config.indicatorRRAdjustPT ? 'adjust PT' : 'skip invalid');
                }

                return description;
            };
        }
    }
});
