"""
NSM - Nexion Studio Macro
App API Bridge - Connects Python Backend to pywebview JS Frontend
Handles persistence, window operations, presets, real-time telemetry, and auto-updates.
All internal engine and window attributes are prefixed with an underscore to prevent pywebview
from attempting to reflect/serialize native COM objects over the JS-Python RPC bridge.
"""

import json
import os
import sys
import threading
from typing import Dict, Any, List, Optional
import webview

from .macro_engine import MacroEngine
from .hotkey_listener import GlobalHotkeyManager
from .updater import AutoUpdater, CURRENT_VERSION

# Path for persistent config in user AppData
APPDATA_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "NexionStudio", "NSM")
CONFIG_FILE = os.path.join(APPDATA_DIR, "config.json")

DEFAULT_PRESETS = [
    {
        "id": "preset_autoclick_left",
        "name": "⚡ Autoclicker Souris Gauche (50 CPS)",
        "type": "spam",
        "enabled": True,
        "hotkey": "f6",
        "target_type": "mouse",
        "target_key": "left",
        "interval_ms": 20,
        "jitter_percent": 0,
        "click_hold_ms": 5,
        "mode": "toggle",
        "repeat_count": 0,
        "time_limit_sec": 0,
        "color": "#00f2fe"
    },
    {
        "id": "preset_human_jitter",
        "name": "🎯 Spam Humain Anti-Détection (~14 CPS)",
        "type": "spam",
        "enabled": True,
        "hotkey": "f7",
        "target_type": "mouse",
        "target_key": "left",
        "interval_ms": 70,
        "jitter_percent": 25,
        "click_hold_ms": 10,
        "mode": "toggle",
        "repeat_count": 0,
        "time_limit_sec": 0,
        "color": "#9d4edd"
    },
    {
        "id": "preset_hold_shift",
        "name": "🏃 Appui Prolongé Shift (Sprint / Sneak)",
        "type": "hold",
        "enabled": True,
        "hotkey": "f8",
        "target_type": "keyboard",
        "target_key": "shift",
        "hold_duration_ms": 5000,
        "release_delay_ms": 50,
        "loop": True,
        "repeat_count": 0,
        "color": "#00f5a0"
    },
    {
        "id": "preset_spam_e",
        "name": "⌨️ Spam Touche E (Loot / Interaction Rapide)",
        "type": "spam",
        "enabled": True,
        "hotkey": "f9",
        "target_type": "keyboard",
        "target_key": "e",
        "interval_ms": 30,
        "jitter_percent": 5,
        "click_hold_ms": 5,
        "mode": "toggle",
        "repeat_count": 0,
        "time_limit_sec": 0,
        "color": "#f72585"
    },
    {
        "id": "preset_afk_jump",
        "name": "🦘 AFK Anti-Kick (Saut toutes les 45s)",
        "type": "spam",
        "enabled": True,
        "hotkey": "f4",
        "target_type": "keyboard",
        "target_key": "space",
        "interval_ms": 45000,
        "jitter_percent": 10,
        "click_hold_ms": 50,
        "mode": "toggle",
        "repeat_count": 0,
        "time_limit_sec": 0,
        "color": "#ffbe0b"
    }
]

