"""
NSM - Nexion Studio Macro
Global Hotkey Listener with Key Recording & Hold/Toggle Routing
Non-blocking background thread listening for global triggers and emergency killswitch.
Includes typematic repeat filtering and debounce protection.
"""

import time
import threading
from typing import Dict, Callable, Optional, Set
from pynput import keyboard

def normalize_key(key) -> str:
    """Convert a pynput key object into a clean lowercase string representation."""
    if isinstance(key, keyboard.Key):
        name = key.name.lower()
        if name in ('ctrl_l', 'ctrl_r'):
            return 'ctrl'
        if name in ('shift_l', 'shift_r'):
            return 'shift'
        if name in ('alt_l', 'alt_r', 'alt_gr'):
            return 'alt'
        return name
    elif isinstance(key, keyboard.KeyCode):
        if key.char is not None and key.char.isprintable():
            return key.char.lower()
        elif key.vk is not None:
            # Check virtual key code for F-keys (F1 = 112, F24 = 135)
            if 112 <= key.vk <= 135:
                return f"f{key.vk - 111}"
            return f"vk_{key.vk}"
    return str(key).replace("'", "").lower()


class GlobalHotkeyManager:
    """Manages global hotkey interception, macro triggers, and recording mode."""

    def __init__(self, panic_callback: Callable, macro_toggle_callback: Callable, macro_hold_callback: Callable):
        self.panic_callback = panic_callback
        self.macro_toggle_callback = macro_toggle_callback
        self.macro_hold_callback = macro_hold_callback

        self.panic_hotkey = "f10"
        self.hotkey_to_macro: Dict[str, str] = {}  # hotkey -> macro_id
        self.macro_modes: Dict[str, str] = {}      # macro_id -> mode ("toggle", "hold_key", etc.)
        self.macro_enabled: Dict[str, bool] = {}   # macro_id -> bool

        self.pressed_keys: Set[str] = set()
        self.last_toggle_time: Dict[str, float] = {}
        self.last_panic_time = 0.0

        self.recording_active = False
        self.recording_callback: Optional[Callable[[str], None]] = None

        self.listener: Optional[keyboard.Listener] = None
        self.lock = threading.Lock()

    def start(self):
        if self.listener is None or not self.listener.is_alive():
            self.listener = keyboard.Listener(on_press=self._on_press, on_release=self._on_release)
            self.listener.daemon = True
            self.listener.start()

    def stop(self):
        if self.listener:
            try:
                self.listener.stop()
            except Exception:
                pass
            self.listener = None

    def set_panic_hotkey(self, hotkey: str):
        with self.lock:
            self.panic_hotkey = hotkey.strip().lower()

    def register_macro(self, macro_id: str, hotkey: str, mode: str, enabled: bool = True):
        with self.lock:
            # Clear old bindings for this macro
            to_remove = [k for k, mid in self.hotkey_to_macro.items() if mid == macro_id]
            for k in to_remove:
                del self.hotkey_to_macro[k]

            clean_hk = hotkey.strip().lower()
            if clean_hk:
                self.hotkey_to_macro[clean_hk] = macro_id
                self.macro_modes[macro_id] = mode
                self.macro_enabled[macro_id] = enabled

    def unregister_macro(self, macro_id: str):
        with self.lock:
            to_remove = [k for k, mid in self.hotkey_to_macro.items() if mid == macro_id]
            for k in to_remove:
                del self.hotkey_to_macro[k]
            self.macro_modes.pop(macro_id, None)
            self.macro_enabled.pop(macro_id, None)
            self.last_toggle_time.pop(macro_id, None)

    def start_recording(self, callback: Callable[[str], None]):
        """Capture the next pressed hotkey combination and invoke callback."""
        with self.lock:
            self.recording_active = True
            self.recording_callback = callback

    def cancel_recording(self):
        with self.lock:
            self.recording_active = False
            self.recording_callback = None

    def _get_current_combination_str(self) -> str:
        modifiers = []
        for m in ('ctrl', 'alt', 'shift'):
            if m in self.pressed_keys:
                modifiers.append(m)

        non_modifiers = [k for k in self.pressed_keys if k not in ('ctrl', 'alt', 'shift')]
        if non_modifiers:
            # Modifiers first, then the primary key
            combo = modifiers + [non_modifiers[-1]]
            return "+".join(combo)
        elif modifiers:
            return "+".join(modifiers)
        return ""

    def _on_press(self, key):
        try:
            key_str = normalize_key(key)

            # Check for OS typematic key-repeat: if already pressed, IGNORE repeated down events!
            is_repeat = key_str in self.pressed_keys
            self.pressed_keys.add(key_str)

            combo_str = self._get_current_combination_str()

            # Check if in recording mode
            if self.recording_active:
                if key_str not in ('ctrl', 'alt', 'shift') or len(self.pressed_keys) == 1:
                    cb = self.recording_callback
                    self.recording_active = False
                    self.recording_callback = None
                    if cb:
                        cb(combo_str or key_str)
                    return

            # If it's a repeated keydown event from Windows typematic repeat, ignore it!
            if is_repeat:
                return

            now = time.perf_counter()

            # Check Emergency Panic Killswitch
            if combo_str == self.panic_hotkey or key_str == self.panic_hotkey:
                if now - self.last_panic_time > 0.25:
                    self.last_panic_time = now
                    if self.panic_callback:
                        self.panic_callback()
                return

            # Check Registered Macro Hotkeys
            with self.lock:
                macro_id = self.hotkey_to_macro.get(combo_str) or self.hotkey_to_macro.get(key_str)
                if not macro_id:
                    return

                if not self.macro_enabled.get(macro_id, True):
                    return

                mode = self.macro_modes.get(macro_id, "toggle")

            if mode == "hold_key":
                if self.macro_hold_callback:
                    self.macro_hold_callback(macro_id, True)
            else:
                # Debounce protection for toggle mode (minimum 250ms between toggles)
                last_t = self.last_toggle_time.get(macro_id, 0.0)
                if now - last_t >= 0.25:
                    self.last_toggle_time[macro_id] = now
                    if self.macro_toggle_callback:
                        self.macro_toggle_callback(macro_id)
        except Exception as e:
            pass

    def _on_release(self, key):
        try:
            key_str = normalize_key(key)
            combo_str = self._get_current_combination_str()

            # If a hold-mode macro was active for this key/combo, signal release
            with self.lock:
                macro_id = self.hotkey_to_macro.get(combo_str) or self.hotkey_to_macro.get(key_str)
                if macro_id:
                    mode = self.macro_modes.get(macro_id, "toggle")
                    if mode == "hold_key" and self.macro_hold_callback:
                        self.macro_hold_callback(macro_id, False)

            self.pressed_keys.discard(key_str)
        except Exception:
            pass
