"""
NSM - Nexion Studio Macro
Main Application Entry Point
Initializes PyWebView window, native input engines, and API bridge.
"""

import os
import sys
import webview
from src.app_api import NSMAppAPI

def get_asset_path(relative_path: str) -> str:
    """Retrieve absolute path for assets whether in dev or PyInstaller bundle."""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath(os.path.dirname(__file__)), relative_path)

def main():
    api = NSMAppAPI()

    html_file = get_asset_path(os.path.join("web", "index.html"))
    icon_file = get_asset_path(os.path.join("assets", "logo.ico"))

    # Create native WebView2 window
    window = webview.create_window(
        title="NSM - Nexion Studio Macro",
        url=f"file:///{os.path.abspath(html_file).replace(os.sep, '/')}",
        js_api=api,
        width=1080,
        height=760,
        min_size=(850, 600),
        background_color="#080a0f",
        text_select=False,
    )

    api.set_window(window)

    # Launch PyWebView with Chromium (WebView2)
    webview.start(debug=False, gui="edgechromium")

if __name__ == "__main__":
    main()
