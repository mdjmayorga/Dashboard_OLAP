# Guía del punto 1: proyecto multidimensional de Analysis Services y cubo

> **Requerimiento 1 (20 pts):** crear un proyecto multidimensional de Analysis Services y construir el cubo que permita responder las preguntas clave de la empresa de los proyectos 1 y 2.

Las preguntas clave son los **18 escenarios de análisis (i–xviii)** del Proyecto 1. El cubo se monta sobre `DW_TerapiaFisica`, que el ETL del Proyecto 2 ya deja cargado.

---

## 0. Qué falta y qué hay que cambiar

El DW del Proyecto 2 solo tiene `dim_paciente`, `dim_servicio`, `dim_time` y `fact_sessions`. Con eso se responden 13 de los 18 escenarios. Lo que falta:

| Problema | Escenarios afectados | Arreglo | Archivo |
|---|---|---|---|
| No hay `dim_insumo` ni la tabla puente sesión-insumo del Proyecto 1 | xv, xvi, xviii | Crear y cargar `dim_insumo` y `bridge_sesion_insumo` | `ScriptsSQL/P3_01_DW_Insumos.sql` |
| No hay forma de distinguir pacientes nuevos de recurrentes | iii | Columna `es_primera_sesion` en una vista del hecho | `ScriptsSQL/P3_02_Vistas_Cubo.sql` |
| `dim_time` no tiene nombres ni llaves únicas por nivel (Mes = 1..12 se repite cada año) | i, ii, v, vi, xi, xii | Vista con `mes_key = 202503`, "Marzo 2025", "T1 2025", "Semana 05" | `P3_02_Vistas_Cubo.sql` |
| Cantón y distrito tienen nombres repetidos entre provincias | xiii, xiv | Llaves compuestas `provincia | canton | distrito` en la vista | `P3_02_Vistas_Cubo.sql` |
| "Últimos seis meses" necesita referencia relativa | viii | Atributo `Periodo Reciente` y conjunto `[Ultimos 6 Meses]` | `P3_02_Vistas_Cubo.sql` + `Cubo/Calculos_Cubo.mdx` |
| Crecimiento %, promedios, recurrentes | ii, iii, ix, x, xi | Miembros calculados MDX | `Cubo/Calculos_Cubo.mdx` |
| SSAS no puede leer el DW al procesar | — | Login para la cuenta del servicio de SSAS | `ScriptsSQL/P3_03_Permisos_SSAS.sql` |

**Escenario xvii ("insumos por cada profesional"):** la OLTP no tiene tabla de profesionales y el negocio lo atiende una sola terapeuta, así que **no se puede responder**. Hay que decirlo en el PDF y justificarlo: el diseño del Proyecto 1 no incluyó una dimensión Profesional y hoy solo hay una terapeuta. Queda como trabajo futuro si el consultorio se expande.

> Atajo consciente: `P3_01` carga los insumos con SQL directo desde la OLTP en lugar de un paquete SSIS. El Proyecto 3 no evalúa ETL. Si quieren dejarlo en SSIS, se puede pasar el mismo SELECT a un Data Flow en `CargaStagingADW.dtsx`.

---

## 1. Requisitos de software

1. **Instancia de SQL Server Analysis Services en modo Multidimensional.** Para revisar si ya existe: `services.msc` → buscar "SQL Server Analysis Services (MSSQLSERVER)". Si no está, correr el instalador de SQL Server → *Add features* → marcar **Analysis Services** → en *Analysis Services Configuration* elegir **Multidimensional and Data Mining Mode** y agregar su usuario como administrador (*Add Current User*).
   - Si la instancia que ya tienen está en modo **Tabular**, no sirve. Hay que instalar otra instancia con nombre (por ejemplo `OLAP`) en modo Multidimensional.
2. **Visual Studio 2022** con la extensión **Microsoft Analysis Services Projects 2022** (*Extensions → Manage Extensions → buscar "Analysis Services"*). Reiniciar VS.
3. **SSMS**, para los scripts y el respaldo `.abf`.

---

## 2. Preparar el DW (una sola vez)

