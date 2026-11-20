import os, sqlite3, sys
db_path = 'musafir.db'
if not os.path.exists(db_path):
    print('DB not found')
    sys.exit(0)
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
print('Tables:', [row[0] for row in cur.fetchall()])
conn.close()

