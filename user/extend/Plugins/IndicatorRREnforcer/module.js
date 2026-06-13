angular.module('app.settings')
.run(function($injector, $templateCache) {
    console.log('[IndicatorRREnforcer] Module loaded');
    
    var FLAG_1 = 'EnforceIndicatorRRRatio';
    var FLAG_2 = 'IndicatorRRAdjustPT';

    // Patch template to add our controls
    patchTemplate();
    
    // Patch service to handle our flags
    patchService();

    function patchTemplate() {
        var templateId = '../../../internal/plugins/SettingsWhatToBuild/views/settings/profitTarget/profitTarget.html';

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

        var tpl = $templateCache.get(templateId);
        if (tpl) {
            var patched = withInjectedControls(tpl);
            if (patched !== tpl) {
                $templateCache.put(templateId, patched);
                console.log('[IndicatorRREnforcer] Template patched successfully (immediate)');
            } else {
                console.log('[IndicatorRREnforcer] Template already patched (immediate)');
            }
        } else {
            console.warn('[IndicatorRREnforcer] Template not found yet, waiting for template cache put');
        }

        if (!$templateCache.__indicatorRrPutWrapped) {
            var originalPut = $templateCache.put;
            $templateCache.put = function(key, value) {
                if (key === templateId && typeof value === 'string') {
                    var patchedValue = withInjectedControls(value);
                    if (patchedValue !== value) {
                        console.log('[IndicatorRREnforcer] Template patched successfully (deferred)');
                        return originalPut.call(this, key, patchedValue);
                    }
                }
                return originalPut.apply(this, arguments);
            };
            $templateCache.__indicatorRrPutWrapped = true;
        }
    }

    function patchService() {
        var service;
        try {
            service = $injector.get('ProfitTargetService');
        } catch (e) {
            console.warn('[IndicatorRREnforcer] ProfitTargetService not found:', e.message);
            return;
        }

        if (service.__indicatorRRPatched) {
            console.log('[IndicatorRREnforcer] Service already patched');
            return;
        }
        service.__indicatorRRPatched = true;

        // Wrap saveSettings to persist our flags
        var originalSave = service.saveSettings;
        service.saveSettings = function(whatToBuildElem) {
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
            
            console.log('[IndicatorRREnforcer] Flags loaded:', {
                enforceRR: this.config.enforceIndicatorRRRatio,
                adjustPT: this.config.indicatorRRAdjustPT
            });
            
            return result;
        };

        console.log('[IndicatorRREnforcer] Service patched successfully');
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
});