Requisito previo: el ETL del Proyecto 2 ya corrido completo (`fact_sessions` con datos). Después, en SSMS:

| # | Script | Qué hace |
|---|---|---|
| 1 | `ScriptsSQL/P3_01_DW_Insumos.sql` | Crea y carga `dim_insumo` (49 insumos) y `bridge_sesion_insumo` (84 430 filas, igual que `Uso_Insumo` en la OLTP) |
| 2 | `ScriptsSQL/P3_02_Vistas_Cubo.sql` | Crea las 6 vistas `vw_*` que usa el cubo |
| 3 | `ScriptsSQL/P3_03_Permisos_SSAS.sql` | Da `db_datareader` a la cuenta del servicio de SSAS (**cambiar `@cuenta` si la instancia tiene nombre**) |

Revisar la verificación al final de cada script. En `P3_02`, los dos números de la última consulta deben ser iguales.

---

## 3. Crear el proyecto (nuevo, desde cero)

Es un proyecto **totalmente nuevo**, en una solución propia. No se agrega a la solución SSIS `MelaniaTerapiaFisicaDW` del Proyecto 2. Del Proyecto 2 solo se reutiliza la base `DW_TerapiaFisica` ya cargada, como origen de datos.

1. VS → *File → New → Project* → **Analysis Services Multidimensional Project** (no "Tabular", no "Integration Services").
2. Nombre del proyecto: `MelaniaTerapiaFisicaCubo`. Ubicación: la carpeta `Cubo/` de este repo. Marcar *Place solution and project in the same directory* para que quede una sola solución nueva.
3. Clic derecho en el proyecto → **Properties → Deployment**:
   - *Server*: `localhost` (o `localhost\OLAP` si la instancia tiene nombre).
   - *Database*: `MelaniaTerapiaFisicaCubo`.
   - *Processing Option*: Default.

---

## 4. Data Source

1. *Data Sources* → clic derecho → **New Data Source** → *Create a data source based on an existing or new connection* → **New**.
2. Server: `localhost`, autenticación Windows, base **`DW_TerapiaFisica`**. Provider: *Native OLE DB\Microsoft OLE DB Driver for SQL Server* (o *SQL Server Native Client 11.0*).
3. *Impersonation Information*: **Use the service account**. Por eso hace falta el script `P3_03`.
4. Nombre: `DS DW Terapia Fisica`.

---

## 5. Data Source View (DSV)

1. *Data Source Views* → **New Data Source View** → elegir el data source.
2. En *Select Tables and Views* pasar **solo las 6 vistas**: `vw_dim_tiempo`, `vw_dim_paciente`, `vw_dim_servicio`, `vw_dim_insumo`, `vw_fact_sesiones` y `vw_fact_uso_insumo`.
3. Nombre: `DSV Terapia Fisica`.
4. **Las vistas no traen llaves primarias ni relaciones, así que hay que crearlas a mano:**
   - Llave lógica: clic derecho sobre la columna → **Set Logical Primary Key**.

     | Vista | Llave lógica |
     |---|---|
     | vw_dim_tiempo | id_tiempo |
     | vw_dim_paciente | id_paciente |
     | vw_dim_servicio | id_servicio |
     | vw_dim_insumo | id_insumo |
     | vw_fact_sesiones | id_session |
     | vw_fact_uso_insumo | id_session + id_insumo (seleccionar ambas con Ctrl) |

   - Relaciones: **arrastrar la columna del hecho hacia la llave de la dimensión** (dirección hecho → dimensión):

     | Desde (hecho) | Hacia (dimensión) |
     |---|---|
     | vw_fact_sesiones.id_tiempo | vw_dim_tiempo.id_tiempo |
     | vw_fact_sesiones.id_paciente | vw_dim_paciente.id_paciente |
     | vw_fact_sesiones.id_servicio | vw_dim_servicio.id_servicio |
     | vw_fact_uso_insumo.id_tiempo | vw_dim_tiempo.id_tiempo |
     | vw_fact_uso_insumo.id_paciente | vw_dim_paciente.id_paciente |
     | vw_fact_uso_insumo.id_servicio | vw_dim_servicio.id_servicio |
     | vw_fact_uso_insumo.id_insumo | vw_dim_insumo.id_insumo |

