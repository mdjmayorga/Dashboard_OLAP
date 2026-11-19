/* Genera Docs/Proyecto_3_Dashboard.docx con el formato de los proyectos 1 y 2.
   Uso:  node Docs/generar_documento.js
   Las capturas pendientes aparecen como recuadros amarillos "[Captura: ...]". */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, Table, TableRow, TableCell,
  AlignmentType, WidthType, ShadingType, BorderStyle, PageNumber, PageBreak, HeadingLevel,
  LevelFormat, ExternalHyperlink, VerticalAlign,
} = require("docx");

const FONT = "Arial";
const CODE_FONT = "Consolas";
const CONTENT_W = 9360; // carta con margenes de 1"
const HEADER_FILL = "83CAEB";
const CODE_FILL = "E8E8E8";
const logo = fs.readFileSync(path.join(__dirname, "recursos", "logo_tec.jpg"));

// ---------- helpers ----------
const t = (text, o = {}) => new TextRun({ text, font: FONT, ...o });

function p(content, o = {}) {
  const children = typeof content === "string" ? [t(content)] : content;
  return new Paragraph({ children, spacing: { after: 160, line: 276 }, alignment: AlignmentType.JUSTIFIED, ...o });
}
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(text)] });
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(text)] });
const bullet = (content, level = 0) => new Paragraph({
  numbering: { reference: "viñetas", level },
  children: typeof content === "string" ? [t(content)] : content,
  spacing: { after: 80, line: 276 },
});
const numbered = (content, ref = "pasos") => new Paragraph({
  numbering: { reference: ref, level: 0 },
  children: typeof content === "string" ? [t(content)] : content,
  spacing: { after: 80, line: 276 },
});
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(content, width, { header = false, fill, bold = false, center = false } = {}) {
  const runs = (Array.isArray(content) ? content : [content]).map((c) =>
    typeof c === "string" ? t(c, { bold: header || bold, size: 20 }) : c);
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: header || fill ? { fill: header ? HEADER_FILL : fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: runs,
      alignment: header || center ? AlignmentType.CENTER : AlignmentType.LEFT,
    })],
  });
}

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, widths[i])) })),
    ],
  });
}
const afterTable = () => new Paragraph({ children: [], spacing: { after: 120 } });

function code(lines) {
  return lines.map((line, i) => new Paragraph({
    children: [new TextRun({ text: line === "" ? " " : line, font: CODE_FONT, size: 18, color: "2E6B30" })],
    shading: { fill: CODE_FILL, type: ShadingType.CLEAR, color: "auto" },
    spacing: { after: 0, before: i === 0 ? 120 : 0, line: 260 },
    indent: { left: 720, right: 720 },
  })).concat([new Paragraph({ children: [], spacing: { after: 120 } })]);
}

// Si existe Docs/recursos/capturas/<archivo>, se inserta la imagen; si no, queda el recuadro amarillo.
const CAPTURAS = path.join(__dirname, "recursos", "capturas");
const ANCHO_MAX = 600; // px (~6.25")

function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }

function captura(descripcion, archivo) {
  const ruta = archivo && path.join(CAPTURAS, archivo);
  if (ruta && fs.existsSync(ruta)) {
    const data = fs.readFileSync(ruta);
    const { w, h } = pngSize(data);
    const escala = Math.min(1, ANCHO_MAX / w);
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 200 },
      keepLines: true,
      children: [new ImageRun({ type: "png", data,
        transformation: { width: Math.round(w * escala), height: Math.round(h * escala) },
        altText: { title: descripcion, description: descripcion, name: archivo } })],
    });
  }
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { fill: "FFF2CC", type: ShadingType.CLEAR, color: "auto" },
    border: { top: border, bottom: border, left: border, right: border },
    spacing: { before: 120, after: 200 },
    children: [t(`[Captura: ${descripcion}]`, { italics: true, color: "7F6000" })],
  });
}

const link = (url) => new ExternalHyperlink({ link: url, children: [t(url, { style: "Hyperlink" })] });
const ref = (texto, url) => new Paragraph({
  spacing: { after: 160, line: 276 },
  indent: { left: 720, hanging: 720 },
  children: url ? [t(texto + " "), link(url)] : [t(texto)],
});

