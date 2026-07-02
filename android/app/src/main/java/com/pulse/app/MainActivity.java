package com.pulse.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.pulse.app.plugins.InAppUpdaterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
