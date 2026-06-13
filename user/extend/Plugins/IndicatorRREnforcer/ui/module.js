var indicatorRRModule = angular.module('app.settings.indicatorrrenforcer', []);

// Inject into main app
try {
    angular.module('app').requires.push('app.settings.indicatorrrenforcer');
    console.info('[IndicatorRREnforcer] Module injected into main app');
} catch (e) {
    console.warn('[IndicatorRREnforcer] Could not inject into main app (not loaded yet):', e.message);
}

indicatorRRModule.run(function($injector, $templateCache) {
    console.info('[IndicatorRREnforcer] Module run() executed');
    var TEMPLATE_ID = '../../../internal/plugins/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html';
    var FLAG_1 = 'EnforceIndicatorRRRatio';
    var FLAG_2 = 'IndicatorRRAdjustPT';
    var LOG_PREFIX = '[IndicatorRREnforcer]';

    var templatePatched = patchProfitTargetTemplate();
    var servicePatched = patchProfitTargetService();

    logInfo('startup', {
        templatePatched: templatePatched,
        servicePatched: servicePatched
    });

    function logInfo(message, data) {
        if (window && window.console && typeof window.console.info === 'function') {
            window.console.info(LOG_PREFIX + ' ' + message, data || '');
        }
    }

    function logWarn(message, data) {
        if (window && window.console && typeof window.console.warn === 'function') {
            window.console.warn(LOG_PREFIX + ' ' + message, data || '');
        }
    }

    function patchProfitTargetTemplate() {
        var tpl = $templateCache.get(TEMPLATE_ID);
        if (!tpl || tpl.indexOf('enforceIndicatorRRRatio') >= 0) {
            if (!tpl) {
                logWarn('template not found', { templateId: TEMPLATE_ID });
            } else {
                logInfo('template already patched', { templateId: TEMPLATE_ID });
            }
            return false;
        }

        var marker = '<div class="row row-smaller indicator-levels">';
        var markerIndex = tpl.indexOf(marker);
        if (markerIndex < 0) {
            logWarn('template marker not found', { marker: marker });
            return false;
        }

        var insertAt = tpl.indexOf('\n    <br />\n</fieldset>', markerIndex);
        if (insertAt < 0) {
            insertAt = tpl.indexOf('<br />\n</fieldset>', markerIndex);
        }
        if (insertAt < 0) {
            logWarn('template insert point not found');
            return false;
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
        logInfo('template patched', { templateId: TEMPLATE_ID });
        return true;
    }

    function patchProfitTargetService() {
        var service;
        try {
            service = $injector.get('ProfitTargetService');
        } catch (e) {
            logWarn('ProfitTargetService not available', { error: e && e.message ? e.message : e });
            return false;
        }

        if (!service || service.__indicatorRRPatchApplied) {
            if (service && service.__indicatorRRPatchApplied) {
                logInfo('service already patched');
            }
            return false;
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
        logInfo('service patched');
        return true;

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

        function getChildElement(elem, name) {
            if (!elem) return null;
            var children = elem.childNodes;
            for (var i = 0; i < children.length; i++) {
                if (children[i].nodeName === name) {
                    return children[i];
                }
            }
            return null;
        }

        function createChild(elem, name, xmlDoc) {
            var existing = getChildElement(elem, name);
            if (existing) {
                return existing;
            }
            var newElem = xmlDoc.createElement(name);
            elem.appendChild(newElem);
            return newElem;
        }

        function getNodeBooleanValue(elem, nodeName, defaultValue) {
            var node = getChildElement(elem, nodeName);
            if (!node) return defaultValue;
            var text = node.textContent || node.innerText || '';
            return text.toLowerCase() === 'true' || text === '1' || text === 'yes';
        }

        function setNodeValue(node, value, xmlDoc) {
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
            var text = xmlDoc.createTextNode(value ? 'true' : 'false');
            node.appendChild(text);
        }
    }
});