5. (Opcional, para el PDF) En las propiedades de cada vista, cambiar *FriendlyName*: `Tiempo`, `Paciente`, `Servicio`, `Insumo`, `Sesiones`, `Uso Insumo`.

**Captura para el PDF:** diagrama del DSV con las dos estrellas.

---

## 6. Dimensiones

Para cada dimensión: *Dimensions* → **New Dimension** → *Use an existing table* → elegir la vista → *Key column* = la llave y *Name column* = la columna indicada → agregar los atributos de la tabla. Después se ajusta todo en el **Dimension Designer**.

Reglas que aplican a todas:
- Para cada atributo se configuran **KeyColumns** (qué lo identifica) y **NameColumn** (qué se muestra). Cuando la llave y el nombre son columnas distintas, en el panel *Attributes* → propiedades → `KeyColumns` / `NameColumn`.
- `OrderBy = Key` en los atributos de tiempo, para que los meses salgan en orden cronológico y no alfabético.
- En la pestaña **Attribute Relationships**, armar la cadena de la jerarquía (arrastrar del hijo al padre). Sin eso, SSAS muestra el triángulo amarillo de advertencia y las agregaciones son lentas.
- Los atributos que solo describen (precio, descripción, costo): `AttributeHierarchyEnabled = False`.

### 6.1 Dimensión **Tiempo** (`vw_dim_tiempo`)

Propiedad de la dimensión: `Type = Time` (opcional, ayuda a Excel).

| Atributo | KeyColumns | NameColumn | OrderBy | Type (opcional) |
|---|---|---|---|---|
| **Fecha** (llave) | id_tiempo | fecha_nombre | Key | Date |
| Mes | mes_key | mes_nombre | Key | Months |
| Trimestre | trimestre_key | trimestre_nombre | Key | Quarters |
| **Anio** | anio_key | anio_nombre | Key | Years |
| Mes del Anio | mes_numero | mes_del_anio | Key | MonthOfYear |
| Trimestre del Anio | trimestre_numero | trimestre_del_anio | Key | QuarterOfYear |
| Semana | semana_numero | semana_nombre | Key | WeekOfYear |
| Periodo Reciente | periodo_reciente | periodo_reciente | Name | — |

- **Jerarquía `Calendario`:** arrastrar a la zona *Hierarchies* Anio → Trimestre → Mes → Fecha. El nombre de la jerarquía y de sus niveles tiene que ser exactamente **Calendario / Anio / Trimestre / Mes / Fecha**, porque el script MDX los usa.
- **Attribute Relationships:** Fecha → Mes → Trimestre → Anio. También Fecha → Mes del Anio, Fecha → Trimestre del Anio, Fecha → Semana y Fecha → Periodo Reciente.
- Usé "Anio" en vez de "Año" para evitar problemas de codificación en MDX y Power BI. El nombre que se ve se puede cambiar después con *Translations*.

### 6.2 Dimensión **Paciente** (`vw_dim_paciente`)

| Atributo | KeyColumns | NameColumn |
|---|---|---|
| **Paciente** (llave) | id_paciente | nombre |
| Sexo | sexo | sexo |
| Grupo Etario | grupo_etario | grupo_etario |
| Provincia | provincia | provincia |
| Canton | canton_key | canton |
| Distrito | distrito_key | distrito |

- **Jerarquía `Geografia`:** Provincia → Canton → Distrito → Paciente.
- **Attribute Relationships:** Paciente → Distrito → Canton → Provincia, más Paciente → Sexo y Paciente → Grupo Etario.

### 6.3 Dimensión **Servicio** (`vw_dim_servicio`)

| Atributo | KeyColumns | NameColumn | Nota |
|---|---|---|---|
| **Servicio** (llave) | id_servicio | nombre_servicio | |
| Tipo Servicio | tipo_servicio | tipo_servicio | |
| Precio Base | precio_base | precio_base | `AttributeHierarchyEnabled = False` |
| Descripcion | id_servicio | descripcion | `AttributeHierarchyEnabled = False` |

