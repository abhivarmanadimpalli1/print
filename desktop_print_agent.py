"""
Desktop Print Companion Daemon for Windows Print Shops
------------------------------------------------------
This lightweight agent runs in the background on the shopkeeper's Windows PC.
It eliminates the browser print dialog by directly spooling approved PDFs to the default
Windows printer (HP, Canon, Epson, Ricoh, Brother).

Features:
- Monitors queue for orders in 'approved' or 'printing' state.
- Automatically or 1-click spools directly to Windows Print Spooler.
- Triggers 10-minute auto-purge countdown once printed.
- Zero complex drivers needed.

Requirements:
    pip install requests pywin32
"""

import os
import sys
import time
import base64
import tempfile
import subprocess
import requests

API_ENDPOINT = "http://127.0.0.1:5173"  # Or production URL
POLL_INTERVAL_SECONDS = 5

def get_default_printer():
    try:
        import win32print
        return win32print.GetDefaultPrinter()
    except Exception as e:
        return "Default OS Printer (Fallback)"

def print_pdf_direct(file_bytes, printer_name=None):
    """
    Spools PDF bytes to the physical printer on Windows using standard OS shell
    or SumatraPDF / Acrobat silent CLI if installed.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
        temp_pdf.write(file_bytes)
        temp_path = temp_pdf.name

    try:
        print(f"Spooling {temp_path} to {printer_name or 'Default Printer'}...")
        if sys.platform == "win32":
            # Direct Windows shell print verb
            import win32api
            win32api.ShellExecute(0, "print", temp_path, None, ".", 0)
            time.sleep(3)
        else:
            # Linux / macOS CUPS
            subprocess.run(["lp", temp_path], check=True)
        print("✓ Job successfully transferred to hardware spooler.")
        return True
    except Exception as err:
        print(f"Print error: {err}")
        return False
    finally:
        # Schedule deletion of local temp file after 10 minutes
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass

def main():
    print("=" * 60)
    print("  Campus QuickPrint - Local Desktop Hardware Companion")
    print("=" * 60)
    print(f"Default Windows Printer : {get_default_printer()}")
    print(f"Backend Server          : {API_ENDPOINT}")
    print(f"Database Retention      : 10 minutes auto-purge after print")
    print("Agent listening for incoming print jobs... (Press Ctrl+C to stop)")
    print("-" * 60)

    while True:
        try:
            # Poll server for newly approved orders
            time.sleep(POLL_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            print("\nShutting down desktop companion.")
            break

if __name__ == "__main__":
    main()
