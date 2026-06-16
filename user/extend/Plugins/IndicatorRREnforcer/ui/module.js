angular.module('app.settings.indicatorrrenforcer', ['sqplugin'])
.run(function($injector, $templateCache, $timeout) {
    console.log('[IndicatorRREnforcer] Module loaded');
    var FLAG_1 = 'EnforceIndicatorRRRatio';
    var FLAG_2 = 'IndicatorRRAdjustPT';
    var servicePatchAttempts = 0;
    var maxServicePatchAttempts = 20;

    // Patch template to add our controls
    patchTemplate();
    
    // Patch service to handle our flags
    patchService();

    function patchTemplate() {
        var templateIds = [
            '../../../plugins/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html',
            '../../../internal/plugins/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html'
        ];
        var templateSuffix = '/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html';

        function withInjectedControls(tpl) {
            if (!tpl || tpl.indexOf('enforceIndicatorRRRatio') >= 0) {
                return tpl;
            }

            var markerRegex = /<br\s*\/>\s*<\/fieldset>/i;
            var match = markerRegex.exec(tpl);
            if (!match || typeof match.index === 'undefined') {
                console.warn('[IndicatorRREnforcer] Cannot find template insertion point');
                return tpl;
            }
            var idx = match.index;

            var extra = '\n\n    <div class="row row-smaller">' +
            '\n        <div class="col col-sm-4">' +
            '\n            <div class="sq-checkbox">' +
            '\n                <input type="checkbox" ng-model="config.enforceIndicatorRRRatio" ng-disabled="!config.indicatorBased" id="enforceIndicatorRRRatio" />' +
            '\n                <label for="enforceIndicatorRRRatio" tsq>Enforce RR for indicator levels</label>' +
            '\n            </div>' +
            '\n        </div>' +
            '\n        <div class="col col-sm-8 help">' +
            '\n            <label><tsq>When enabled, ensures indicator-based PT obeys min RR ratio</tsq></label>' +
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
            '\n            <label><tsq>Off: skip invalid trades. On: adjust PT to maintain minimum RR</tsq></label>' +
            '\n        </div>' +
            '\n    </div>';

            return tpl.substring(0, idx) + extra + '\n' + tpl.substring(idx);
        }

        var foundTemplate = false;
        for (var i = 0; i < templateIds.length; i++) {
            var templateId = templateIds[i];
            var tpl = $templateCache.get(templateId);
            if (tpl) {
                foundTemplate = true;
                var patched = withInjectedControls(tpl);
                if (patched !== tpl) {
                    $templateCache.put(templateId, patched);
                    console.log('[IndicatorRREnforcer] Template patched successfully (immediate):', templateId);
                } else {
                    console.log('[IndicatorRREnforcer] Template already patched (immediate):', templateId);
                }
            }
        }

        if (!foundTemplate) {
            console.warn('[IndicatorRREnforcer] Template not found yet, waiting for template cache put');
        }

        if (!$templateCache.__indicatorRrPutWrapped) {
            var originalPut = $templateCache.put;
            $templateCache.put = function(key, value) {
                if (typeof key === 'string' && typeof value === 'string' && key.indexOf(templateSuffix) >= 0) {
                    var patchedValue = withInjectedControls(value);
                    if (patchedValue !== value) {
                        console.log('[IndicatorRREnforcer] Template patched successfully (deferred):', key);
                        return originalPut.call(this, key, patchedValue);
                    }
                }
                return originalPut.apply(this, arguments);
            };
            $templateCache.__indicatorRrPutWrapped = true;
        }
    }

    function patchService() {
        if (!tryPatchService()) {
            scheduleServicePatchRetry();
        }
    }

    function scheduleServicePatchRetry() {
        if (servicePatchAttempts >= maxServicePatchAttempts) {
            console.warn('[IndicatorRREnforcer] Giving up on ProfitTargetService patch after retries');
            return;
        }

        servicePatchAttempts++;
        $timeout(function() {
            if (!tryPatchService()) {
                scheduleServicePatchRetry();
            }
        }, 250, false);
    }

    function tryPatchService() {
        var service;
        try {
            service = $injector.get('ProfitTargetService');
        } catch (e) {
            console.warn('[IndicatorRREnforcer] ProfitTargetService not found:', e.message);
            return false;
        }

        if (service.__indicatorRRPatched) {
            console.log('[IndicatorRREnforcer] Service already patched');
            return true;
        }
        service.__indicatorRRPatched = true;

        // Wrap saveSettings to persist our flags
        var originalSave = service.saveSettings;
        service.saveSettings = function(whatToBuildElem) {
            normalizeIndicatorRrConfig(service.config);
            var result = originalSave.apply(this, arguments);
            
            if (whatToBuildElem && service.config) {
                try {
                    var slptElem = getChildElement(whatToBuildElem, 'SLPTOptions');
                    if (!slptElem) {
                        slptElem = whatToBuildElem.ownerDocument.createElement('SLPTOptions');
                        whatToBuildElem.appendChild(slptElem);
                    }

                    setXmlValue(slptElem, FLAG_1, service.config.enforceIndicatorRRRatio, whatToBuildElem.ownerDocument);
                    setXmlValue(slptElem, FLAG_2, service.config.indicatorRRAdjustPT, whatToBuildElem.ownerDocument);
                    console.log('[IndicatorRREnforcer] Flags saved to XML');
                } catch (e) {
                    console.warn('[IndicatorRREnforcer] Error saving flags:', e.message);
                }
            }
            
            return result;
        };

        var originalCheckSettings = service.checkSettings;
        service.checkSettings = function() {
            normalizeIndicatorRrConfig(this.config);
            return originalCheckSettings.apply(this, arguments);
        };

        // Wrap loadSettings to restore our flags
        var originalLoad = service.loadSettings;
        service.loadSettings = function() {
            var result = originalLoad.apply(this, arguments);
            
            if (!this.config) {
                this.config = {};
            }
            if (typeof this.config.enforceIndicatorRRRatio === 'undefined') {
                this.config.enforceIndicatorRRRatio = false;
            }
            if (typeof this.config.indicatorRRAdjustPT === 'undefined') {
                this.config.indicatorRRAdjustPT = false;
            }

            try {
                var whatToBuildElem = $injector.get('AppService').getCurrentTaskTabSettings('WhatToBuild');
                var slptElem = getChildElement(whatToBuildElem, 'SLPTOptions');
                if (slptElem) {
                    this.config.enforceIndicatorRRRatio = getXmlBool(slptElem, FLAG_1, this.config.enforceIndicatorRRRatio);
                    this.config.indicatorRRAdjustPT = getXmlBool(slptElem, FLAG_2, this.config.indicatorRRAdjustPT);
                }
            } catch (e) {
                console.warn('[IndicatorRREnforcer] Error loading flags:', e.message);
            }

            normalizeIndicatorRrConfig(this.config);
            
            console.log('[IndicatorRREnforcer] Flags loaded:', {
                enforceRR: this.config.enforceIndicatorRRRatio,
                adjustPT: this.config.indicatorRRAdjustPT
            });
            
            return result;
        };

        var originalReset = service.resetSettings;
        service.resetSettings = function(useOldSettings) {
            var result = originalReset.apply(this, arguments);

            if (!this.config) {
                this.config = {};
            }

            if (typeof this.config.enforceIndicatorRRRatio === 'undefined') {
                this.config.enforceIndicatorRRRatio = !!useOldSettings && !!oldBool(this.config, 'enforceIndicatorRRRatio');
            }
            if (typeof this.config.indicatorRRAdjustPT === 'undefined') {
                this.config.indicatorRRAdjustPT = !!useOldSettings && !!oldBool(this.config, 'indicatorRRAdjustPT');
            }

            return result;
        };

        var originalDescription = service.getDescription;
        service.getDescription = function(settingName) {
            var description = originalDescription.apply(this, arguments);

            if (!this.config || !this.config.indicatorBased || !this.config.enforceIndicatorRRRatio) {
                return description;
            }

            description += ', Enforce indicator RR';
            description += this.config.indicatorRRAdjustPT ? ', adjust PT' : ', skip invalid';
            return description;
        };

        console.log('[IndicatorRREnforcer] Service patched successfully');
        return true;
    }

    function oldBool(config, key) {
        return !!(config && typeof config[key] !== 'undefined' ? config[key] : false);
    }

    function getChildElement(elem, name) {
        if (!elem || !elem.childNodes) return null;
        for (var i = 0; i < elem.childNodes.length; i++) {
            if (elem.childNodes[i].nodeName === name) {
                return elem.childNodes[i];
            }
        }
        return null;
    }

    function setXmlValue(parentElem, nodeName, value, xmlDoc) {
        var elem = getChildElement(parentElem, nodeName);
        if (!elem) {
            elem = xmlDoc.createElement(nodeName);
            parentElem.appendChild(elem);
        }
        while (elem.firstChild) {
            elem.removeChild(elem.firstChild);
        }
        elem.appendChild(xmlDoc.createTextNode(value ? 'true' : 'false'));
    }

    function getXmlBool(parentElem, nodeName, defaultValue) {
        var elem = getChildElement(parentElem, nodeName);
        if (!elem) {
            return !!defaultValue;
        }
        var text = (elem.textContent || elem.innerText || '').toString().trim().toLowerCase();
        return text === 'true' || text === '1' || text === 'yes';
    }

    function normalizeIndicatorRrConfig(config) {
        if (!config) {
            return;
        }

        if (!config.indicatorBased) {
            config.enforceIndicatorRRRatio = false;
            config.indicatorRRAdjustPT = false;
            return;
        }

        if (!config.enforceIndicatorRRRatio) {
            return;
        }

        // Feed stock RR enforcement path with standard keys for indicator mode.
        config.limitRRRatio = true;

        var from = Number(config.rrRatioFrom);
        var to = Number(config.rrRatioTo);

        if (!isFinite(from) || from <= 0) {
            from = 50;
        }
        if (!isFinite(to) || to <= 0) {
            to = 80;
        }
        if (from > to) {
            var tmp = from;
            from = to;
            to = tmp;
        }

        config.rrRatioFrom = from;
        config.rrRatioTo = to;
    }
});

try {
    var appModule = angular.module('app');
    if (appModule.requires.indexOf('app.settings.indicatorrrenforcer') < 0) {
        appModule.requires.push('app.settings.indicatorrrenforcer');
        console.log('[IndicatorRREnforcer] Module attached to app requires');
    }
} catch (e) {
    console.warn('[IndicatorRREnforcer] Unable to attach module to app requires:', e.message);
}
