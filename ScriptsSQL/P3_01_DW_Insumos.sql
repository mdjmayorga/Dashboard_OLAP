/* =====================================================================
   PROYECTO 3 - PASO 1: DIMENSION INSUMO Y TABLA PUENTE SESION-INSUMO

   Por que: el esquema del Proyecto 1 incluye dim_insumo y
   Bridge_Sesion_Insumo, pero el DW del Proyecto 2 solo cargo
   dim_paciente, dim_servicio, dim_time y fact_sessions. Sin estas tablas
   el cubo no puede responder los escenarios xv, xvi y xviii (insumos).

   Correr DESPUES de que el ETL del Proyecto 2 haya cargado fact_sessions
   (CargaInicial -> CargaTerapiaFisicaDW -> CargaStagingADW).

   La tabla puente guarda, ademas de id_session e id_insumo, las llaves
   id_servicio, id_tiempo e id_paciente copiadas de fact_sessions. Asi el
   grupo de medidas "Uso Insumo" se relaciona directamente con las
   dimensiones Servicio, Tiempo y Paciente en el cubo, sin necesidad de
   relaciones referenciadas.

   Se puede ejecutar varias veces: solo inserta lo que falta.
   ===================================================================== */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

USE DW_TerapiaFisica;
GO

/* ---------------------------------------------------------------------
   0. VALIDACION: el DW ya debe tener hechos cargados
   --------------------------------------------------------------------- */
IF NOT EXISTS (SELECT 1 FROM dbo.fact_sessions)
    THROW 50001, 'fact_sessions esta vacia: correr primero el ETL del Proyecto 2.', 1;
GO

/* ---------------------------------------------------------------------
   1. DIMENSION INSUMO
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.dim_insumo', 'U') IS NULL
    CREATE TABLE dbo.dim_insumo (
        id_insumo       INT IDENTITY(1,1) NOT NULL,
        id_insumo_oltp  INT            NULL,      -- llave en la OLTP
        nombre          NVARCHAR(80)   NOT NULL,
        tipo            NVARCHAR(30)   NOT NULL,
        unidad_medida   NVARCHAR(20)   NULL,
        costo_unitario  DECIMAL(10,2)  NULL,

        CONSTRAINT PK_dim_insumo PRIMARY KEY (id_insumo)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_dim_insumo_id_oltp')
    CREATE UNIQUE INDEX UX_dim_insumo_id_oltp
        ON dbo.dim_insumo (id_insumo_oltp)
        WHERE id_insumo_oltp IS NOT NULL;
GO

-- Miembro desconocido
IF NOT EXISTS (SELECT 1 FROM dbo.dim_insumo WHERE id_insumo = -1)
BEGIN
    SET IDENTITY_INSERT dbo.dim_insumo ON;
    INSERT INTO dbo.dim_insumo (id_insumo, id_insumo_oltp, nombre, tipo, unidad_medida, costo_unitario)
    VALUES (-1, NULL, N'Desconocido', N'Desconocido', NULL, 0);
    SET IDENTITY_INSERT dbo.dim_insumo OFF;
END;
GO

-- Carga desde la OLTP (solo insumos nuevos), con limpieza basica
INSERT INTO dbo.dim_insumo (id_insumo_oltp, nombre, tipo, unidad_medida, costo_unitario)
SELECT
    i.id_insumo,
    LTRIM(RTRIM(i.nombre)),
    ISNULL(LTRIM(RTRIM(ti.nombre)), N'Sin tipo'),
    LTRIM(RTRIM(i.unidad_medida)),
    i.costo_unitario
FROM MelaniaMenaOperacional.dbo.Insumo AS i
LEFT JOIN MelaniaMenaOperacional.dbo.Tipo_Insumo AS ti
       ON ti.id_tipo_insumo = i.id_tipo_insumo
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.dim_insumo AS d WHERE d.id_insumo_oltp = i.id_insumo
);
GO

/* ---------------------------------------------------------------------
   2. TABLA PUENTE SESION - INSUMO
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.bridge_sesion_insumo', 'U') IS NULL
    CREATE TABLE dbo.bridge_sesion_insumo (
        id_session           INT            NOT NULL,
        id_insumo            INT            NOT NULL,
        -- Llaves copiadas de fact_sessions para el grupo de medidas del cubo
        id_servicio          INT            NOT NULL,
        id_tiempo            INT            NOT NULL,
        id_paciente          INT            NOT NULL,
        cantidad_utilizada   DECIMAL(10,2)  NOT NULL,
        factor_distribucion  DECIMAL(5,4)   NOT NULL,
        costo_registrado     DECIMAL(10,2)  NOT NULL,

        CONSTRAINT PK_bridge_sesion_insumo PRIMARY KEY (id_session, id_insumo),
        CONSTRAINT FK_bridge_session  FOREIGN KEY (id_session)  REFERENCES dbo.fact_sessions (id_session),
        CONSTRAINT FK_bridge_insumo   FOREIGN KEY (id_insumo)   REFERENCES dbo.dim_insumo (id_insumo),
        CONSTRAINT FK_bridge_servicio FOREIGN KEY (id_servicio) REFERENCES dbo.dim_servicio (id_servicio),
        CONSTRAINT FK_bridge_tiempo   FOREIGN KEY (id_tiempo)   REFERENCES dbo.dim_time (id_tiempo),
        CONSTRAINT FK_bridge_paciente FOREIGN KEY (id_paciente) REFERENCES dbo.dim_paciente (id_paciente)
    );
GO

-- Carga: solo usos de insumo de sesiones que ya estan en fact_sessions
INSERT INTO dbo.bridge_sesion_insumo
    (id_session, id_insumo, id_servicio, id_tiempo, id_paciente,
     cantidad_utilizada, factor_distribucion, costo_registrado)
SELECT
    f.id_session,
    ISNULL(di.id_insumo, -1),
    f.id_servicio,
    f.id_tiempo,
    f.id_paciente,
    u.cantidad_utilizada,
    u.factor_distribucion,
    u.costo_registrado
FROM MelaniaMenaOperacional.dbo.Uso_Insumo AS u
JOIN dbo.fact_sessions AS f
     ON f.id_sesion_oltp = u.id_sesion
LEFT JOIN dbo.dim_insumo AS di
     ON di.id_insumo_oltp = u.id_insumo
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.bridge_sesion_insumo AS b
    WHERE b.id_session = f.id_session
      AND b.id_insumo  = ISNULL(di.id_insumo, -1)
);
GO

/* ---------------------------------------------------------------------
   3. VERIFICACION
   --------------------------------------------------------------------- */
SELECT 'dim_insumo' AS tabla, COUNT(*) AS filas FROM dbo.dim_insumo WHERE id_insumo <> -1
UNION ALL
SELECT 'bridge_sesion_insumo', COUNT(*) FROM dbo.bridge_sesion_insumo
UNION ALL
SELECT 'Uso_Insumo (OLTP)', COUNT(*) FROM MelaniaMenaOperacional.dbo.Uso_Insumo;
-- bridge puede tener menos filas que Uso_Insumo solo si hay sesiones de la
-- OLTP que todavia no pasaron por el ETL.
GO
