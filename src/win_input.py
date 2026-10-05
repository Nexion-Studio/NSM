"""
NSM - Nexion Studio Macro
Win32 Low-Level SendInput Engine
Provides ultra-low latency, hardware-scancode backed keyboard and mouse simulation.
Works flawlessly in games (DirectX, RawInput) and standard desktop apps.
"""

import ctypes
from ctypes import wintypes
import time

user32 = ctypes.windll.user32
winmm = ctypes.windll.winmm

# Win32 Constants
INPUT_MOUSE = 0
INPUT_KEYBOARD = 1

KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
KEYEVENTF_SCANCODE = 0x0008

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_XDOWN = 0x0080
MOUSEEVENTF_XUP = 0x0100
MOUSEEVENTF_WHEEL = 0x0800

XBUTTON1 = 0x0001
XBUTTON2 = 0x0002

# Mapping for common Virtual Key codes (VK)
VK_MAP = {
    # Mouse
    'mouse_left': 0x01,
    'mouse_right': 0x02,
    'mouse_middle': 0x04,
    'mouse_x1': 0x05,
    'mouse_x2': 0x06,
    
    # Standard Keys
    'backspace': 0x08,
    'tab': 0x09,
    'enter': 0x0D,
    'return': 0x0D,
    'shift': 0x10,
    'ctrl': 0x11,
    'control': 0x11,
    'alt': 0x12,
    'pause': 0x13,
    'caps_lock': 0x14,
    'escape': 0x1B,
    'space': 0x20,
    'page_up': 0x21,
    'page_down': 0x22,
    'end': 0x23,
    'home': 0x24,
    'left': 0x25,
    'up': 0x26,
    'right': 0x27,
    'down': 0x28,
    'insert': 0x2D,
    'delete': 0x2E,

    # Numbers 0-9
    **{str(i): 0x30 + i for i in range(10)},

    # Letters A-Z
    **{chr(c): c for c in range(ord('A'), ord('Z') + 1)},
    **{chr(c).lower(): c for c in range(ord('A'), ord('Z') + 1)},

    # Function keys F1-F24
    **{f'f{i}': 0x70 + (i - 1) for i in range(1, 25)},

    # Numpad
    'numpad_0': 0x60,
    'numpad_1': 0x61,
    'numpad_2': 0x62,
    'numpad_3': 0x63,
    'numpad_4': 0x64,
    'numpad_5': 0x65,
    'numpad_6': 0x66,
    'numpad_7': 0x67,
    'numpad_8': 0x68,
    'numpad_9': 0x69,
    'multiply': 0x6A,
    'add': 0x6B,
    'separator': 0x6C,
    'subtract': 0x6D,
    'decimal': 0x6E,
    'divide': 0x6F,
}

# Ctypes Structure definitions
ULONG_PTR = wintypes.WPARAM

class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]

class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD),
    ]

class _INPUT_UNION(ctypes.Union):
    _fields_ = [
        ("mi", MOUSEINPUT),
        ("ki", KEYBDINPUT),
        ("hi", HARDWAREINPUT),
    ]

class INPUT(ctypes.Structure):
    _fields_ = [
        ("type", wintypes.DWORD),
        ("union", _INPUT_UNION),
    ]

LPINPUT = ctypes.POINTER(INPUT)
SendInput = user32.SendInput
SendInput.argtypes = [wintypes.UINT, LPINPUT, ctypes.c_int]
SendInput.restype = wintypes.UINT

MapVirtualKeyW = user32.MapVirtualKeyW
MapVirtualKeyW.argtypes = [wintypes.UINT, wintypes.UINT]
MapVirtualKeyW.restype = wintypes.UINT

# Enable high precision timer resolution (1ms) across the process
winmm.timeBeginPeriod(1)

def high_res_sleep(duration_seconds: float):
    """
    Sub-millisecond hybrid sleep:
    Sleeps for coarse duration, then spins on perf_counter for ultra-precise timing.
    """
    if duration_seconds <= 0:
        return
    t_end = time.perf_counter() + duration_seconds
    # Coarse sleep if more than 3ms remaining
    while True:
        remaining = t_end - time.perf_counter()
        if remaining <= 0:
            break
        if remaining > 0.003:
            time.sleep(remaining - 0.002)
        else:
            # Spin-wait the last 2ms for microsecond precision
            while time.perf_counter() < t_end:
                pass
            break

VkKeyScanW = user32.VkKeyScanW
VkKeyScanW.argtypes = [wintypes.WCHAR]
VkKeyScanW.restype = wintypes.SHORT

