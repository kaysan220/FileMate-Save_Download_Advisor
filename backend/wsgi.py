# =====================================================================
# TITIK MASUK SERVER FILEMATE
#   Pengembangan : python backend/wsgi.py   -> http://127.0.0.1:5000
#   Produksi     : gunicorn --chdir backend -w 1 --threads 4 -b 127.0.0.1:5000 wsgi:app
#                  (1 worker karena state sesi simulasi disimpan di memori)
# =====================================================================
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app  # noqa: E402  (backend/app/, bukan app.py di root)

app = create_app()

if __name__ == "__main__":
    print("====================================================")
    print(" Server FileMate aktif di http://127.0.0.1:5000")
    print("====================================================")
    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
