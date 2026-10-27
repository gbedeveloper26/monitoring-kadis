#!/usr/bin/env bash
set -euo pipefail

database_result="$(printf "SELECT 'DB_READY' FROM dual;\nEXIT;\n" | sqlplus -s / as sysdba)"
[[ "$database_result" == *DB_READY* ]]
lsnrctl status 2>&1 | grep -qi 'freepdb1'
