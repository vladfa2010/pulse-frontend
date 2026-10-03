package com.pulse.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;
import com.pulse.app.NotificationChannelSetupPlugin;
import com.pulse.app.TokenFlushPlugin;
import com.pulse.app.plugins.InAppUpdaterPlugin;
import java.lang.reflect.Method;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppUpdaterPlugin.class);
        registerPlugin(TokenFlushPlugin.class);
        registerPlugin(NotificationChannelSetupPlugin.class);
        registerPlugin(TvDetectorPlugin.class);
        super.onCreate(savedInstanceState);
        enableSpatialNavigation();
    }

    // Скрытый API WebView: включаем spatial navigation для Android TV (пульт).
    // Метод недоступен в compileSdk, поэтому вызываем через reflection.
    private void enableSpatialNavigation() {
        try {
            WebSettings settings = getBridge().getWebView().getSettings();
            Method m = WebSettings.class.getMethod("setSpatialNavigationEnabled", boolean.class);
            m.invoke(settings, true);
            Log.i(TAG, "Spatial navigation enabled");
        } catch (NoSuchMethodException e) {
            Log.w(TAG, "setSpatialNavigationEnabled not available on this WebView", e);
        } catch (Exception e) {
            Log.w(TAG, "Failed to enable spatial navigation", e);
        }
    }
}
