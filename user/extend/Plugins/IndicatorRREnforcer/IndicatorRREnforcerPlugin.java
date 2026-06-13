package com.strategyquant.userplugins.indicatorrr;

import com.strategyquant.pluginlib.ISQPlugin;
import com.strategyquant.pluginlib.annotations.Category;
import com.strategyquant.pluginlib.annotations.License;
import com.strategyquant.pluginlib.annotations.Name;
import com.strategyquant.pluginlib.annotations.ShortDesc;

import net.xeoh.plugins.base.annotations.PluginImplementation;
import net.xeoh.plugins.base.annotations.meta.Author;

@Author(name = "AnimateDread")
@Name(name = "Indicator RR Enforcer")
@Category(name = "Settings")
@License(text = "")
@ShortDesc(text = "Adds indicator-level RR enforcement controls for Profit Target settings")
@PluginImplementation
public class IndicatorRREnforcerPlugin implements ISQPlugin {

    @Override
    public String getProduct() {
        return "SQUANT";
    }

    @Override
    public int getPreferredPosition() {
        return 0;
    }

    @Override
    public void initPlugin() throws Exception {
        // Frontend behavior is provided by user/extend/Plugins/IndicatorRREnforcer/ui/module.js
    }
}