class NSMAppAPI:
    """API exposed to WebView JavaScript via window.pywebview.api."""

    def __init__(self):
        self._window: Optional[webview.Window] = None
        self._engine = MacroEngine(on_state_change=self._on_macro_state_change)
        self._hotkeys = GlobalHotkeyManager(
            panic_callback=self._on_panic_pressed,
            macro_toggle_callback=self._on_macro_toggle_pressed,
            macro_hold_callback=self._on_macro_hold_pressed
        )
        self._updater = AutoUpdater(on_update_found=self._on_update_found)

        self._panic_hotkey = "f10"
        self._always_on_top = False
        self._sound_enabled = True

        self._load_config()
        self._hotkeys.start()

    def set_window(self, window: webview.Window):
        self._window = window
        # Trigger background update check after 3 seconds
        self._updater.start_background_check(delay=3.0)

    def _load_config(self):
        os.makedirs(APPDATA_DIR, exist_ok=True)
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._panic_hotkey = data.get("panic_hotkey", "f10")
                    self._always_on_top = data.get("always_on_top", False)
                    self._sound_enabled = data.get("sound_enabled", True)
                    macros = data.get("macros", [])
                    for m in macros:
                        self._engine.add_or_update_macro(m)
                        self._hotkeys.register_macro(m["id"], m.get("hotkey", ""), m.get("mode", "toggle"), m.get("enabled", True))
                    self._hotkeys.set_panic_hotkey(self._panic_hotkey)
                    return
            except Exception as e:
                print(f"[NSM] Failed to load config: {e}")

        # Fallback to default presets
        for m in DEFAULT_PRESETS:
            self._engine.add_or_update_macro(dict(m))
            self._hotkeys.register_macro(m["id"], m.get("hotkey", ""), m.get("mode", "toggle"), m.get("enabled", True))
        self._hotkeys.set_panic_hotkey(self._panic_hotkey)
        self._save_config()

    def _save_config(self):
        try:
            os.makedirs(APPDATA_DIR, exist_ok=True)
            data = {
                "panic_hotkey": self._panic_hotkey,
                "always_on_top": self._always_on_top,
                "sound_enabled": self._sound_enabled,
                "macros": list(self._engine.macros.values())
            }
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[NSM] Failed to save config: {e}")

    # Callback handlers from engine, hotkeys & updater
    def _on_macro_state_change(self, macro_id: str, is_running: bool):
        if self._window:
            try:
                self._window.evaluate_js(f"window.onMacroStateChange && window.onMacroStateChange('{macro_id}', {str(is_running).lower()});")
            except Exception:
                pass

    def _on_panic_pressed(self):
        self._engine.stop_all()
        if self._window:
            try:
                self._window.evaluate_js("window.onPanicTriggered && window.onPanicTriggered();")
            except Exception:
                pass

    def _on_macro_toggle_pressed(self, macro_id: str):
        self._engine.toggle_macro(macro_id)

    def _on_macro_hold_pressed(self, macro_id: str, is_pressed: bool):
        if is_pressed:
            self._engine.start_macro(macro_id)
        else:
            self._engine.stop_macro(macro_id)

    def _on_update_found(self, update_info: Dict[str, Any]):
        if self._window:
            try:
                info_json = json.dumps(update_info)
                self._window.evaluate_js(f"window.onUpdateAvailable && window.onUpdateAvailable({info_json});")
            except Exception:
                pass

    # JS API Methods (Publicly callable from JavaScript)
    def get_initial_state(self) -> Dict[str, Any]:
        return {
            "version": CURRENT_VERSION,
            "macros": list(self._engine.macros.values()),
            "active_macro_ids": self._engine.get_active_macro_ids(),
            "panic_hotkey": self._panic_hotkey,
            "always_on_top": self._always_on_top,
            "sound_enabled": self._sound_enabled,
            "total_actions": self._engine.total_session_actions
        }

    def save_macro(self, macro_data: Dict[str, Any]) -> Dict[str, Any]:
        m_id = self._engine.add_or_update_macro(macro_data)
        self._hotkeys.register_macro(m_id, macro_data.get("hotkey", ""), macro_data.get("mode", "toggle"), macro_data.get("enabled", True))
        self._save_config()
        return {"success": True, "id": m_id}

    def delete_macro(self, macro_id: str) -> Dict[str, Any]:
        self._engine.delete_macro(macro_id)
        self._hotkeys.unregister_macro(macro_id)
        self._save_config()
        return {"success": True}

    def toggle_macro(self, macro_id: str) -> Dict[str, Any]:
        is_running = self._engine.toggle_macro(macro_id)
        return {"success": True, "is_running": is_running}

    def start_macro(self, macro_id: str) -> Dict[str, Any]:
        success = self._engine.start_macro(macro_id)
        return {"success": success}

    def stop_macro(self, macro_id: str) -> Dict[str, Any]:
        success = self._engine.stop_macro(macro_id)
        return {"success": success}

    def stop_all(self) -> Dict[str, Any]:
        self._engine.stop_all()
        return {"success": True}

    def record_hotkey(self) -> str:
        """Blocks for a brief moment waiting for user to press a key."""
        captured = []
        evt = threading.Event()

        def on_captured(key_str: str):
            captured.append(key_str)
            evt.set()

        self._hotkeys.start_recording(on_captured)
        evt.wait(timeout=10.0)  # Wait up to 10 seconds
        self._hotkeys.cancel_recording()

        if captured:
            return captured[0]
        return ""

    def cancel_record_hotkey(self) -> Dict[str, Any]:
        self._hotkeys.cancel_recording()
        return {"success": True}

    def set_panic_hotkey(self, hotkey: str) -> Dict[str, Any]:
        self._panic_hotkey = hotkey.strip().lower()
        self._hotkeys.set_panic_hotkey(self._panic_hotkey)
        self._save_config()
        return {"success": True, "panic_hotkey": self._panic_hotkey}

    def toggle_always_on_top(self) -> bool:
        self._always_on_top = not self._always_on_top
        if self._window:
            try:
                self._window.on_top = self._always_on_top
            except Exception:
                pass
        self._save_config()
        return self._always_on_top

    def toggle_sound(self) -> bool:
        self._sound_enabled = not self._sound_enabled
        self._save_config()
        return self._sound_enabled

    def reset_default_presets(self) -> Dict[str, Any]:
        self._engine.stop_all()
        for m in list(self._engine.macros.keys()):
            self._hotkeys.unregister_macro(m)
        self._engine.macros.clear()

        for m in DEFAULT_PRESETS:
            self._engine.add_or_update_macro(dict(m))
            self._hotkeys.register_macro(m["id"], m.get("hotkey", ""), m.get("mode", "toggle"), m.get("enabled", True))
        self._save_config()
        return {"success": True, "macros": list(self._engine.macros.values())}

    # Auto-Updater API
    def check_updates(self) -> Dict[str, Any]:
        return self._updater.check_for_updates()

    def start_auto_update(self, download_url: str) -> Dict[str, Any]:
        def progress_cb(percent, downloaded, total):
            if self._window:
                try:
                    self._window.evaluate_js(f"window.onUpdateProgress && window.onUpdateProgress({percent}, {downloaded}, {total});")
                except Exception:
                    pass

        def on_done():
            if self._window:
                try:
                    self._window.evaluate_js("window.onUpdateDownloaded && window.onUpdateDownloaded();")
                except Exception:
                    pass

        def _thread():
            self._updater.download_and_install(download_url, progress_callback=progress_cb, on_complete=on_done)

        t = threading.Thread(target=_thread, daemon=True)
        t.start()
        return {"success": True}

    def minimize_window(self):
        if self._window:
            self._window.minimize()

    def close_window(self):
        self._engine.stop_all()
        self._hotkeys.stop()
        if self._window:
            self._window.destroy()
        sys.exit(0)
