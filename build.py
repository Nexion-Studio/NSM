"""
NSM - Nexion Studio Macro
Automated Release & Packaging Builder
Compiles:
1. Application Binary: dist/NSM/NSM.exe
2. Official Windows Setup Installer: dist_installer/NSM_Setup.exe
"""

import os
import sys
import subprocess
import shutil
import hashlib

ISCC_PATHS = [
    r"C:\Users\Nexion Studio\AppData\Local\Programs\Inno Setup 6\ISCC.exe",
    r"C:\Program Files\Inno Setup 6\ISCC.exe",
    r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    shutil.which("iscc") or "",
]

def find_iscc() -> str:
    for path in ISCC_PATHS:
        if path and os.path.exists(path):
            return path
    return ""

def get_file_hash(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def format_size(bytes_num: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_num < 1024.0:
            return f"{bytes_num:3.1f} {unit}"
        bytes_num /= 1024.0
    return f"{bytes_num:.1f} TB"

def build():
    print("=" * 60)
    print("   NEXION STUDIO MACRO (NSM) - COMPILATION & BUILD SYSTEM")
    print("=" * 60)

    base_dir = os.path.abspath(os.path.dirname(__file__))
    dist_dir = os.path.join(base_dir, "dist", "NSM")
    installer_dir = os.path.join(base_dir, "dist_installer")
    os.makedirs(installer_dir, exist_ok=True)

    exe_file = os.path.join(dist_dir, "NSM.exe")

    # Step 1: Compile PyInstaller executable
    print("\n[1/2] Compiling NSM application with PyInstaller...")
    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole",
        "--name", "NSM",
            "--icon", os.path.join("assets", "logo.ico"),
            "--add-data", "web;web",
            "--add-data", "assets;assets",
            "--hidden-import", "webview",
            "--hidden-import", "clr",
            "--hidden-import", "pythonnet",
            "--hidden-import", "pynput.keyboard._win32",
            "--hidden-import", "pynput.mouse._win32",
            "-y",
            "main.py"
        ]
    ret = subprocess.run(pyinstaller_cmd, cwd=base_dir)
    if ret.returncode != 0:
        print("\n[!] Error: PyInstaller compilation failed!")
        sys.exit(1)

    if not os.path.exists(exe_file):
        print(f"\n[!] Error: Executable not found at {exe_file}")
        sys.exit(1)

    print(f"  [+] Executable ready: {exe_file} ({format_size(os.path.getsize(exe_file))})")

    # Step 2: Compile Inno Setup Installer
    print("\n[2/2] Compiling Official Inno Setup Installer...")
    iscc_path = find_iscc()
    if not iscc_path:
        print("[!] Warning: Inno Setup (ISCC.exe) not found!")
        print("Please install Inno Setup 6 or run: winget install JRSoftware.InnoSetup")
        sys.exit(1)

    iss_file = os.path.join(base_dir, "installer.iss")
    iscc_cmd = [iscc_path, "/Qp", iss_file]
    ret = subprocess.run(iscc_cmd, cwd=base_dir)
    if ret.returncode != 0:
        print("\n[!] Error: Inno Setup compilation failed!")
        sys.exit(1)

    installer_file = os.path.join(installer_dir, "NSM_Setup.exe")
    if not os.path.exists(installer_file):
        print(f"\n[!] Error: Installer not found at {installer_file}")
        sys.exit(1)

    setup_size = format_size(os.path.getsize(installer_file))
    setup_sha = get_file_hash(installer_file)

    print("\n" + "=" * 60)
    print("   BUILD COMPLETE - NEXION STUDIO MACRO (NSM)")
    print("=" * 60)
    print(f"[*] Official Installer:  {installer_file}")
    print(f"    Taille:              {setup_size}")
    print(f"    SHA-256:             {setup_sha}")
    print(f"\n[*] Lanceur Exe:         {exe_file}")
    print(f"    Taille:              {format_size(os.path.getsize(exe_file))}")
    print("=" * 60)

if __name__ == "__main__":
    build()
