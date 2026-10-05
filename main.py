"""
NSM - Nexion Studio Macro
Main Application Entry Point
Initializes PyWebView window, native input engines, and API bridge.
Includes crash logging and multi-path asset resolution.
"""

import os
import sys
import time
import pathlib
import traceback
import threading
import ctypes
import webview
from src.app_api import NSMAppAPI, APPDATA_DIR

DEBUG_LOG_FILE = os.path.join(APPDATA_DIR, "nsm_debug.log")

def log_debug(msg: str):
    """Write timestamped diagnostic line to user log file."""
    try:
        os.makedirs(APPDATA_DIR, exist_ok=True)
        with open(DEBUG_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
    except Exception:
        pass

def handle_fatal_exception(exc_type, exc_val, exc_tb):
    """Global crash handler writing to log and alerting user."""
    err = "".join(traceback.format_exception(exc_type, exc_val, exc_tb))
    log_debug(f"FATAL UNHANDLED EXCEPTION:\n{err}")
    try:
        ctypes.windll.user32.MessageBoxW(
            0,
            f"NSM a rencontré une erreur inattendue au démarrage:\n\n{exc_val}\n\nUn rapport a été consigné dans:\n{DEBUG_LOG_FILE}",
            "NSM - Erreur Critique",
            0x10
        )
    except Exception:
        pass
    if sys.__excepthook__:
        sys.__excepthook__(exc_type, exc_val, exc_tb)

sys.excepthook = handle_fatal_exception
if hasattr(threading, "excepthook"):
    threading.excepthook = lambda args: handle_fatal_exception(args.exc_type, args.exc_value, args.exc_traceback)

def get_asset_path(relative_path: str) -> str:
    """Retrieve absolute path for assets across dev, PyInstaller bundle, and executable directory."""
    candidates = []

    # 1. PyInstaller MEIPASS
    if hasattr(sys, "_MEIPASS"):
        candidates.append(os.path.join(sys._MEIPASS, relative_path))

    # 2. Directory containing main.py
    main_dir = os.path.abspath(os.path.dirname(__file__))
    candidates.append(os.path.join(main_dir, relative_path))

    # 3. Directory containing sys.executable
    exe_dir = os.path.abspath(os.path.dirname(sys.executable))
    candidates.append(os.path.join(exe_dir, relative_path))
    candidates.append(os.path.join(exe_dir, "_internal", relative_path))

    for p in candidates:
        if os.path.exists(p):
            return p

    # Fallback to candidate 0 or 1
    return candidates[0] if candidates else relative_path

def main():
    log_debug("NSM application starting...")
    api = NSMAppAPI()

    html_file = get_asset_path(os.path.join("web", "index.html"))
    icon_file = get_asset_path(os.path.join("assets", "logo.ico"))

    if not os.path.exists(html_file):
        log_debug(f"ERROR: HTML entry file not found at: {html_file}")
        raise FileNotFoundError(f"Fichier d'interface introuvable: {html_file}")

    file_url = pathlib.Path(html_file).resolve().as_uri()
    log_debug(f"Loading UI from: {file_url}")

    # Create native WebView2 window
    window = webview.create_window(
        title="NSM - Nexion Studio Macro",
        url=file_url,
        js_api=api,
        width=1080,
        height=760,
        min_size=(850, 600),
        background_color="#080a0f"
    )

    api.set_window(window)
    log_debug("Window created successfully. Launching PyWebView loop...")

    # Launch PyWebView with Chromium (WebView2), with fallback if needed
    try:
        webview.start(debug=False, gui="edgechromium")
    except Exception as e:
        log_debug(f"edgechromium start failed: {e}. Attempting default GUI fallback...")
        webview.start(debug=False)

    log_debug("NSM application exited normally.")

if __name__ == "__main__":
    main()
