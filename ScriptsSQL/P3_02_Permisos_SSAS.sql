/* =====================================================================
   PROYECTO 3 - PASO 2: PERMISO DE LECTURA PARA ANALYSIS SERVICES

   Al procesar el cubo, Analysis Services se conecta a DW_TerapiaFisica
   con la cuenta de su servicio (opcion "Use the service account" del
   Data Source). Si esa cuenta no tiene login en SQL Server, el
   procesamiento falla con "Login failed for user 'NT Service\...'".

   Instancia por defecto de SSAS : NT SERVICE\MSSQLServerOLAPService
   Instancia con nombre (ej. OLAP): NT SERVICE\MSOLAP$OLAP
   -> Cambiar @cuenta si su instancia de SSAS tiene nombre.
      (Ver el nombre exacto en services.msc -> SQL Server Analysis
       Services -> Propiedades -> Iniciar sesion.)
   ===================================================================== */

DECLARE @cuenta SYSNAME = N'NT SERVICE\MSSQLServerOLAPService';
DECLARE @sql NVARCHAR(MAX);

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @cuenta)
BEGIN
    SET @sql = N'CREATE LOGIN ' + QUOTENAME(@cuenta) + N' FROM WINDOWS;';
    EXEC (@sql);
END;

SET @sql = N'
USE DW_TerapiaFisica;
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N''' + REPLACE(@cuenta, '''', '''''') + N''')
    CREATE USER ' + QUOTENAME(@cuenta) + N' FOR LOGIN ' + QUOTENAME(@cuenta) + N';
ALTER ROLE db_datareader ADD MEMBER ' + QUOTENAME(@cuenta) + N';';
EXEC (@sql);
GO

-- Verificacion
USE DW_TerapiaFisica;
SELECT dp.name AS usuario, r.name AS rol
FROM sys.database_role_members AS m
JOIN sys.database_principals AS dp ON dp.principal_id = m.member_principal_id
JOIN sys.database_principals AS r  ON r.principal_id  = m.role_principal_id
WHERE dp.name LIKE N'NT SERVICE\%';
GO
