@echo off
chcp 65001 >nul
echo 데이터베이스 구성 중

set DB_NAME=sendbox
set DB_USER=postgres

set /p DB_PASSWORD="pw: "

set PGPASSWORD=%DB_PASSWORD%

psql -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;"

psql -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;"

psql -U %DB_USER% -d %DB_NAME% -f schema.sql --set client_encoding=UTF8

set PGPASSWORD=

echo.
echo 끝
echo.
pause