// ---------- portada ----------
const centro = (children, after = 120) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after }, children });
const portada = [
  new Paragraph({ children: [], spacing: { before: 1200 } }),
  centro([new ImageRun({ type: "jpg", data: logo, transformation: { width: 300, height: 70 },
    altText: { title: "Logo TEC", description: "Logo del Tecnológico de Costa Rica", name: "logo" } })], 1000),
  centro([t("Proyecto 3 - Dashboard", { bold: true, size: 26 })], 1100),
  centro([t("IC-8078 Almacenes de Datos y Procesamiento OLAP", { bold: true, italics: true, size: 24 })]),
  centro([t("Instituto Tecnológico de Costa Rica", { italics: true, size: 24 })]),
  centro([t("Escuela de Ingeniería en Computación", { italics: true, size: 24 })], 600),
  centro([t("II Semestre 2026", { size: 24 })]),
  centro([t("Prof. Alberto Shum Chan", { size: 24 })], 1100),
  centro([t("Integrantes", { bold: true, size: 24 })]),
  centro([t("Daniela Araya Conejo | 2024089174", { italics: true, size: 24 })]),
  centro([t("Priscilla Romero Barquero | 2023332718", { italics: true, size: 24 })]),
  centro([t("Julián Castro Barrantes | 2024119346", { italics: true, size: 24 })]),
  centro([t("Mariano Mayorga Halabi | 2022075454", { italics: true, size: 24 })], 1100),
  centro([t("[Fecha de entrega] de noviembre del 2026", { bold: true, size: 24, highlight: "yellow" })]),
  pageBreak(),
];

