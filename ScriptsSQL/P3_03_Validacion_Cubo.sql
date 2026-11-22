/* =====================================================================
   PROYECTO 3 - PASO 3: NUMEROS DE CONTROL PARA VALIDAR EL CUBO

   Correr despues de procesar el cubo y comparar cada resultado con lo
   que muestra el Browser del cubo (o Excel). Si coinciden, el cubo esta
   bien construido. Sirven tambien como evidencia en el PDF.
   ===================================================================== */

USE DW_TerapiaFisica;
GO

-- 1. Totales generales  (Browser: solo las medidas, sin dimensiones)
SELECT
    COUNT(*)                         AS cantidad_sesiones,
    SUM(monto_ingreso)               AS ingreso,
    SUM(duracion_sesion)             AS duracion_total,
    COUNT(DISTINCT id_paciente)      AS pacientes_atendidos
FROM dbo.fact_sessions;

-- 2. Por anio  (Browser: Tiempo.Calendario a nivel Anio)
SELECT t.anio,
       COUNT(*)                    AS sesiones,
       SUM(f.monto_ingreso)        AS ingreso,
       COUNT(DISTINCT f.id_paciente) AS pacientes
FROM dbo.fact_sessions f
JOIN dbo.dim_time t ON t.id_tiempo = f.id_tiempo
GROUP BY t.anio ORDER BY t.anio;

-- 3. Pacientes nuevos por anio  (medida Pacientes Nuevos)
SELECT t.anio, SUM(v.es_primera_sesion) AS pacientes_nuevos
FROM dbo.vw_fact_sesiones v
JOIN dbo.dim_time t ON t.id_tiempo = v.id_tiempo
GROUP BY t.anio ORDER BY t.anio;

-- 4. Sesiones e ingreso por tipo de servicio  (Servicio.Tipo Servicio)
SELECT s.tipo_servicio, COUNT(*) AS sesiones, SUM(f.monto_ingreso) AS ingreso,
       CAST(SUM(f.monto_ingreso) / COUNT(*) AS DECIMAL(12,2)) AS ingreso_promedio
FROM dbo.fact_sessions f
JOIN dbo.dim_servicio s ON s.id_servicio = f.id_servicio
GROUP BY s.tipo_servicio ORDER BY sesiones DESC;

-- 5. Pacientes e ingreso por provincia  (Paciente.Geografia)
SELECT p.provincia, COUNT(DISTINCT f.id_paciente) AS pacientes, SUM(f.monto_ingreso) AS ingreso
FROM dbo.fact_sessions f
JOIN dbo.dim_paciente p ON p.id_paciente = f.id_paciente
GROUP BY p.provincia ORDER BY ingreso DESC;

-- 6. Ingreso de los ultimos 6 meses por tipo de servicio  (atributo Periodo Reciente)
SELECT s.tipo_servicio, SUM(f.monto_ingreso) AS ingreso_ult_6_meses
FROM dbo.fact_sessions f
JOIN dbo.vw_dim_tiempo t ON t.id_tiempo = f.id_tiempo
JOIN dbo.dim_servicio s  ON s.id_servicio = f.id_servicio
WHERE t.periodo_reciente = N'Ultimos 6 meses'
GROUP BY s.tipo_servicio ORDER BY ingreso_ult_6_meses DESC;
GO
