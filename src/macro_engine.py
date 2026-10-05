"""
NSM - Nexion Studio Macro
Macro Engine - High Precision Multithreaded Execution Manager
Handles concurrent macro execution, timing, anti-cheat jitter, and state management.
"""

import time
import random
import threading
import uuid
from typing import Dict, Any, Callable, Optional, List
from .win_input import WinInputEngine, high_res_sleep

class MacroRunner(threading.Thread):
    """Worker thread running an individual macro instance."""

    def __init__(self, config: Dict[str, Any], on_stats_update: Optional[Callable] = None, on_finish: Optional[Callable] = None):
        super().__init__(daemon=True)
        self.config = config
        self.macro_id = config.get("id", str(uuid.uuid4()))
        self.stop_event = threading.Event()
        self.is_running = False
        self.actions_count = 0
        self.start_time = 0.0
        self.on_stats_update = on_stats_update
        self.on_finish = on_finish
        self.held_keys = set()
        self.held_mouse_buttons = set()

    def run(self):
        self.is_running = True
        self.start_time = time.perf_counter()
        m_type = self.config.get("type", "spam")

        try:
            if m_type == "spam":
                self._run_spam()
            elif m_type == "hold":
                self._run_hold()
            elif m_type == "sequence":
                self._run_sequence()
        except Exception as e:
            print(f"[NSM Engine Error] Macro {self.macro_id} error: {e}")
        finally:
            self._cleanup_held_inputs()
            self.is_running = False
            if self.on_finish:
                self.on_finish(self.macro_id)

    def stop(self):
        self.stop_event.set()

    def _cleanup_held_inputs(self):
        """Ensure any keys/buttons pressed by this macro are cleanly released."""
        for key in list(self.held_keys):
            try:
                WinInputEngine.key_up(key)
            except Exception:
                pass
        self.held_keys.clear()

        for btn in list(self.held_mouse_buttons):
            try:
                WinInputEngine.mouse_up(btn)
            except Exception:
                pass
        self.held_mouse_buttons.clear()

    def _execute_target_press(self, target_type: str, target_key: str, hold_ms: float):
        hold_s = max(0.001, hold_ms / 1000.0)
        if target_type == "mouse":
            self.held_mouse_buttons.add(target_key)
            WinInputEngine.mouse_down(target_key)
            high_res_sleep(hold_s)
            WinInputEngine.mouse_up(target_key)
            self.held_mouse_buttons.discard(target_key)
        else:
            self.held_keys.add(target_key)
            WinInputEngine.key_down(target_key)
            high_res_sleep(hold_s)
            WinInputEngine.key_up(target_key)
            self.held_keys.discard(target_key)
        self.actions_count += 1

    def _run_spam(self):
        target_type = self.config.get("target_type", "mouse")
        target_key = self.config.get("target_key", "left")
        interval_ms = float(self.config.get("interval_ms", 50.0))
        jitter_percent = float(self.config.get("jitter_percent", 0.0))
        click_hold_ms = float(self.config.get("click_hold_ms", 5.0))
        mode = self.config.get("mode", "toggle")
        repeat_count = int(self.config.get("repeat_count", 0))
        time_limit_sec = float(self.config.get("time_limit_sec", 0.0))

        count = 0
        t0 = time.perf_counter()

        while not self.stop_event.is_set():
            # Check limits
            if mode == "repeat_count" and count >= repeat_count:
                break
            if mode == "time_limit" and (time.perf_counter() - t0) >= time_limit_sec:
                break

            # Execute action
            self._execute_target_press(target_type, target_key, click_hold_ms)
            count += 1

            if self.on_stats_update and count % 5 == 0:
                self.on_stats_update(self.macro_id, count)

            # Calculate interval with jitter
            base_s = max(0.0005, (interval_ms - click_hold_ms) / 1000.0)
            if jitter_percent > 0:
                variance = (random.random() * 2 - 1) * (jitter_percent / 100.0) * base_s
                delay = max(0.0005, base_s + variance)
            else:
                delay = base_s

            if self.stop_event.is_set():
                break
            high_res_sleep(delay)

    def _run_hold(self):
        target_type = self.config.get("target_type", "keyboard")
        target_key = self.config.get("target_key", "shift")
        hold_duration_ms = float(self.config.get("hold_duration_ms", 2000.0))
        release_delay_ms = float(self.config.get("release_delay_ms", 200.0))
        loop = bool(self.config.get("loop", True))
        repeat_count = int(self.config.get("repeat_count", 1))

        cycles = 0
        hold_s = max(0.01, hold_duration_ms / 1000.0)
        release_s = max(0.01, release_delay_ms / 1000.0)

        while not self.stop_event.is_set():
            # Press down
            if target_type == "mouse":
                self.held_mouse_buttons.add(target_key)
                WinInputEngine.mouse_down(target_key)
            else:
                self.held_keys.add(target_key)
                WinInputEngine.key_down(target_key)

            # Hold for duration while listening for stop
            t_end = time.perf_counter() + hold_s
            while time.perf_counter() < t_end:
                if self.stop_event.is_set():
                    break
                high_res_sleep(0.01)

            # Release
            if target_type == "mouse":
                WinInputEngine.mouse_up(target_key)
                self.held_mouse_buttons.discard(target_key)
            else:
                WinInputEngine.key_up(target_key)
                self.held_keys.discard(target_key)

            self.actions_count += 1
            cycles += 1
            if self.on_stats_update:
                self.on_stats_update(self.macro_id, cycles)

            if not loop or (repeat_count > 0 and cycles >= repeat_count):
                break

            # Sleep between repeat cycles
            t_end_rel = time.perf_counter() + release_s
            while time.perf_counter() < t_end_rel:
                if self.stop_event.is_set():
                    break
                high_res_sleep(0.01)

    def _run_sequence(self):
        actions = self.config.get("actions", [])
        loop = bool(self.config.get("loop", True))
        repeat_count = int(self.config.get("repeat_count", 0))

        cycles = 0
        while not self.stop_event.is_set():
            for action in actions:
                if self.stop_event.is_set():
                    break
                a_type = action.get("type", "key_press")

                if a_type == "key_press":
                    k = action.get("key", "space")
                    d = float(action.get("ms", 10.0)) / 1000.0
                    WinInputEngine.key_press(k, d)
                    self.actions_count += 1
                elif a_type == "key_down":
                    k = action.get("key", "space")
                    self.held_keys.add(k)
                    WinInputEngine.key_down(k)
                elif a_type == "key_up":
                    k = action.get("key", "space")
                    WinInputEngine.key_up(k)
                    self.held_keys.discard(k)
                elif a_type == "mouse_click":
                    b = action.get("button", "left")
                    d = float(action.get("ms", 10.0)) / 1000.0
                    WinInputEngine.mouse_click(b, d)
                    self.actions_count += 1
                elif a_type == "mouse_down":
                    b = action.get("button", "left")
                    self.held_mouse_buttons.add(b)
                    WinInputEngine.mouse_down(b)
                elif a_type == "mouse_up":
                    b = action.get("button", "left")
                    WinInputEngine.mouse_up(b)
                    self.held_mouse_buttons.discard(b)
                elif a_type == "sleep":
                    ms = float(action.get("ms", 50.0))
                    high_res_sleep(ms / 1000.0)

            cycles += 1
            if self.on_stats_update:
                self.on_stats_update(self.macro_id, cycles)

            if not loop or (repeat_count > 0 and cycles >= repeat_count):
                break

            high_res_sleep(0.01)