// ---------- orden de ejecucion ----------
const ordenEjecucion = [
  p([t("Orden de ejecución del proyecto", { bold: true })], { alignment: AlignmentType.LEFT }),
  p("Para reproducir el cubo se parte de las bases de datos del Proyecto 2 (MelaniaMenaOperacional y DW_TerapiaFisica) con el proceso de ETL ya ejecutado. Los scripts nuevos de este proyecto se encuentran en la carpeta ScriptsSQL y el proyecto de Analysis Services en la carpeta Cubo."),
  p([t("1. Preparar el almacén de datos", { bold: true })], { alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  p([t("Ejecutar en SQL Server Management Studio "), t("P3_01_DW_Insumos.sql", { color: "4EA72E", italics: true }),
    t(", que crea y carga la dimensión de insumos y la tabla puente entre sesiones e insumos.")]),
  p([t("2. Crear las vistas del cubo", { bold: true })], { alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  p([t("Ejecutar "), t("P3_02_Vistas_Cubo.sql", { color: "4EA72E", italics: true }),
    t(", que crea las seis vistas sobre las que se construye el Data Source View.")]),
  p([t("3. Otorgar permisos a Analysis Services", { bold: true })], { alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  p([t("Ejecutar "), t("P3_03_Permisos_SSAS.sql", { color: "4EA72E", italics: true }),
    t(" para que la cuenta del servicio de Analysis Services pueda leer DW_TerapiaFisica al procesar el cubo.")]),
  p([t("4. Desplegar y procesar el cubo", { bold: true })], { alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  p([t("Abrir la solución "), t("MelaniaTerapiaFisicaCubo", { color: "4EA72E", italics: true }),
    t(" en Visual Studio y ejecutar Deploy sobre el proyecto. Alternativamente, restaurar el respaldo "),
    t("MelaniaTerapiaFisicaCubo.abf", { color: "4EA72E", italics: true }), t(" desde SQL Server Management Studio.")]),
  p([t("5. Validar el cubo", { bold: true })], { alignment: AlignmentType.LEFT, spacing: { after: 80 } }),
  p([t("Ejecutar "), t("P3_04_Validacion_Cubo.sql", { color: "4EA72E", italics: true }),
    t(" y comparar sus resultados con los valores que muestra el cubo.")]),
  pageBreak(),
];

// ---------- requerimiento 1 ----------
const escenarios = [
  ["Crecimiento de pacientes", "i", "Cantidad de pacientes atendidos por mes, trimestre y año."],
  ["", "ii", "Crecimiento porcentual de pacientes atendidos mes a mes y año contra año."],
  ["", "iii", "Pacientes nuevos frente a pacientes recurrentes dentro de cada periodo."],
  ["", "iv", "Distribución de los pacientes atendidos según grupo etario y género."],
  ["Servicios con mayor demanda", "v", "Cantidad de sesiones por servicio y tipo de servicio en diferentes periodos."],
  ["", "vi", "Servicios con mayor y menor demanda por mes y trimestre (estacionalidad)."],
  ["", "vii", "Servicios más solicitados según el grupo etario del paciente."],
  ["Ingresos por servicio", "viii", "Monto de ingreso por tipo de servicio en los últimos seis meses."],
  ["", "ix", "Ingreso promedio por sesión según el servicio y el tipo de servicio."],
  ["", "x", "Comparación entre sesiones e ingreso por servicio (alta demanda, baja rentabilidad)."],
  ["Viabilidad de expansión", "xi", "Evolución del total de sesiones e ingresos por mes, trimestre y año."],
  ["", "xii", "Distribución de las sesiones por semana del año."],
  ["", "xiii", "Procedencia geográfica de los pacientes por distrito, cantón y provincia."],
  ["", "xiv", "Cantidad de pacientes e ingresos por provincia y cantón."],
  ["Uso de insumos", "xv", "Insumos utilizados según el servicio y tipo de servicio."],
  ["", "xvi", "Insumos con mayor y menor frecuencia de uso en diferentes periodos."],
  ["", "xvii", "Insumos utilizados por cada profesional."],
  ["", "xviii", "Servicios que requieren una mayor variedad de insumos."],
];

const req1 = [
  h1("1. Crear un proyecto multidimensional de Analysis Services, y construir el cubo correspondiente que permita responder a las preguntas claves de la empresa en la que se realizó el proyecto 1 y 2. 20 pts."),

  h2("1.1 Preguntas clave"),
  p("Las preguntas clave corresponden a los escenarios de análisis definidos en el Proyecto 1 para Melania Mena Terapia Física, agrupados según los objetivos específicos del proyecto. El cubo se diseñó para responder cada uno de ellos."),
  table(["Objetivo", "Esc.", "Pregunta"], escenarios, [2300, 760, 6300]),
  afterTable(),

  h2("1.2 Ajustes al almacén de datos"),
  p("El almacén de datos construido en el Proyecto 2 contiene las dimensiones dim_paciente, dim_servicio y dim_time, y la tabla de hechos fact_sessions. Con esta estructura es posible responder trece de los dieciocho escenarios. Para completar el resto y facilitar la construcción del cubo se realizaron los siguientes ajustes, sin modificar las tablas existentes:"),
  table(["Cambio", "Escenarios", "Descripción"], [
    ["dim_insumo y bridge_sesion_insumo", "xv, xvi, xviii", "El esquema del Proyecto 1 incluía la dimensión Insumo y la tabla puente entre sesiones e insumos, pero no se cargaron en el Proyecto 2. Se crean y se cargan desde la tabla Uso_Insumo de la OLTP (P3_01_DW_Insumos.sql)."],
    ["Bandera es_primera_sesion", "iii", "Marca la primera sesión histórica de cada paciente. Al sumarla dentro de un periodo se obtienen los pacientes nuevos de ese periodo."],
    ["Llaves y nombres de tiempo", "i, ii, v, vi, xi, xii", "La columna Mes de dim_time toma valores de 1 a 12 en todos los años. Se generan llaves únicas por nivel (por ejemplo, 202503 para marzo de 2025) y nombres legibles (\"Marzo 2025\", \"T1 2025\", \"Semana 05\")."],
    ["Llaves geográficas", "xiii, xiv", "Existen cantones y distritos con el mismo nombre en distintas provincias. Se construyen llaves compuestas provincia | cantón | distrito."],
    ["Periodo reciente", "viii", "Clasifica cada fecha como \"Ultimos 6 meses\", \"Anterior\" o \"Futuro\" respecto al último mes con sesiones registradas."],
  ], [2400, 1500, 5460]),
  afterTable(),
  p("Los ajustes de los cuatro últimos puntos se implementan como vistas en DW_TerapiaFisica (P3_02_Vistas_Cubo.sql). De esta forma el cubo se construye sobre una capa de presentación y las tablas cargadas por el ETL no cambian."),

  h3("Tabla puente sesión - insumo"),
  p("Una sesión puede utilizar varios insumos, por lo que la relación entre fact_sessions y dim_insumo es de muchos a muchos. La tabla bridge_sesion_insumo representa esta relación y conserva la cantidad utilizada, el factor de distribución y el costo registrado. Además de las llaves id_session e id_insumo, se copian desde fact_sessions las llaves de servicio, tiempo y paciente, de manera que el grupo de medidas de insumos se relaciona directamente con esas dimensiones en el cubo."),
  table(["Campo", "Tipo de dato", "Restricciones / Descripción"], [
    ["id_session", "INT", "PK, FK a fact_sessions. Sesión en la que se usó el insumo."],
    ["id_insumo", "INT", "PK, FK a dim_insumo. Insumo utilizado."],
    ["id_servicio", "INT", "FK a dim_servicio. Copiada de la sesión."],
    ["id_tiempo", "INT", "FK a dim_time. Copiada de la sesión."],
    ["id_paciente", "INT", "FK a dim_paciente. Copiada de la sesión."],
    ["cantidad_utilizada", "DECIMAL(10,2)", "NOT NULL. Cantidad del insumo en su unidad de medida."],
    ["factor_distribucion", "DECIMAL(5,4)", "NOT NULL. Proporción del costo asignada a la sesión."],
    ["costo_registrado", "DECIMAL(10,2)", "NOT NULL. Costo del insumo imputado a la sesión."],
  ], [2400, 1800, 5160]),
  afterTable(),
  p("La carga generó 49 insumos en dim_insumo y 84 430 filas en bridge_sesion_insumo, la misma cantidad de registros que la tabla Uso_Insumo de la base operacional."),
  captura("resultado de la verificación de P3_01_DW_Insumos.sql"),

  h2("1.3 Creación del proyecto en Visual Studio"),
  p("Se creó una solución nueva de tipo Analysis Services Multidimensional Project llamada MelaniaTerapiaFisicaCubo, independiente de la solución de Integration Services del Proyecto 2. El proyecto se despliega en la instancia local de Analysis Services en modo multidimensional, en la base de datos MelaniaTerapiaFisicaCubo."),
  captura("propiedades de Deployment del proyecto (Server y Database)"),

  h3("Data Source"),
  p("El origen de datos DS DW Terapia Fisica se conecta a la base DW_TerapiaFisica mediante autenticación de Windows. En la opción de suplantación se utiliza la cuenta del servicio de Analysis Services, a la cual se le otorgó el rol db_datareader con el script P3_03_Permisos_SSAS.sql."),

  h3("Data Source View"),
  p("El Data Source View DSV Terapia Fisica incluye únicamente las seis vistas creadas para el cubo. Debido a que las vistas no tienen llaves primarias ni relaciones, se definieron llaves lógicas y relaciones de forma manual, lo cual da como resultado dos esquemas estrella que comparten las dimensiones Tiempo, Paciente y Servicio."),
  table(["Vista", "Llave lógica", "Relaciones"], [
    ["vw_fact_sesiones", "id_session", "id_tiempo, id_paciente, id_servicio"],
    ["vw_fact_uso_insumo", "id_session + id_insumo", "id_tiempo, id_paciente, id_servicio, id_insumo"],
    ["vw_dim_tiempo", "id_tiempo", "-"],
    ["vw_dim_paciente", "id_paciente", "-"],
    ["vw_dim_servicio", "id_servicio", "-"],
    ["vw_dim_insumo", "id_insumo", "-"],
  ], [2700, 2500, 4160]),
  afterTable(),
  captura("diagrama del Data Source View con las relaciones"),

  h2("1.4 Dimensiones"),
  p("Se construyeron cuatro dimensiones. En cada una se definieron las columnas de llave y de nombre de los atributos, la jerarquía principal y las relaciones entre atributos, que permiten a Analysis Services precalcular agregaciones por cada nivel."),

  h3("Dimensión Tiempo"),
  table(["Atributo", "Llave", "Nombre", "Uso"], [
    ["Fecha", "id_tiempo", "fecha_nombre", "Nivel más bajo de la jerarquía"],
    ["Mes", "mes_key", "mes_nombre", "Escenarios i, ii, v, xi"],
    ["Trimestre", "trimestre_key", "trimestre_nombre", "Escenarios i, vi, xi"],
    ["Anio", "anio_key", "anio_nombre", "Escenarios i, ii, xi"],
    ["Mes del Anio", "mes_numero", "mes_del_anio", "Estacionalidad (vi)"],
    ["Trimestre del Anio", "trimestre_numero", "trimestre_del_anio", "Estacionalidad (vi)"],
    ["Semana", "semana_numero", "semana_nombre", "Escenario xii"],
    ["Periodo Reciente", "periodo_reciente", "periodo_reciente", "Escenario viii"],
  ], [2100, 2000, 2200, 3060]),
  afterTable(),
  p([t("Jerarquía Calendario: ", { bold: true }), t("Anio → Trimestre → Mes → Fecha. Es una jerarquía simple balanceada, igual a la definida en el Proyecto 1.")]),
  captura("relaciones de atributos de la dimensión Tiempo"),

  h3("Dimensión Paciente"),
  table(["Atributo", "Llave", "Nombre"], [
    ["Paciente", "id_paciente", "nombre"],
    ["Sexo", "sexo", "sexo"],
    ["Grupo Etario", "grupo_etario", "grupo_etario"],
    ["Provincia", "provincia", "provincia"],
    ["Canton", "canton_key", "canton"],
    ["Distrito", "distrito_key", "distrito"],
  ], [3120, 3120, 3120]),
  afterTable(),
  p([t("Jerarquía Geografia: ", { bold: true }), t("Provincia → Canton → Distrito → Paciente. Responde los escenarios xiii y xiv. Los atributos Sexo y Grupo Etario responden los escenarios iv y vii.")]),
  captura("relaciones de atributos de la dimensión Paciente"),

  h3("Dimensión Servicio"),
  table(["Atributo", "Llave", "Nombre"], [
    ["Servicio", "id_servicio", "nombre_servicio"],
    ["Tipo Servicio", "tipo_servicio", "tipo_servicio"],
    ["Precio Base", "precio_base", "precio_base (solo propiedad)"],
    ["Descripcion", "id_servicio", "descripcion (solo propiedad)"],
  ], [3120, 3120, 3120]),
  afterTable(),
  p([t("Jerarquía Servicios por Tipo: ", { bold: true }), t("Tipo Servicio → Servicio.")]),
  captura("relaciones de atributos de la dimensión Servicio"),

  h3("Dimensión Insumo"),
  table(["Atributo", "Llave", "Nombre"], [
    ["Insumo", "id_insumo", "nombre"],
    ["Tipo Insumo", "tipo", "tipo"],
    ["Unidad Medida", "unidad_medida", "unidad_medida"],
    ["Costo Unitario", "costo_unitario", "costo_unitario (solo propiedad)"],
  ], [3120, 3120, 3120]),
  afterTable(),
  p([t("Jerarquía Insumos por Tipo: ", { bold: true }), t("Tipo Insumo → Insumo.")]),
  captura("relaciones de atributos de la dimensión Insumo"),

  h2("1.5 Cubo Terapia Fisica"),
  p("El cubo se creó con el asistente de Visual Studio a partir de las dos tablas de hechos. Las medidas de conteo distinto se ubican en grupos de medidas propios, como lo requiere Analysis Services."),
  table(["Grupo de medidas", "Medida", "Origen", "Agregación"], [
    ["Sesiones", "Ingreso", "monto_ingreso", "Sum"],
    ["", "Duracion Total", "duracion_sesion", "Sum"],
    ["", "Cantidad Sesiones", "filas de vw_fact_sesiones", "Count"],
    ["", "Pacientes Nuevos", "es_primera_sesion", "Sum"],
    ["Pacientes Distintos", "Pacientes Atendidos", "id_paciente", "Distinct count"],
    ["Uso Insumo", "Cantidad Utilizada", "cantidad_utilizada", "Sum"],
    ["", "Costo Insumos", "costo_registrado", "Sum"],
    ["", "Veces Usado", "filas de vw_fact_uso_insumo", "Count"],
    ["Insumos Distintos", "Variedad Insumos", "id_insumo", "Distinct count"],
  ], [2300, 2300, 2960, 1800]),
  afterTable(),
  captura("pestaña Cube Structure con los grupos de medidas y dimensiones"),

  h3("Uso de dimensiones"),
  p("Las dimensiones Tiempo, Paciente y Servicio se relacionan con los cuatro grupos de medidas. La dimensión Insumo se relaciona únicamente con los grupos Uso Insumo e Insumos Distintos. Si se relacionara con Sesiones, el ingreso de una sesión con varios insumos se contaría una vez por cada insumo."),
  table(["Dimensión", "Sesiones", "Pacientes Distintos", "Uso Insumo", "Insumos Distintos"], [
    ["Tiempo", "id_tiempo", "id_tiempo", "id_tiempo", "id_tiempo"],
    ["Paciente", "id_paciente", "id_paciente", "id_paciente", "id_paciente"],
    ["Servicio", "id_servicio", "id_servicio", "id_servicio", "id_servicio"],
    ["Insumo", "-", "-", "id_insumo", "id_insumo"],
  ], [1760, 1900, 1900, 1900, 1900]),
  afterTable(),
  captura("pestaña Dimension Usage", "dimension_usage.png"),

  h2("1.6 Cálculos del cubo"),
  p("En la pestaña Calculations se definieron miembros calculados para los indicadores que no son sumas directas, y conjuntos con nombre para las preguntas de ranking y periodos recientes. El script completo se encuentra en Cubo/Calculos_Cubo.mdx."),
  table(["Miembro calculado", "Fórmula (resumen)", "Esc."], [
    ["Ingreso Promedio por Sesion", "Ingreso / Cantidad Sesiones", "ix, x"],
    ["Duracion Promedio por Sesion", "Duracion Total / Cantidad Sesiones", "-"],
    ["Ingreso por Paciente", "Ingreso / Pacientes Atendidos", "xiv"],
    ["Margen Bruto", "Ingreso - Costo Insumos", "x"],
    ["% Margen", "Margen Bruto / Ingreso", "x"],
    ["Pacientes Recurrentes", "Pacientes Atendidos - Pacientes Nuevos", "iii"],
    ["% Crecimiento Pacientes", "Variación contra el periodo anterior (PrevMember)", "ii"],
    ["% Crecimiento Pacientes AA", "Variación contra el mismo periodo del año anterior (ParallelPeriod)", "ii"],
    ["% Crecimiento Sesiones", "Variación de sesiones contra el periodo anterior", "xi"],
    ["% Crecimiento Ingreso", "Variación de ingreso contra el periodo anterior", "xi"],
    ["Ingreso Acumulado Anio", "Aggregate(PeriodsToDate(Anio), Ingreso)", "xi"],
    ["Costo Insumos por Sesion", "Costo Insumos / Cantidad Sesiones", "xv"],
  ], [2900, 5160, 1300]),
  afterTable(),
  p("Por ejemplo, el crecimiento porcentual de pacientes compara cada periodo con el anterior del mismo nivel de la jerarquía Calendario, de modo que en el nivel Mes devuelve el crecimiento mes a mes y en el nivel Anio el crecimiento anual:"),
  ...code([
    "CREATE MEMBER CURRENTCUBE.[Measures].[% Crecimiento Pacientes] AS",
    "    IIF(IsEmpty([Measures].[Pacientes Periodo Anterior])",
    "        OR [Measures].[Pacientes Periodo Anterior] = 0, NULL,",
    "        ([Measures].[Pacientes Atendidos]",
    "         - [Measures].[Pacientes Periodo Anterior])",
    "        / [Measures].[Pacientes Periodo Anterior]),",
    "    FORMAT_STRING = \"Percent\";",
  ]),
  table(["Conjunto con nombre", "Definición", "Esc."], [
    ["Ultimos 6 Meses", "Últimos seis meses con sesiones registradas", "viii"],
    ["Top 5 Servicios / Bottom 5 Servicios", "Servicios con más y menos sesiones en el contexto seleccionado", "vi"],
    ["Top 10 Insumos / Bottom 10 Insumos", "Insumos con mayor y menor frecuencia de uso", "xvi"],
  ], [3200, 4860, 1300]),
  afterTable(),
  captura("pestaña Calculations"),

  h2("1.7 Despliegue y procesamiento"),
  p("El proyecto se desplegó y procesó desde Visual Studio sobre la instancia local de Analysis Services. Todas las dimensiones y particiones se procesaron correctamente.", { keepNext: true }),
  captura("ventana de procesamiento exitoso", "deploy_exitoso.png"),

  h2("1.8 Validación"),
  p("Para comprobar que el cubo agrega correctamente, se compararon sus resultados con consultas SQL directas sobre el almacén de datos (P3_04_Validacion_Cubo.sql). Los valores de control son los siguientes:"),
  table(["Indicador", "Valor en el DW"], [
    ["Cantidad de sesiones", "15 979"],
    ["Ingreso total", "₡248 655 500,00"],
    ["Duración total (minutos)", "630 835"],
    ["Pacientes atendidos", "1 474"],
  ], [4680, 4680]),
  afterTable(),
  table(["Año", "Sesiones", "Ingreso", "Pacientes atendidos", "Pacientes nuevos"], [
    ["2023", "3 368", "₡48 365 000", "371", "371"],
    ["2024", "3 740", "₡57 935 000", "422", "366"],
    ["2025", "4 291", "₡66 851 000", "476", "384"],
    ["2026", "4 580", "₡75 504 500", "485", "353"],
  ], [1360, 1800, 2300, 2100, 1800]),
  afterTable(),
  p("En 2023 todos los pacientes atendidos son nuevos porque es el primer año con registros en el sistema. Los mismos valores se obtuvieron en el explorador del cubo."),
  captura("explorador del cubo (Browser) con sesiones, ingreso y pacientes por año"),

  h2("1.9 Cobertura de las preguntas clave"),
  table(["Esc.", "Cómo se responde en el cubo"], [
    ["i", "Pacientes Atendidos por la jerarquía Calendario."],
    ["ii", "% Crecimiento Pacientes y % Crecimiento Pacientes AA por la jerarquía Calendario."],
    ["iii", "Pacientes Nuevos y Pacientes Recurrentes por la jerarquía Calendario."],
    ["iv", "Pacientes Atendidos por Grupo Etario y Sexo."],
    ["v", "Cantidad Sesiones por Servicios por Tipo y Calendario."],
    ["vi", "Cantidad Sesiones por Servicio, Mes del Anio y Trimestre del Anio; conjuntos Top 5 y Bottom 5 Servicios."],
    ["vii", "Cantidad Sesiones por Servicio y Grupo Etario."],
    ["viii", "Ingreso por Tipo Servicio filtrado por Periodo Reciente = \"Ultimos 6 meses\"."],
    ["ix", "Ingreso Promedio por Sesion por Servicios por Tipo."],
    ["x", "Cantidad Sesiones, Ingreso, Ingreso Promedio por Sesion, Margen Bruto y % Margen por Servicio."],
    ["xi", "Cantidad Sesiones, Ingreso, % Crecimiento e Ingreso Acumulado Anio por Calendario."],
    ["xii", "Cantidad Sesiones por Semana."],
    ["xiii", "Pacientes Atendidos por la jerarquía Geografia."],
    ["xiv", "Pacientes Atendidos e Ingreso por Provincia y Canton."],
    ["xv", "Veces Usado, Cantidad Utilizada y Costo Insumos por Servicio e Insumo."],
    ["xvi", "Veces Usado por Insumo y Calendario; conjuntos Top 10 y Bottom 10 Insumos."],
    ["xvii", "No aplica (ver nota)."],
    ["xviii", "Variedad Insumos por Servicio."],
  ], [1100, 8260]),
  afterTable(),
  p([t("Nota sobre el escenario xvii. ", { bold: true }),
    t("La base de datos operacional no registra qué profesional atiende cada sesión, y el modelo multidimensional del Proyecto 1 no incluye una dimensión de profesionales, ya que actualmente el consultorio es atendido únicamente por la terapeuta Melania Mena. Por lo tanto, este escenario no puede responderse con los datos disponibles. Si el consultorio incorpora nuevos profesionales, se deberá agregar el profesional a la tabla Sesion de la OLTP, una dimensión Profesional en el almacén de datos y su relación con los grupos de medidas del cubo.")]),

  h2("1.10 Respaldo de la base de datos de Analysis Services"),
  p("El respaldo de la base de datos MelaniaTerapiaFisicaCubo se generó desde SQL Server Management Studio, conectado a Analysis Services, mediante la opción Back Up. El archivo MelaniaTerapiaFisicaCubo.abf se adjunta en la entrega."),
  captura("respaldo de la base de datos de Analysis Services"),
  pageBreak(),
];

// ---------- requerimientos 2 y 3 (pendientes) ----------
const pendiente = (texto) => p([t(texto, { italics: true, highlight: "yellow" })]);
const req2 = [
  h1("2. Crear un dashboard utilizando la herramienta Microsoft Power BI Desktop que se conecte al cubo construido en el paso anterior y que permita visualizar de forma gráfica las respuestas a las preguntas planteadas en el proyecto de inteligencia de negocios. En la documentación se debe incluir una captura de cada una de las visualizaciones junto con la descripción de la pregunta que responde y una interpretación del resultado mostrado. 30 pts."),
  pendiente("Pendiente: conexión de Power BI al cubo y, por cada visualización, la captura, la pregunta que responde y la interpretación del resultado."),
  pageBreak(),
];
const req3 = [
  h1("3. Crear un archivo de Excel que se conecte al cubo construido en el paso 1 y crear allí los elementos necesarios (tablas dinámicas, segmentadores/slicers) para la visualización de las respuestas a las preguntas clave. 15 pts."),
  pendiente("Pendiente: conexión de Excel al cubo, tablas dinámicas y segmentadores por pregunta clave."),
  pageBreak(),
];

// ---------- referencias ----------
const referencias = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t("Referencias", { bold: true })] }),
  ref("Kimball, R., & Ross, M. (2013). The data warehouse toolkit: The definitive guide to dimensional modeling (3.ª ed.). Wiley."),
  ref("Microsoft. (2024). Multidimensional modeling (Adventure Works tutorial). Microsoft Learn.",
    "https://learn.microsoft.com/en-us/analysis-services/multidimensional-tutorial/multidimensional-modeling-adventure-works-tutorial"),
  ref("Microsoft. (2024). Attribute relationships. Microsoft Learn.",
    "https://learn.microsoft.com/en-us/analysis-services/multidimensional-models/attribute-relationships"),
  ref("Microsoft. (2024). PrevMember (MDX). Microsoft Learn.",
    "https://learn.microsoft.com/en-us/sql/mdx/prevmember-mdx"),
  ref("Microsoft. (2024). ParallelPeriod (MDX). Microsoft Learn.",
    "https://learn.microsoft.com/en-us/sql/mdx/parallelperiod-mdx"),
  ref("Microsoft. (2024). Backup and restore of Analysis Services databases. Microsoft Learn.",
    "https://learn.microsoft.com/en-us/analysis-services/multidimensional-models/backup-and-restore-of-analysis-services-databases"),
];

// ---------- documento ----------
const header = new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new ImageRun({ type: "jpg", data: logo, transformation: { width: 150, height: 35 },
      altText: { title: "Logo TEC", description: "Logo del Tecnológico de Costa Rica", name: "logo-encabezado" } })],
  })],
});
const footer = new Footer({
  children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 })] })],
});

const doc = new Document({
  creator: "Grupo Proyecto 3 OLAP",
  title: "Proyecto 3 - Dashboard",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22, bold: true, color: "000000" },
        paragraph: { spacing: { before: 120, after: 200, line: 276 }, alignment: AlignmentType.JUSTIFIED, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22, bold: true, color: "000000" },
        paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 21, bold: true, color: "000000" },
        paragraph: { spacing: { before: 200, after: 100 }, keepNext: true, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "viñetas", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ] },
      { reference: "pasos", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 500, footer: 700 } } },
    headers: { default: header },
    footers: { default: footer },
    children: [...portada, ...ordenEjecucion, ...req1, ...req2, ...req3, ...referencias],
  }],
});

const salida = path.join(__dirname, "Proyecto_3_Dashboard.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(salida, buf); console.log("Generado:", salida); });
