import sqlite3, os, sys
db_path = os.path.join(os.getcwd(), "musafir.db")
if not os.path.exists(db_path):
    print("DB file not found")
    sys.exit(1)
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print(cur.fetchall())