- **Jerarquía `Servicios por Tipo`:** Tipo Servicio → Servicio.
- **Attribute Relationships:** Servicio → Tipo Servicio, Servicio → Precio Base y Servicio → Descripcion.
- El atributo llave se tiene que llamar **Servicio**, porque el MDX usa `[Servicio].[Servicio].[Servicio].Members`.

### 6.4 Dimensión **Insumo** (`vw_dim_insumo`)

| Atributo | KeyColumns | NameColumn | Nota |
|---|---|---|---|
| **Insumo** (llave) | id_insumo | nombre | |
| Tipo Insumo | tipo | tipo | |
| Unidad Medida | unidad_medida | unidad_medida | |
| Costo Unitario | costo_unitario | costo_unitario | `AttributeHierarchyEnabled = False` |

- **Jerarquía `Insumos por Tipo`:** Tipo Insumo → Insumo.
- **Attribute Relationships:** Insumo → Tipo Insumo, Insumo → Unidad Medida y Insumo → Costo Unitario.

**Captura para el PDF:** pestaña *Attribute Relationships* de cada dimensión y las jerarquías.

---

## 7. El cubo

1. *Cubes* → **New Cube** → *Use existing tables*.
2. *Measure group tables*: marcar **vw_fact_sesiones** y **vw_fact_uso_insumo**.
3. Dejar que el asistente proponga medidas y después ajustarlas en la pestaña **Cube Structure** como se indica abajo.
4. *Existing dimensions*: marcar las 4. Si el asistente ofrece crear dimensiones nuevas a partir de las tablas de hechos, **desmarcarlas**.
5. Nombre del cubo: `Terapia Fisica`.

### 7.1 Grupos de medidas y medidas

Renombrar los grupos y dejar exactamente estas medidas (las demás se borran):

**Grupo `Sesiones`** (vw_fact_sesiones)

| Medida | Columna origen | AggregateFunction | FormatString |
|---|---|---|---|
| Ingreso | monto_ingreso | Sum | `#,##0.00` |
| Duracion Total | duracion_sesion | Sum | `#,##0` |
| Cantidad Sesiones | (filas) | Count | `#,##0` |
| Pacientes Nuevos | es_primera_sesion | Sum | `#,##0` |

**Grupo `Pacientes Distintos`**: clic derecho sobre el grupo Sesiones → **New Measure** → *Usage* = **Distinct count**, *Source column* = `id_paciente`. SSAS crea un grupo nuevo por su cuenta (los distinct count siempre van en su propio grupo). Renombrar el grupo a `Pacientes Distintos` y la medida a **Pacientes Atendidos** (formato `#,##0`).

**Grupo `Uso Insumo`** (vw_fact_uso_insumo)

| Medida | Columna origen | AggregateFunction | FormatString |
|---|---|---|---|
| Cantidad Utilizada | cantidad_utilizada | Sum | `#,##0.00` |
| Costo Insumos | costo_registrado | Sum | `#,##0.00` |
| Veces Usado | (filas) | Count | `#,##0` |

**Grupo `Insumos Distintos`**: igual que antes, *New Measure* → Distinct count sobre `vw_fact_uso_insumo.id_insumo`. Renombrar la medida a **Variedad Insumos**.

> No agreguen `factor_distribucion` como medida Sum: sumado no significa nada. Si se quiere usar, sirve para repartir el ingreso de la sesión entre sus insumos, pero ningún escenario lo pide.

### 7.2 Dimension Usage

Pestaña **Dimension Usage**. Debe quedar así (todas son *Regular* y se unen por la llave de la dimensión):

| Dimensión \ Grupo | Sesiones | Pacientes Distintos | Uso Insumo | Insumos Distintos |
|---|---|---|---|---|
| Tiempo | id_tiempo | id_tiempo | id_tiempo | id_tiempo |
| Paciente | id_paciente | id_paciente | id_paciente | id_paciente |
| Servicio | id_servicio | id_servicio | id_servicio | id_servicio |
| Insumo | — (gris) | — | id_insumo | id_insumo |

