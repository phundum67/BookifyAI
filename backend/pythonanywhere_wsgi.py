"""
PythonAnywhere WSGI entry for the single-Flask-app version.

Use this content in the PythonAnywhere Web tab WSGI file.
Only change PROJECT_FOLDER if your uploaded folder name is different.
"""

import os
import sys


# Point this to the exact backend folder on PythonAnywhere.
# Example if your files are in /home/phundum67/Bookify/backend:
# BACKEND_PATH = "/home/phundum67/Bookify/backend"
BACKEND_PATH = "/home/phundum67/Testing tak2 1st version/backend"

if BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

os.chdir(BACKEND_PATH)

from run import app as application  # noqa: E402
