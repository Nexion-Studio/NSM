"""
NSM - Nexion Studio Macro
Auto-Updater Engine
Checks GitHub Releases for new versions and downloads/installs updates automatically.
"""

import os
import sys
import json
import re
import tempfile
import urllib.request
import subprocess
import threading
from typing import Dict, Any, Optional, Callable

CURRENT_VERSION = "1.1.1"
GITHUB_REPO = "Nexion-Studio/NSM"
RELEASES_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

def parse_version(ver_str: str):
    """Convert version string like 'v1.2.3' or '1.0' into tuple of integers."""
    clean = re.sub(r"[^\d.]", "", ver_str).strip(".")
    parts = clean.split(".")
    res = []
    for p in parts:
        try:
            res.append(int(p))
        except ValueError:
            res.append(0)
    while len(res) < 3:
        res.append(0)
    return tuple(res)

class AutoUpdater:
    """Manages update checking, downloading, and background execution."""

    def __init__(self, on_update_found: Optional[Callable[[Dict[str, Any]], None]] = None):
        self.on_update_found = on_update_found
        self.is_downloading = False
        self.lock = threading.Lock()

    def check_for_updates(self) -> Dict[str, Any]:
        """Query GitHub Releases API to verify if a newer version is released."""
        try:
            req = urllib.request.Request(
                RELEASES_API_URL,
                headers={
                    "User-Agent": "NSM-AutoUpdater/1.0",
                    "Accept": "application/vnd.github.v3+json"
                }
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                if response.status != 200:
                    return {"update_available": False, "error": f"HTTP {response.status}"}
                data = json.loads(response.read().decode("utf-8"))

            tag_name = data.get("tag_name", "")
            remote_ver = parse_version(tag_name)
            curr_ver = parse_version(CURRENT_VERSION)

            # Find installer asset (.exe)
            download_url = ""
            asset_size = 0
            for asset in data.get("assets", []):
                name = asset.get("name", "").lower()
                if name.endswith(".exe") and ("setup" in name or "nsm" in name):
                    download_url = asset.get("browser_download_url")
                    asset_size = asset.get("size", 0)
                    break

            # If no specific setup found, grab the first .exe asset
            if not download_url:
                for asset in data.get("assets", []):
                    if asset.get("name", "").lower().endswith(".exe"):
                        download_url = asset.get("browser_download_url")
                        asset_size = asset.get("size", 0)
                        break

            update_available = bool(remote_ver > curr_ver and download_url)

            result = {
                "update_available": update_available,
                "current_version": CURRENT_VERSION,
                "latest_version": tag_name.lstrip("v"),
                "release_name": data.get("name") or tag_name,
                "release_notes": data.get("body", "Aucune note de version fournie."),
                "download_url": download_url,
                "asset_size": asset_size,
                "published_at": data.get("published_at", "")
            }

            if update_available and self.on_update_found:
                self.on_update_found(result)

            return result

        except Exception as e:
            return {
                "update_available": False,
                "current_version": CURRENT_VERSION,
                "error": str(e)
            }

    def start_background_check(self, delay: float = 3.0):
        """Run update check asynchronously after a brief delay."""
        def _task():
            import time
            time.sleep(delay)
            self.check_for_updates()

        t = threading.Thread(target=_task, daemon=True)
        t.start()

    def download_and_install(
        self,
        download_url: str,
        progress_callback: Optional[Callable[[int, int, int], None]] = None,
        on_complete: Optional[Callable[[], None]] = None
    ) -> bool:
        """
        Download the new installer to temp directory and execute it silently.
        Terminates the current process so the installer can update files smoothly.
        """
        with self.lock:
            if self.is_downloading:
                return False
            self.is_downloading = True

        target_file = os.path.join(tempfile.gettempdir(), "NSM_Setup_Update.exe")

        try:
            req = urllib.request.Request(download_url, headers={"User-Agent": "NSM-AutoUpdater/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                total_size = int(resp.headers.get("content-length", 0))
                downloaded = 0
                chunk_size = 65536

                with open(target_file, "wb") as out:
                    while True:
                        chunk = resp.read(chunk_size)
                        if not chunk:
                            break
                        out.write(chunk)
                        downloaded += len(chunk)
                        percent = int((downloaded / total_size) * 100) if total_size > 0 else 0
                        if progress_callback:
                            progress_callback(percent, downloaded, total_size)

            if not os.path.exists(target_file) or os.path.getsize(target_file) < 100000:
                raise ValueError("Téléchargement incomplet de l'installeur.")

            if on_complete:
                on_complete()

            # Launch installer with flags:
            # /SILENT / /VERYSILENT: Install without showing wizard steps
            # /SUPPRESSMSGBOXES: Never block or wait on message boxes
            # /CURRENTUSER: Install to user directory (no admin UAC prompt needed)
            # /NORESTART: Don't reboot PC
            # /MERGETASKS="desktopicon": Keep desktop shortcut
            install_cmd = [
                target_file,
                "/SILENT",
                "/SUPPRESSMSGBOXES",
                "/CURRENTUSER",
                "/NORESTART",
                "/MERGETASKS=desktopicon"
            ]

            subprocess.Popen(install_cmd, shell=True)

            # Exit current app immediately so the installer can overwrite NSM.exe
            threading.Timer(0.8, lambda: os._exit(0)).start()
            return True

        except Exception as e:
            print(f"[NSM AutoUpdater Error] {e}")
            with self.lock:
                self.is_downloading = False
            return False