class WinInputEngine:
    """Provides low-level mouse and keyboard actions via Win32 SendInput."""

    @staticmethod
    def get_vk(key_name: str) -> int:
        norm = str(key_name).strip().lower()
        if norm in VK_MAP:
            return VK_MAP[norm]
        # Fallback to Win32 VkKeyScanW for characters not explicitly in VK_MAP (e.g. è, é, _, &, accents, symbols)
        if len(key_name) == 1:
            res = VkKeyScanW(key_name)
            if res != -1:
                return res & 0xFF
        return 0

    @staticmethod
    def get_scancode(vk: int) -> int:
        return MapVirtualKeyW(vk, 0)

    @staticmethod
    def key_down(key_name: str):
        vk = WinInputEngine.get_vk(key_name)
        if not vk:
            return
        scan = WinInputEngine.get_scancode(vk)
        flags = KEYEVENTF_SCANCODE
        # Extended key check (arrows, insert, delete, home, end, etc.)
        if vk in (0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x6F):
            flags |= KEYEVENTF_EXTENDEDKEY

        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp.union.ki = KEYBDINPUT(
            wVk=vk,
            wScan=scan,
            dwFlags=flags,
            time=0,
            dwExtraInfo=0
        )
        SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    @staticmethod
    def key_up(key_name: str):
        vk = WinInputEngine.get_vk(key_name)
        if not vk:
            return
        scan = WinInputEngine.get_scancode(vk)
        flags = KEYEVENTF_SCANCODE | KEYEVENTF_KEYUP
        if vk in (0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x6F):
            flags |= KEYEVENTF_EXTENDEDKEY

        inp = INPUT()
        inp.type = INPUT_KEYBOARD
        inp.union.ki = KEYBDINPUT(
            wVk=vk,
            wScan=scan,
            dwFlags=flags,
            time=0,
            dwExtraInfo=0
        )
        SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    @staticmethod
    def key_press(key_name: str, hold_duration: float = 0.005):
        WinInputEngine.key_down(key_name)
        high_res_sleep(hold_duration)
        WinInputEngine.key_up(key_name)

    @staticmethod
    def mouse_down(button: str = 'left'):
        button = button.lower()
        flags = 0
        data = 0
        if button == 'left':
            flags = MOUSEEVENTF_LEFTDOWN
        elif button == 'right':
            flags = MOUSEEVENTF_RIGHTDOWN
        elif button == 'middle':
            flags = MOUSEEVENTF_MIDDLEDOWN
        elif button in ('x1', 'mouse4', 'back'):
            flags = MOUSEEVENTF_XDOWN
            data = XBUTTON1
        elif button in ('x2', 'mouse5', 'forward'):
            flags = MOUSEEVENTF_XDOWN
            data = XBUTTON2
        else:
            flags = MOUSEEVENTF_LEFTDOWN

        inp = INPUT()
        inp.type = INPUT_MOUSE
        inp.union.mi = MOUSEINPUT(
            dx=0, dy=0,
            mouseData=data,
            dwFlags=flags,
            time=0,
            dwExtraInfo=0
        )
        SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    @staticmethod
    def mouse_up(button: str = 'left'):
        button = button.lower()
        flags = 0
        data = 0
        if button == 'left':
            flags = MOUSEEVENTF_LEFTUP
        elif button == 'right':
            flags = MOUSEEVENTF_RIGHTUP
        elif button == 'middle':
            flags = MOUSEEVENTF_MIDDLEUP
        elif button in ('x1', 'mouse4', 'back'):
            flags = MOUSEEVENTF_XUP
            data = XBUTTON1
        elif button in ('x2', 'mouse5', 'forward'):
            flags = MOUSEEVENTF_XUP
            data = XBUTTON2
        else:
            flags = MOUSEEVENTF_LEFTUP

        inp = INPUT()
        inp.type = INPUT_MOUSE
        inp.union.mi = MOUSEINPUT(
            dx=0, dy=0,
            mouseData=data,
            dwFlags=flags,
            time=0,
            dwExtraInfo=0
        )
        SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    @staticmethod
    def mouse_click(button: str = 'left', hold_duration: float = 0.005):
        WinInputEngine.mouse_down(button)
        high_res_sleep(hold_duration)
        WinInputEngine.mouse_up(button)

    @staticmethod
    def mouse_double_click(button: str = 'left', delay_between: float = 0.04):
        WinInputEngine.mouse_click(button)
        high_res_sleep(delay_between)
        WinInputEngine.mouse_click(button)

    @staticmethod
    def release_all():
        """Emergency release of mouse buttons and common modifier keys."""
        for btn in ['left', 'right', 'middle', 'x1', 'x2']:
            WinInputEngine.mouse_up(btn)
        for key in ['shift', 'ctrl', 'alt', 'space']:
            WinInputEngine.key_up(key)
