package com.strategyquant.userplugins.indicatorrr;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

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
    private static final String PATCH_MARKER = "IndicatorRREnforcer runtime patch v2";
    private static final String LEGACY_PATCH_MARKER = "IndicatorRREnforcer runtime patch";
    private static final String TARGET_RELATIVE_PATH = "internal/extend/Snippets/SQ/ExitMethods/ProfitTarget.java";

    static volatile boolean runtimePatchApplied = false;
    static volatile String runtimePatchStatus = "not-run";

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
        patchInternalProfitTarget();
        Log.info("IndicatorRREnforcer plugin initialized");
    }

    static String getRuntimePatchStatus() {
        return runtimePatchStatus;
    }

    static boolean isRuntimePatchApplied() {
        return runtimePatchApplied;
    }

    private void patchInternalProfitTarget() {
        try {
            Path sqxRoot = Paths.get(System.getProperty("user.dir", ".")).normalize();
            Path targetFile = sqxRoot.resolve(TARGET_RELATIVE_PATH).normalize();
            Path backupFile = targetFile.resolveSibling(targetFile.getFileName().toString() + ".indicatorrr.bak");

            if (!Files.exists(targetFile)) {
                runtimePatchApplied = false;
                runtimePatchStatus = "target-missing: " + targetFile;
                Log.warn("IndicatorRREnforcer patch target missing: {}", targetFile);
                return;
            }

            String source = Files.readString(targetFile, StandardCharsets.UTF_8);
            if (source.contains(PATCH_MARKER)) {
                runtimePatchApplied = true;
                runtimePatchStatus = "already-patched";
                Log.info("IndicatorRREnforcer runtime patch already present in {}", targetFile);
                return;
            }

            if (source.contains(LEGACY_PATCH_MARKER)) {
                if (Files.exists(backupFile)) {
                    source = Files.readString(backupFile, StandardCharsets.UTF_8);
                    runtimePatchStatus = "recovered-from-legacy";
                    Log.warn("IndicatorRREnforcer detected legacy malformed patch, recovering from backup at {}", backupFile);
                } else {
                    runtimePatchApplied = false;
                    runtimePatchStatus = "legacy-patched-no-backup";
                    Log.error("IndicatorRREnforcer detected legacy patched ProfitTarget but backup is missing: {}", targetFile);
                    return;
                }
            }

            String patched = applyProfitTargetPatch(source);
            if (patched.equals(source)) {
                runtimePatchApplied = false;
                runtimePatchStatus = "patch-patterns-not-found";
                Log.warn("IndicatorRREnforcer could not find expected ProfitTarget patterns in {}", targetFile);
                return;
            }

            if (!Files.exists(backupFile)) {
                Files.writeString(backupFile, source, StandardCharsets.UTF_8);
            }

            Files.writeString(targetFile, patched, StandardCharsets.UTF_8);
            runtimePatchApplied = true;
            runtimePatchStatus = "patched";
            Log.info("IndicatorRREnforcer patched stock ProfitTarget runtime at {}", targetFile);
        } catch (Exception e) {
            runtimePatchApplied = false;
            runtimePatchStatus = "patch-failed: " + e.getMessage();
            Log.error("IndicatorRREnforcer failed to patch stock ProfitTarget runtime", e);
        }
    }

    private String applyProfitTargetPatch(String source) throws IOException {
        String eol = source.contains("\r\n") ? "\r\n" : "\n";
        String patched = source;

        if (!patched.contains("import org.jdom2.Element;")) {
            patched = replaceRequired(
                patched,
                "import com.strategyquant.tradinglib.*;" + eol + "import com.strategyquant.tradinglib.simulator.Engines;",
                "import com.strategyquant.tradinglib.*;" + eol + "import com.strategyquant.tradinglib.simulator.Engines;" + eol + "import org.jdom2.Element;"
            );
        }

        patched = replaceRequired(
            patched,
            "\t\tif(pt == openPrice || pt == Order.NOT_DEFINED) {" + eol
                + "\t\t\treturn;" + eol
                + "\t\t}" + eol + eol
                + "\t\tpt = correctSLPT(order, pt, false);",
            "\t\tif(pt == openPrice || pt == Order.NOT_DEFINED) {" + eol
                + "\t\t\treturn;" + eol
                + "\t\t}" + eol + eol
                + "\t\tpt = enforceIndicatorRr(order, strategy, pt);" + eol
                + "\t\tif(pt == Order.NOT_DEFINED) {" + eol
                + "\t\t\treturn;" + eol
                + "\t\t}" + eol + eol
                + "\t\tpt = correctSLPT(order, pt, false);"
        );

        patched = replaceRequired(
            patched,
            "\t\tpt = SQUtils.fixPrice(Strategy.getInstrumentInfo().tickStep, pt);" + eol + "\t\t" + eol + "\t\tpt = correctSLPT(order, pt, false);",
            "\t\tpt = SQUtils.fixPrice(Strategy.getInstrumentInfo().tickStep, pt);" + eol
                + "\t\tpt = enforceIndicatorRr(order, strategy, pt);" + eol
                + "\t\tif(pt == Order.NOT_DEFINED) {" + eol
                + "\t\t\treturn false;" + eol
                + "\t\t}" + eol + "\t\t" + eol
                + "\t\tpt = correctSLPT(order, pt, false);"
        );

        patched = replaceRequired(
            patched,
            "\t\t}" + eol
                + "\t\torder.setPT(pt).Send();",
            "\t\t}" + eol
                + "\t\tpt = enforceIndicatorRr(order, strategy, pt);" + eol
                + "\t\tif(pt == Order.NOT_DEFINED) {" + eol
                + "\t\t\treturn false;" + eol
                + "\t\t}" + eol
                + "\t\torder.setPT(pt).Send();"
        );

        patched = replaceRequired(
            patched,
            "\t\torder.setPT(pt).Send();" + eol + eol + "\t\tif(!shouldApplySLPTToOrder(order, strategy)) {",
            "\t\tpt = enforceIndicatorRr(order, strategy, pt);" + eol
                + "\t\tif(pt == Order.NOT_DEFINED) {" + eol
                + "\t\t\treturn false;" + eol
                + "\t\t}" + eol + eol
                + "\t\torder.setPT(pt).Send();" + eol + eol + "\t\tif(!shouldApplySLPTToOrder(order, strategy)) {"
        );

        String helperBlock = eol + "\t// " + PATCH_MARKER + eol
            + "\tprivate double enforceIndicatorRr(ILiveOrder order, StrategyBase strategy, double pt) {\r\n"
            + "\t\tIndicatorRrState state = loadIndicatorRrState(strategy);\r\n"
            + "\t\tif(!state.enabled || !state.indicatorBased) {\r\n"
            + "\t\t\treturn pt;\r\n"
            + "\t\t}\r\n\r\n"
            + "\t\tdouble entryPrice = order.isNettingMode() ? order.getLastOpenPrice() : order.getOpenPrice();\r\n"
            + "\t\tdouble slPrice = order.getSL();\r\n"
            + "\t\tif(entryPrice == Order.NOT_DEFINED || entryPrice <= 0) {\r\n"
            + "\t\t\treturn Order.NOT_DEFINED;\r\n"
            + "\t\t}\r\n"
            + "\t\tif(slPrice == Order.NOT_DEFINED) {\r\n"
            + "\t\t\ttry {\r\n"
            + "\t\t\t\tint direction = order.isLong() ? 1 : -1;\r\n"
            + "\t\t\t\tslPrice = StopLoss.evaluateFormula(strategy, order.getSymbol(), entryPrice, -direction);\r\n"
            + "\t\t\t\tif(slPrice != Order.NOT_DEFINED) {\r\n"
            + "\t\t\t\t\tslPrice = SQUtils.fixPrice(strategy.getInstrumentInfo().tickStep, slPrice);\r\n"
            + "\t\t\t\t\tslPrice = correctSLPT(order, slPrice, true);\r\n"
            + "\t\t\t\t}\r\n"
            + "\t\t\t} catch(Throwable t) {\r\n"
            + "\t\t\t\treturn Order.NOT_DEFINED;\r\n"
            + "\t\t\t}\r\n"
            + "\t\t}\r\n"
            + "\t\tif(slPrice == Order.NOT_DEFINED || slPrice == entryPrice) {\r\n"
            + "\t\t\treturn Order.NOT_DEFINED;\r\n"
            + "\t\t}\r\n\r\n"
            + "\t\tdouble slDistance = Math.abs(entryPrice - slPrice);\r\n"
            + "\t\tif(slDistance <= 0) {\r\n"
            + "\t\t\treturn Order.NOT_DEFINED;\r\n"
            + "\t\t}\r\n\r\n"
            + "\t\tboolean validDirection = order.isLong() ? pt > entryPrice : pt < entryPrice;\r\n"
            + "\t\tdouble ptDistance = validDirection ? Math.abs(pt - entryPrice) : -1.0;\r\n"
            + "\t\tdouble currentRr = (ptDistance / slDistance) * 100.0;\r\n"
            + "\t\tif(currentRr >= state.from && currentRr <= state.to) {\r\n"
            + "\t\t\treturn pt;\r\n"
            + "\t\t}\r\n\r\n"
            + "\t\tif(!state.adjustPt) {\r\n"
            + "\t\t\treturn Order.NOT_DEFINED;\r\n"
            + "\t\t}\r\n\r\n"
            + "\t\tdouble targetRr = currentRr < state.from ? state.from : state.to;\r\n"
            + "\t\tdouble targetDistance = (targetRr / 100.0) * slDistance;\r\n"
            + "\t\tdouble adjustedPt = order.isLong() ? entryPrice + targetDistance : entryPrice - targetDistance;\r\n"
            + "\t\treturn SQUtils.fixPrice(strategy.getInstrumentInfo().tickStep, adjustedPt);\r\n"
            + "\t}\r\n\r\n"
            + "\tprivate IndicatorRrState loadIndicatorRrState(StrategyBase strategy) {\r\n"
            + "\t\tIndicatorRrState state = new IndicatorRrState();\r\n"
            + "\t\ttry {\r\n"
            + "\t\t\tElement root = strategy.getStrategyXml();\r\n"
            + "\t\t\tElement slptOptions = findDescendant(root, \"SLPTOptions\");\r\n"
            + "\t\t\tif(slptOptions == null) {\r\n"
            + "\t\t\t\treturn state;\r\n"
            + "\t\t\t}\r\n"
            + "\t\t\tstate.indicatorBased = getNodeBoolean(slptOptions, \"PTIndicatorBased\", false);\r\n"
            + "\t\t\tstate.enabled = getNodeBoolean(slptOptions, \"EnforceIndicatorRRRatio\", false) && getNodeBoolean(slptOptions, \"LimitSLPTRRR\", false);\r\n"
            + "\t\t\tstate.adjustPt = getNodeBoolean(slptOptions, \"IndicatorRRAdjustPT\", false);\r\n"
            + "\t\t\tstate.from = getNodeDouble(slptOptions, \"LimitSLPTRRRFrom\", Double.NaN);\r\n"
            + "\t\t\tstate.to = getNodeDouble(slptOptions, \"LimitSLPTRRRTo\", Double.NaN);\r\n"
            + "\t\t\tif(Double.isNaN(state.from) || Double.isNaN(state.to)) {\r\n"
            + "\t\t\t\tstate.enabled = false;\r\n"
            + "\t\t\t\treturn state;\r\n"
            + "\t\t\t}\r\n"
            + "\t\t\tif(state.from <= 0 || state.to <= 0) {\r\n"
            + "\t\t\t\tstate.enabled = false;\r\n"
            + "\t\t\t\treturn state;\r\n"
            + "\t\t\t}\r\n"
            + "\t\t\tif(state.from > state.to) {\r\n"
            + "\t\t\t\tdouble tmp = state.from;\r\n"
            + "\t\t\t\tstate.from = state.to;\r\n"
            + "\t\t\t\tstate.to = tmp;\r\n"
            + "\t\t\t}\r\n"
            + "\t\t} catch(Throwable t) {\r\n"
            + "\t\t\tstate.enabled = false;\r\n"
            + "\t\t}\r\n"
            + "\t\treturn state;\r\n"
            + "\t}\r\n\r\n"
            + "\tprivate Element findDescendant(Element root, String name) {\r\n"
            + "\t\tif(root == null) {\r\n"
            + "\t\t\treturn null;\r\n"
            + "\t\t}\r\n"
            + "\t\tif(name.equals(root.getName())) {\r\n"
            + "\t\t\treturn root;\r\n"
            + "\t\t}\r\n"
            + "\t\tfor(Element child : root.getChildren()) {\r\n"
            + "\t\t\tElement found = findDescendant(child, name);\r\n"
            + "\t\t\tif(found != null) {\r\n"
            + "\t\t\t\treturn found;\r\n"
            + "\t\t\t}\r\n"
            + "\t\t}\r\n"
            + "\t\treturn null;\r\n"
            + "\t}\r\n\r\n"
            + "\tprivate boolean getNodeBoolean(Element parent, String nodeName, boolean defaultValue) {\r\n"
            + "\t\tElement node = parent.getChild(nodeName);\r\n"
            + "\t\tif(node == null) {\r\n"
            + "\t\t\treturn defaultValue;\r\n"
            + "\t\t}\r\n"
            + "\t\tString text = node.getTextTrim().toLowerCase();\r\n"
            + "\t\treturn \"true\".equals(text) || \"1\".equals(text) || \"yes\".equals(text);\r\n"
            + "\t}\r\n\r\n"
            + "\tprivate double getNodeDouble(Element parent, String nodeName, double defaultValue) {\r\n"
            + "\t\tElement node = parent.getChild(nodeName);\r\n"
            + "\t\tif(node == null) {\r\n"
            + "\t\t\treturn defaultValue;\r\n"
            + "\t\t}\r\n"
            + "\t\ttry {\r\n"
            + "\t\t\treturn Double.parseDouble(node.getTextTrim());\r\n"
            + "\t\t} catch(Exception e) {\r\n"
            + "\t\t\treturn defaultValue;\r\n"
            + "\t\t}\r\n"
            + "\t}\r\n\r\n"
            + "\tprivate static class IndicatorRrState {\r\n"
            + "\t\tboolean enabled;\r\n"
            + "\t\tboolean adjustPt;\r\n"
            + "\t\tboolean indicatorBased;\r\n"
            + "\t\tdouble from;\r\n"
            + "\t\tdouble to;\r\n"
            + "\t}\r\n";

        helperBlock = helperBlock.replace("\r\n", eol);

        patched = replaceRequired(
            patched,
            "\t@Override" + eol + "\tpublic IBlock clone(boolean includingParameters, StrategyBase strategy) throws BlockDefinitionException {",
            helperBlock + eol + "\t@Override" + eol + "\tpublic IBlock clone(boolean includingParameters, StrategyBase strategy) throws BlockDefinitionException {"
        );

        return patched;
    }

    private String replaceRequired(String source, String target, String replacement) throws IOException {
        if (!source.contains(target)) {
            throw new IOException("Required patch pattern not found");
        }
        return source.replace(target, replacement);
    }
}
