package com.strategyquant.userplugins.indicatorrr;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.strategyquant.pluginlib.ISQPlugin;
import com.strategyquant.pluginlib.annotations.Category;
import com.strategyquant.pluginlib.annotations.License;
import com.strategyquant.pluginlib.annotations.Name;
import com.strategyquant.pluginlib.annotations.ShortDesc;
import com.strategyquant.tradinglib.servlet.IServletPlugin;

import net.xeoh.plugins.base.annotations.PluginImplementation;
import net.xeoh.plugins.base.annotations.meta.Author;

@Author(name = "AnimateDread")
@Name(name = "Indicator RR Enforcer")
@Category(name = "Settings")
@License(text = "")
@ShortDesc(text = "Adds indicator-level RR enforcement controls for Profit Target settings")
@PluginImplementation
public class IndicatorRREnforcerPlugin implements ISQPlugin, IServletPlugin {

    public static final Logger Log = LoggerFactory.getLogger(IndicatorRREnforcerPlugin.class);

    private ServletContextHandler context;
    private IndicatorRREnforcerServlet servlet;

    @Override
    public Handler getHandler() {
        if (context == null) {
            if (servlet == null) {
                servlet = new IndicatorRREnforcerServlet();
            }
            context = new ServletContextHandler(ServletContextHandler.SESSIONS);
            context.setContextPath("/indicatorrr/");
            context.addServlet(new ServletHolder(servlet), "/*");
        }
        return context;
    }

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
        this.servlet = new IndicatorRREnforcerServlet();
        Log.info("IndicatorRREnforcer plugin initialized - UI module requires manual inclusion in app");
        Log.info("Add this to your app.js initialization: angular.module('app').requires.push('app.settings.indicatorrrenforcer');");
    }
}