class MacroEngine:
    """Central engine managing all macros, threads, and safety mechanisms."""

    def __init__(self, on_state_change: Optional[Callable] = None):
        self.macros: Dict[str, Dict[str, Any]] = {}
        self.active_runners: Dict[str, MacroRunner] = {}
        self.lock = threading.Lock()
        self.on_state_change = on_state_change
        self.total_session_actions = 0

    def add_or_update_macro(self, macro_config: Dict[str, Any]) -> str:
        with self.lock:
            m_id = macro_config.get("id") or str(uuid.uuid4())
            macro_config["id"] = m_id
            self.macros[m_id] = macro_config
            return m_id

    def delete_macro(self, macro_id: str):
        with self.lock:
            self.stop_macro(macro_id)
            if macro_id in self.macros:
                del self.macros[macro_id]

    def start_macro(self, macro_id: str) -> bool:
        with self.lock:
            if macro_id in self.active_runners and self.active_runners[macro_id].is_alive():
                return False  # Already active
            
            macro_config = self.macros.get(macro_id)
            if not macro_config:
                return False

            runner = MacroRunner(
                config=macro_config,
                on_stats_update=self._handle_stats_update,
                on_finish=self._handle_macro_finished
            )
            self.active_runners[macro_id] = runner
            runner.start()

        if self.on_state_change:
            self.on_state_change(macro_id, True)
        return True

    def stop_macro(self, macro_id: str) -> bool:
        runner = None
        with self.lock:
            if macro_id in self.active_runners:
                runner = self.active_runners.pop(macro_id)

        if runner:
            runner.stop()
            if self.on_state_change:
                self.on_state_change(macro_id, False)
            return True
        return False

    def toggle_macro(self, macro_id: str) -> bool:
        is_active = self.is_macro_running(macro_id)
        if is_active:
            self.stop_macro(macro_id)
            return False
        else:
            self.start_macro(macro_id)
            return True

    def is_macro_running(self, macro_id: str) -> bool:
        with self.lock:
            runner = self.active_runners.get(macro_id)
            return bool(runner and runner.is_alive())

    def stop_all(self):
        """Panic / Emergency Killswitch: instantly stop every active macro."""
        with self.lock:
            runners = list(self.active_runners.values())
            self.active_runners.clear()

        for runner in runners:
            runner.stop()

        WinInputEngine.release_all()

        if self.on_state_change:
            self.on_state_change("__ALL__", False)

    def get_active_macro_ids(self) -> List[str]:
        with self.lock:
            return [m_id for m_id, r in self.active_runners.items() if r.is_alive()]

    def _handle_stats_update(self, macro_id: str, count: int):
        self.total_session_actions += 5

    def _handle_macro_finished(self, macro_id: str):
        with self.lock:
            if macro_id in self.active_runners:
                del self.active_runners[macro_id]
        if self.on_state_change:
            self.on_state_change(macro_id, False)