Que Insumo no se cruce con Sesiones es correcto: una sesión tiene varios insumos y sumar el ingreso por insumo lo duplicaría. Por eso el puente lleva copiadas las llaves de servicio, tiempo y paciente, y así las preguntas de insumos se responden desde el grupo *Uso Insumo*.

**Captura para el PDF:** la matriz de Dimension Usage.

### 7.3 Cálculos (MDX)

1. Pestaña **Calculations** → botón **Script View**.
2. Borrar todo y pegar el contenido de [`Cubo/Calculos_Cubo.mdx`](../Cubo/Calculos_Cubo.mdx).
3. Guardar. Si aparece un error de sintaxis, casi siempre es por un nombre de medida, dimensión o nivel distinto a los de esta guía.

El script crea:
- **Medidas calculadas:** Ingreso Promedio por Sesion, Duracion Promedio por Sesion, Ingreso por Paciente, Margen Bruto, % Margen, Pacientes Recurrentes, Pacientes Periodo Anterior, % Crecimiento Pacientes, Pacientes Anio Anterior, % Crecimiento Pacientes AA, % Crecimiento Sesiones, % Crecimiento Ingreso, Ingreso Acumulado Anio y Costo Insumos por Sesion.
- **Conjuntos con nombre:** Ultimos 6 Meses, Top 5 Servicios, Bottom 5 Servicios, Top 10 Insumos y Bottom 10 Insumos.

> Los porcentajes de crecimiento solo funcionan cuando se navega con la jerarquía **Calendario**, no con los atributos sueltos Mes o Anio. En Power BI y Excel hay que arrastrar la jerarquía.
>
> `Margen Bruto` resta el costo de insumos al ingreso. Úsenlo por Servicio o Tiempo, **no por Insumo**.

**(Opcional, suma puntos de presentación) KPI.** Pestaña **KPIs** → New KPI `Crecimiento Ingresos`: *Value* `[Measures].[Ingreso]`, *Goal* `([Measures].[Ingreso], ParallelPeriod([Tiempo].[Calendario].[Anio],1,[Tiempo].[Calendario].CurrentMember)) * 1.10`, *Status* `IIF(KPIValue("Crecimiento Ingresos") >= KPIGoal("Crecimiento Ingresos"), 1, -1)`.

---

## 8. Desplegar y procesar

1. Clic derecho en el proyecto → **Deploy**. Despliega y procesa en un solo paso.
2. Debe terminar con *Deployment Completed Successfully*. En la ventana de procesamiento revisen que todas las dimensiones y particiones queden en verde.

**Captura para el PDF:** la ventana de procesamiento exitoso.

---

## 9. Verificar que el cubo responde las preguntas

Pestaña **Browser** del cubo (o *Analyze in Excel*). Arrastrar medidas y atributos según esta tabla y comparar contra `ScriptsSQL/P3_04_Validacion_Cubo.sql`:

| Esc. | Pregunta (resumida) | Cómo se responde en el cubo |
|---|---|---|
| i | Pacientes atendidos por mes, trimestre y año | Pacientes Atendidos × Tiempo.Calendario |
| ii | Crecimiento % mes a mes y año contra año | % Crecimiento Pacientes y % Crecimiento Pacientes AA × Calendario (nivel Mes) |
| iii | Nuevos vs. recurrentes por periodo | Pacientes Nuevos y Pacientes Recurrentes × Calendario |
| iv | Pacientes por grupo etario y género | Pacientes Atendidos × Grupo Etario × Sexo |
| v | Sesiones por servicio y tipo en el tiempo | Cantidad Sesiones × Servicios por Tipo × Calendario |
| vi | Mayor y menor demanda por mes y trimestre (estacionalidad) | Cantidad Sesiones × Servicio × Mes del Anio / Trimestre del Anio; conjuntos Top 5 y Bottom 5 Servicios |
| vii | Servicios más pedidos por grupo etario | Cantidad Sesiones × Servicio × Grupo Etario |
| viii | Ingreso por tipo de servicio en los últimos 6 meses | Ingreso × Tipo Servicio con filtro Periodo Reciente = "Ultimos 6 meses" (o el conjunto Ultimos 6 Meses) |
| ix | Ingreso promedio por sesión por servicio y tipo | Ingreso Promedio por Sesion × Servicios por Tipo |
| x | Sesiones vs. ingreso (alta demanda, baja rentabilidad) | Cantidad Sesiones, Ingreso, Ingreso Promedio, Margen Bruto y % Margen × Servicio |
| xi | Evolución de sesiones e ingresos | Cantidad Sesiones, Ingreso, % Crecimiento Sesiones/Ingreso e Ingreso Acumulado Anio × Calendario |
| xii | Sesiones por semana del año | Cantidad Sesiones × Semana (filtrar por Anio) |
| xiii | Procedencia por distrito, cantón y provincia | Pacientes Atendidos × Geografia |
| xiv | Pacientes e ingresos por provincia y cantón | Pacientes Atendidos e Ingreso × Geografia (Provincia → Canton) |
| xv | Insumos por servicio y tipo de servicio | Veces Usado, Cantidad Utilizada y Costo Insumos × Servicios por Tipo × Insumos por Tipo |
| xvi | Insumos más y menos usados en el tiempo | Veces Usado × Insumo × Calendario; conjuntos Top 10 y Bottom 10 Insumos |
| xvii | Insumos por profesional | **No aplica**: no existe dato de profesional (ver sección 0) |
| xviii | Servicios con mayor variedad de insumos | Variedad Insumos × Servicio, ordenado de mayor a menor |

