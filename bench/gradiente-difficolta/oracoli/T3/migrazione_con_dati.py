#!/usr/bin/env python3
"""T3 · migrazione CON DATI: P1, P2 e i controlli M1–M3 (migrazione/migrazione.test.ts).

Scorciatoia per `shared/gate_migrazione.py --compito T3` (vedi lì il contratto JSON completo):
  python3 migrazione_con_dati.py --consegna <copia> --base <commit-baseline> \
      --database-url postgresql://.../oracolo_<prova>_migrazione --uscita <cartella>
Prerequisito: oracolo T3 e adattatore della consegna installati con shared/installa_oracolo.py.
"""
import subprocess
import sys
from pathlib import Path

script = Path(__file__).resolve().parent.parent / "shared" / "gate_migrazione.py"
sys.exit(subprocess.run([sys.executable, str(script), "--compito", "T3", *sys.argv[1:]]).returncode)
