-- Ejecutar UNA sola vez, conectado como root (o un usuario con privilegios
-- de administrador) en MySQL, ANTES de correr "npm run db:init".
--
-- Cómo ejecutarlo en Windows:
--   1. Abre "MySQL Command Line Client" (o MySQL Workbench).
--   2. Inicia sesión con tu usuario root y su contraseña.
--   3. Copia y pega todo este archivo, o ejecútalo con:
--      mysql -u root -p < database/setup_usuario.sql
--
-- IMPORTANTE: cambia 'TU_CONTRASENA_AQUI' por la contraseña que quieras usar,
-- y coloca esa MISMA contraseña en el archivo .env (variable DB_PASSWORD).

CREATE DATABASE IF NOT EXISTS bd_intikilla
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'bd_intikilla'@'localhost'
  IDENTIFIED BY 'TU_CONTRASENA_AQUI';

GRANT ALL PRIVILEGES ON bd_intikilla.* TO 'bd_intikilla'@'localhost';

FLUSH PRIVILEGES;

-- Verificación rápida (opcional): debe listar la base bd_intikilla.
SHOW DATABASES LIKE 'bd_intikilla';
