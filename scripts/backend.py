"""Avvia manage.py caricando un file ambiente come dati, senza eseguirlo."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--env-file', default='.env')
parser.add_argument('--sqlite', action='store_true')
options, django_args = parser.parse_known_args()
root = Path(__file__).resolve().parent.parent
env_file = Path(options.env_file)
if not env_file.is_absolute():
    env_file = root / env_file
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8-sig').splitlines():
        match = re.fullmatch(r'\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)', line)
        if match:
            os.environ[match[1]] = match[2].strip()
if options.sqlite:
    os.environ.update(DB_ENGINE='sqlite', APP_ENV='development')
    os.environ.pop('REDIS_URL', None)
sys.exit(subprocess.call([sys.executable, str(root / 'backend' / 'manage.py'), *(django_args or ['check'])], cwd=root))
