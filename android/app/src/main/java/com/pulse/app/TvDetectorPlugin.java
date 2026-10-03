package com.pulse.app;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TvDetector")
public class TvDetectorPlugin extends Plugin {

    @PluginMethod
    public void isTV(PluginCall call) {
        UiModeManager uiModeManager =
                (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        boolean isTV = uiModeManager != null
                && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        JSObject ret = new JSObject();
        ret.put("isTV", isTV);
        call.resolve(ret);
    }
}
