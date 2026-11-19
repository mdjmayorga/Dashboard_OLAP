/* =====================================================================
   PROYECTO 3 - PASO 2: VISTAS QUE ALIMENTAN EL CUBO (Data Source View)

   El cubo de Analysis Services se construye sobre estas vistas, no sobre
   las tablas directamente. Las vistas agregan lo que el DW no trae y que
   el cubo necesita para verse bien y responder las preguntas:
     - Nombres legibles (meses en espanol, "T1 2025", "Semana 05").
     - Llaves enteras unicas por nivel (mes_key = 202503), para que la
       jerarquia Anio > Trimestre > Mes > Fecha no mezcle meses de
       distintos anios.
     - Llaves unicas para Canton y Distrito (hay nombres repetidos en
       distintas provincias/cantones).
     - Bandera es_primera_sesion: permite contar pacientes nuevos vs.
       recurrentes (escenario iii).
     - Atributo periodo_reciente: "Ultimos 6 meses" (escenario viii).

   Correr DESPUES de P3_01_DW_Insumos.sql. Se puede ejecutar varias veces.
   ===================================================================== */

USE DW_TerapiaFisica;
GO

/* ---------------------------------------------------------------------
   DIMENSION TIEMPO
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_dim_tiempo
AS
WITH ultimo AS (
    -- Ultimo mes con sesiones: referencia para "Ultimos 6 meses"
    SELECT MAX(t.fecha) AS fecha_max
    FROM dbo.fact_sessions AS f
    JOIN dbo.dim_time AS t ON t.id_tiempo = f.id_tiempo
    WHERE f.id_tiempo <> -1
)
SELECT
    t.id_tiempo,
    t.fecha,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE CONVERT(NVARCHAR(10), t.fecha, 23) END                  AS fecha_nombre,

    -- Anio
    t.anio                                                             AS anio_key,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE CAST(t.anio AS NVARCHAR(4)) END                          AS anio_nombre,

    -- Trimestre (unico por anio)
    CASE WHEN t.id_tiempo = -1 THEN -1 ELSE t.anio * 10 + t.Trimestre END AS trimestre_key,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE N'T' + CAST(t.Trimestre AS NVARCHAR(1)) + N' ' + CAST(t.anio AS NVARCHAR(4)) END
                                                                       AS trimestre_nombre,

    -- Mes (unico por anio)
    CASE WHEN t.id_tiempo = -1 THEN -1 ELSE t.anio * 100 + t.Mes END   AS mes_key,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE CHOOSE(t.Mes, N'Enero', N'Febrero', N'Marzo', N'Abril', N'Mayo', N'Junio',
                     N'Julio', N'Agosto', N'Setiembre', N'Octubre', N'Noviembre', N'Diciembre')
              + N' ' + CAST(t.anio AS NVARCHAR(4)) END                 AS mes_nombre,

    -- Mes del anio sin anio (estacionalidad, escenario vi)
    t.Mes                                                              AS mes_numero,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE CHOOSE(t.Mes, N'Ene', N'Feb', N'Mar', N'Abr', N'May', N'Jun',
                     N'Jul', N'Ago', N'Set', N'Oct', N'Nov', N'Dic') END AS mes_del_anio,

    -- Trimestre del anio sin anio (estacionalidad)
    t.Trimestre                                                        AS trimestre_numero,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE N'T' + CAST(t.Trimestre AS NVARCHAR(1)) END              AS trimestre_del_anio,

    -- Semana ISO del anio (escenario xii)
    ISNULL(t.Semana, 0)                                                AS semana_numero,
    CASE WHEN t.id_tiempo = -1 THEN N'Desconocido'
         ELSE N'Semana ' + RIGHT(N'0' + CAST(t.Semana AS NVARCHAR(2)), 2) END AS semana_nombre,

    -- Periodo reciente (escenario viii): se recalcula cada vez que se procesa el cubo
    CASE
        WHEN t.id_tiempo = -1 OR u.fecha_max IS NULL THEN N'Desconocido'
        WHEN t.fecha >  EOMONTH(u.fecha_max)                         THEN N'Futuro'
        WHEN t.fecha >= DATEADD(MONTH, -5, DATEFROMPARTS(YEAR(u.fecha_max), MONTH(u.fecha_max), 1))
                                                                     THEN N'Ultimos 6 meses'
        ELSE N'Anterior'
    END                                                                AS periodo_reciente
FROM dbo.dim_time AS t
CROSS JOIN ultimo AS u;
GO

/* ---------------------------------------------------------------------
   DIMENSION PACIENTE
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_dim_paciente
AS
SELECT
    p.id_paciente,
    p.nombre,
    ISNULL(p.sexo, N'Desconocido')                         AS sexo,
    ISNULL(p.grupo_etario, N'Desconocido')                 AS grupo_etario,
    ISNULL(p.provincia, N'Desconocido')                    AS provincia,
    ISNULL(p.provincia, N'?') + N' | ' + ISNULL(p.canton, N'?')
                                                           AS canton_key,
    ISNULL(p.canton, N'Desconocido')                       AS canton,
    ISNULL(p.provincia, N'?') + N' | ' + ISNULL(p.canton, N'?') + N' | ' + ISNULL(p.distrito, N'?')
                                                           AS distrito_key,
    ISNULL(p.distrito, N'Desconocido')                     AS distrito
FROM dbo.dim_paciente AS p;
GO

/* ---------------------------------------------------------------------
   DIMENSION SERVICIO
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_dim_servicio
AS
SELECT
    s.id_servicio,
    s.nombre_servicio,
    ISNULL(s.tipo_servicio, N'Desconocido')  AS tipo_servicio,
    s.descripcion,
    s.precio_base
FROM dbo.dim_servicio AS s;
GO

/* ---------------------------------------------------------------------
   DIMENSION INSUMO
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_dim_insumo
AS
SELECT
    i.id_insumo,
    i.nombre,
    i.tipo,
    i.unidad_medida,
    i.costo_unitario
FROM dbo.dim_insumo AS i;
GO

/* ---------------------------------------------------------------------
   HECHOS: SESIONES
   es_primera_sesion = 1 en la primera sesion historica de cada paciente.
   Sumada en un periodo da los "pacientes nuevos" de ese periodo.
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_fact_sesiones
AS
SELECT
    f.id_session,
    f.id_paciente,
    f.id_tiempo,
    f.id_servicio,
    f.monto_ingreso,
    ISNULL(f.duracion_sesion, 0) AS duracion_sesion,
    CASE
        WHEN f.id_paciente <> -1
         AND ROW_NUMBER() OVER (PARTITION BY f.id_paciente
                                ORDER BY f.id_tiempo, f.id_session) = 1
        THEN 1 ELSE 0
    END AS es_primera_sesion
FROM dbo.fact_sessions AS f;
GO

/* ---------------------------------------------------------------------
   HECHOS: USO DE INSUMOS (tabla puente)
   --------------------------------------------------------------------- */
CREATE OR ALTER VIEW dbo.vw_fact_uso_insumo
AS
SELECT
    b.id_session,
    b.id_insumo,
    b.id_servicio,
    b.id_tiempo,
    b.id_paciente,
    b.cantidad_utilizada,
    b.factor_distribucion,
    b.costo_registrado
FROM dbo.bridge_sesion_insumo AS b;
GO

/* ---------------------------------------------------------------------
   VERIFICACION
   --------------------------------------------------------------------- */
SELECT TOP 5 * FROM dbo.vw_dim_tiempo WHERE periodo_reciente = N'Ultimos 6 meses' ORDER BY id_tiempo DESC;
SELECT periodo_reciente, MIN(fecha) AS desde, MAX(fecha) AS hasta
FROM dbo.vw_dim_tiempo GROUP BY periodo_reciente;
SELECT SUM(es_primera_sesion) AS pacientes_con_primera_sesion,
       (SELECT COUNT(DISTINCT id_paciente) FROM dbo.fact_sessions WHERE id_paciente <> -1) AS pacientes_distintos
FROM dbo.vw_fact_sesiones;   -- ambos numeros deben ser iguales
GO
