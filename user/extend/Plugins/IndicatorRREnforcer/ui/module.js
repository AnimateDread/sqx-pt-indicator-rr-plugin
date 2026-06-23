angular.module('app.settings.indicatorrrenforcer', ['app.settings', 'sqplugin'])
.run(function($templateCache, $injector, $timeout) {
    console.log('[IndicatorRREnforcer] Module loaded');
    var FLAG_1 = 'EnforceIndicatorRRRatio';
    var FLAG_2 = 'IndicatorRRAdjustPT';

    // Patch template to add our controls.
    patchTemplate();
    patchServiceLoadSave();

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

    function patchServiceLoadSave() {
        var attempts = 0;
        var maxAttempts = 20;

        $timeout(function tryPatch() {
            try {
                var service = $injector.get('ProfitTargetService');
                if (!service || service.__indicatorRRLoadSavePatched) {
                    return;
                }

                service.__indicatorRRLoadSavePatched = true;

                var originalLoad = service.loadSettings;
                service.loadSettings = function() {
                    var result = originalLoad.apply(this, arguments);
                    if (!this.config) {
                        this.config = {};
                    }

                    this.config.enforceIndicatorRRRatio = !!this.config.enforceIndicatorRRRatio;
                    this.config.indicatorRRAdjustPT = !!this.config.indicatorRRAdjustPT;

                    try {
                        var appService = $injector.get('AppService');
                        var whatToBuildElem = appService.getCurrentTaskTabSettings('WhatToBuild');
                        var slptElem = getChildElement(whatToBuildElem, 'SLPTOptions');
                        if (slptElem) {
                            this.config.enforceIndicatorRRRatio = getXmlBool(slptElem, FLAG_1, this.config.enforceIndicatorRRRatio);
                            this.config.indicatorRRAdjustPT = getXmlBool(slptElem, FLAG_2, this.config.indicatorRRAdjustPT);
                        }
                    } catch (e) {
                        console.warn('[IndicatorRREnforcer] loadSettings flag read skipped:', e.message);
                    }

                    normalizeIndicatorRrConfig(this.config);

                    return result;
                };

                var originalSave = service.saveSettings;
                service.saveSettings = function(whatToBuildElem) {
                    if (!this.config) {
                        this.config = {};
                    }

                    this.config.enforceIndicatorRRRatio = !!this.config.enforceIndicatorRRRatio;
                    this.config.indicatorRRAdjustPT = !!this.config.indicatorRRAdjustPT;
                    normalizeIndicatorRrConfig(this.config);

                    var result = originalSave.apply(this, arguments);

                    try {
                        if (whatToBuildElem) {
                            var slptElem = ensureChildElement(whatToBuildElem, 'SLPTOptions');
                            setXmlValue(slptElem, FLAG_1, this.config.enforceIndicatorRRRatio, whatToBuildElem.ownerDocument);
                            setXmlValue(slptElem, FLAG_2, this.config.indicatorRRAdjustPT, whatToBuildElem.ownerDocument);
                        }
                    } catch (e) {
                        console.warn('[IndicatorRREnforcer] saveSettings flag write skipped:', e.message);
                    }

                    return result;
                };

                var originalReset = service.resetSettings;
                service.resetSettings = function(useOldSettings) {
                    var result = originalReset.apply(this, arguments);

                    if (!this.config) {
                        this.config = {};
                    }

                    this.config.enforceIndicatorRRRatio = !!this.config.enforceIndicatorRRRatio;
                    this.config.indicatorRRAdjustPT = !!this.config.indicatorRRAdjustPT;
                    normalizeIndicatorRrConfig(this.config);

                    return result;
                };

                var originalCheck = service.checkSettings;
                service.checkSettings = function() {
                    if (!this.config) {
                        this.config = {};
                    }

                    normalizeIndicatorRrConfig(this.config);
                    return originalCheck.apply(this, arguments);
                };

                console.log('[IndicatorRREnforcer] ProfitTargetService load/save patched');
            } catch (e) {
                if (attempts < maxAttempts) {
                    attempts++;
                    $timeout(tryPatch, 250, false);
                } else {
                    console.warn('[IndicatorRREnforcer] ProfitTargetService not patched:', e.message);
                }
            }
        }, 0, false);
    }

    function getChildElement(elem, name) {
        if (!elem || !elem.childNodes) {
            return null;
        }
        for (var i = 0; i < elem.childNodes.length; i++) {
            if (elem.childNodes[i].nodeName === name) {
                return elem.childNodes[i];
            }
        }
        return null;
    }

    function ensureChildElement(parentElem, name) {
        var elem = getChildElement(parentElem, name);
        if (elem) {
            return elem;
        }
        elem = parentElem.ownerDocument.createElement(name);
        parentElem.appendChild(elem);
        return elem;
    }

    function setXmlValue(parentElem, nodeName, value, xmlDoc) {
        var elem = ensureChildElement(parentElem, nodeName);
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

        // Route indicator RR to the stock RR path and leave the stock ratio values untouched.
        config.limitRRRatio = true;
    }

});

// Module will be auto-discovered via app.settings dependency chain

