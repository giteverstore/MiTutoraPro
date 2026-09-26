#!/bin/sh
set -eu

escape_sql_string() {
  printf '%s' "$1" | sed "s/'/''/g"
}

admin_user="$(escape_sql_string "${YC_MYSQL_ADMIN_USER}")"
admin_password="$(escape_sql_string "${YC_MYSQL_ADMIN_PASSWORD}")"

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER '${admin_user}'@'%' IDENTIFIED BY '${admin_password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES,
  CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, SHOW VIEW, CREATE VIEW
  ON \`yc_sbx_%\`.* TO '${admin_user}'@'%' WITH GRANT OPTION;
GRANT CREATE, DROP, CREATE USER ON *.* TO '${admin_user}'@'%';
GRANT SELECT (User, Host) ON mysql.user TO '${admin_user}'@'%';
FLUSH PRIVILEGES;
SQL