Si los totales del Browser coinciden con las consultas SQL de `P3_04`, el cubo está bien.

**Capturas para el PDF:** al menos una del Browser respondiendo algún escenario de cada grupo.

---

## 10. Respaldo de la base de Analysis Services (entregable)

1. SSMS → *Connect* → **Analysis Services** → `localhost` (o `localhost\OLAP`).
2. *Databases* → `MelaniaTerapiaFisicaCubo` → clic derecho → **Back Up…**
3. Archivo: `MelaniaTerapiaFisicaCubo.abf`. Desmarcar *Encrypt* (o anotar la contraseña) y aceptar *Allow file overwrite*.
4. Queda en la carpeta `Backup` de la instancia (por ejemplo `C:\Program Files\Microsoft SQL Server\MSAS16.MSSQLSERVER\OLAP\Backup\`). Copiarlo a `Cubo/Backup/` del repo.

---

## 11. Qué documentar en el PDF para este punto

1. Arquitectura: OLTP → staging → DW → cubo SSAS → Power BI/Excel (una figura).
2. Cambios al DW respecto al Proyecto 2 (tabla de la sección 0) y por qué.
3. Captura del DSV.
4. Cada dimensión: atributos, jerarquía y relaciones de atributos (captura).
5. Grupos de medidas y medidas (tabla de la sección 7.1) y la matriz de Dimension Usage.
6. Miembros calculados y conjuntos, con la fórmula y la pregunta que responde cada uno.
7. Procesamiento exitoso y la tabla de la sección 9 con capturas del Browser.
8. Justificación del escenario xvii.

---

## 12. Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `Login failed for user 'NT Service\MSSQLServerOLAPService'` al procesar | La cuenta de SSAS no tiene acceso al DW | Correr `P3_03_Permisos_SSAS.sql` con el nombre correcto de la cuenta |
| *"A connection cannot be made… server"* al desplegar | Nombre de servidor equivocado o SSAS detenido | Revisar el servicio en `services.msc` y *Properties → Deployment → Server* |
| *"…is not a multidimensional instance"* | La instancia está en modo Tabular | Instalar una instancia en modo Multidimensional |
| *Attribute key cannot be found* al procesar | El hecho tiene una llave que no está en la dimensión | Revisar que `-1` exista en cada dimensión (los scripts lo crean); volver a correr `P3_01` |
| *Duplicate attribute key* en Canton o Distrito | Se usó el nombre como llave | KeyColumns = `canton_key` / `distrito_key` |
| Meses en orden alfabético | `OrderBy = Name` | `OrderBy = Key` |
| Error al guardar el script MDX | Nombre de medida o jerarquía distinto | Alinear los nombres con esta guía |
| % de crecimiento vacío | Se usó el atributo Mes y no la jerarquía Calendario | Usar la jerarquía |
