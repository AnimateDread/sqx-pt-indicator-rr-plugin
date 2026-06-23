package com.strategyquant.userplugins.indicatorrr;

import java.util.Map;

import org.json.JSONObject;

import com.strategyquant.webguilib.servlet.HttpJSONServlet;

class IndicatorRREnforcerServlet extends HttpJSONServlet {

    @Override
    protected String execute(String command, Map<String, String[]> parameterMap, String method) throws Exception {
        switch (command) {
            case "status":
                return onStatus();
            default:
                throw new Exception("Unknown command '" + command + "'.");
        }
    }

    private String onStatus() {
        JSONObject response = new JSONObject();
        response.put("plugin", "IndicatorRREnforcer");
        response.put("success", "ok");
        response.put("flags", new String[] { "EnforceIndicatorRRRatio", "IndicatorRRAdjustPT" });
        response.put("runtimePatchApplied", IndicatorRREnforcerPlugin.isRuntimePatchApplied());
        response.put("runtimePatchStatus", IndicatorRREnforcerPlugin.getRuntimePatchStatus());
        response.put("note", "UI hook is implemented in ui/module.js and stock ProfitTarget runtime is patched on plugin startup");
        return response.toString();
    }
}
