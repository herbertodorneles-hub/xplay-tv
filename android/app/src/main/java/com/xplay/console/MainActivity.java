package com.xplay.console;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // TV: não deixar a tela apagar / protetor de tela durante o jogo
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Botão Voltar do controle remoto: pausa/volta dentro do jogo; só sai no menu principal
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    MainActivity.this.finish();
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return window.__tvBack?window.__tvBack():false}catch(e){return false}})()",
                    value -> {
                        if (!"true".equals(value)) {
                            MainActivity.this.finish();
                        }
                    }
                );
            }
        });
    }
}
