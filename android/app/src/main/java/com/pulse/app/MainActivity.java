package com.pulse.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pulse.app.NotificationChannelSetupPlugin;
import com.pulse.app.TokenFlushPlugin;
import com.pulse.app.plugins.InAppUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppUpdaterPlugin.class);
        registerPlugin(TokenFlushPlugin.class);
        registerPlugin(NotificationChannelSetupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
