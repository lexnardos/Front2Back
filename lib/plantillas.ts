export type CampoPlantilla = {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "tel"
    | "date"
    | "datetime-local"
    | "number"
    | "textarea"
    | "select";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  help?: string;
  step?: string;
};

export type DatosPlantilla = Record<string, string | undefined>;

export type Plantilla = {
  nombre: string;
  categoria: string;
  descripcion: string;
  campos: CampoPlantilla[];
  formato: (datos: DatosPlantilla) => string;
};

export const PASOS_SUGERIDOS = [
  "Radicado",
  "Validación inicial",
  "En revisión con área responsable",
  "Esperando soportes del Frontoffice",
  "Aplicando ajuste",
  "Aplicado en Back Office",
  "Resolución enviada al Frontoffice",
  "Cerrado",
];

function opciones(values: string[]): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: value }));
}

function v(datos: DatosPlantilla, campo: string): string {
  return (datos[campo] ?? "").trim();
}

const camposAccesoApp: CampoPlantilla[] = [
  {
    name: "fecha_hora_falla",
    label: "Fecha y hora de falla",
    type: "datetime-local",
  },
  {
    name: "dispositivo",
    label: "Dispositivo utilizado (computador o teléfono)",
    type: "text",
    placeholder: "Ej. Computador / Teléfono",
    maxLength: 120,
  },
  {
    name: "marca_modelo",
    label: "Marca o modelo de equipo",
    type: "text",
    placeholder: "Ej. Samsung Galaxy S23",
    maxLength: 160,
  },
  {
    name: "sistema_operativo",
    label: "Sistema operativo (iOS, Android, etc.)",
    type: "text",
    placeholder: "Ej. Android 14 / Windows 11",
    maxLength: 120,
  },
  {
    name: "version_app",
    label: "Versión del App",
    type: "text",
    placeholder: "Ej. v12.4.1",
    maxLength: 60,
  },
  {
    name: "acceso_red",
    label: "Tipo de acceso a la red (Wifi o LAN)",
    type: "select",
    options: opciones(["Wifi", "LAN"]),
  },
  {
    name: "navegador",
    label: "Navegador",
    type: "text",
    placeholder: "Ej. Google Chrome v120",
    maxLength: 120,
  },
  {
    name: "utiliza_proxy",
    label: "¿Utiliza Proxy?",
    type: "select",
    options: opciones(["No", "Sí"]),
  },
];

export const PLANTILLAS: Plantilla[] = [
  {
    nombre: "Escucha de llamada",
    categoria: "Calidad",
    descripcion:
      "IMPORTANTE: Dejar esta plantilla en la carpeta de RR F7 Gestión cliente críticos y dejar escalado al Back Office desde Genesys (solo aplica la última marcación en caso de retención CAN-1RE o CAN-2RE).",
    campos: [
      {
        name: "cuenta_min",
        label: "Cuenta/min",
        type: "text",
        placeholder: "Ej. 3159876543",
        required: true,
        maxLength: 60,
      },
      {
        name: "gestion",
        label: "Gestión (Retención o Ventas)",
        type: "select",
        required: true,
        options: opciones(["Retención", "Ventas"]),
      },
      {
        name: "radicado_tickler_ot",
        label: "Radicado/tickler/OT",
        type: "text",
        placeholder: "Ingrese radicado, tickler u OT",
        required: true,
        maxLength: 120,
      },
      {
        name: "hora_fecha_llamada",
        label: "Hora y Fecha Llamada",
        type: "datetime-local",
        required: true,
      },
      {
        name: "asesor",
        label: "Asesor o código de vendedor",
        type: "text",
        placeholder: "Ingrese nombre o código",
        required: true,
        maxLength: 120,
      },
      {
        name: "servicios_informados",
        label: "Servicios informados a cliente",
        type: "text",
        placeholder: "Ej. Dúo Internet + TV",
        required: true,
        maxLength: 200,
      },
      {
        name: "valor_informado",
        label: "Valor mensual informado a cliente",
        type: "text",
        placeholder: "Ej. $110.000",
        required: true,
        maxLength: 60,
      },
      {
        name: "descripcion",
        label: "Descripción",
        type: "textarea",
        placeholder: "Describa la gestión de la llamada...",
        required: true,
        maxLength: 1500,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Escucha de llamada
Cuenta/min: ${v(datos, "cuenta_min")}
Gestión (Retención o Ventas): ${v(datos, "gestion")}
Radicado/tickler/OT: ${v(datos, "radicado_tickler_ot")}
Hora y Fecha Llamada: ${v(datos, "hora_fecha_llamada")}
Asesor o código de vendedor: ${v(datos, "asesor")}
Servicios informados a cliente: ${v(datos, "servicios_informados")}
Valor mensual informado a cliente: ${v(datos, "valor_informado")}
Descripción: ${v(datos, "descripcion")}`,
  },
  {
    nombre: "Tarifa especial por tarifa nueva comercial",
    categoria: "Tarifas",
    descripcion:
      "IMPORTANTE: Dejar esta plantilla en la carpeta de RR F7 Gestión cliente críticos y escalar al Back Office desde Genesys.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ej. 38472910",
        required: true,
        maxLength: 60,
      },
      {
        name: "orden_trabajo",
        label: "Orden de trabajo donde se aplicó tarifa especial",
        type: "text",
        placeholder: "Ej. OT-548923",
        required: true,
        maxLength: 120,
      },
      {
        name: "codigo_tarifa",
        label: "Código de tarifa",
        type: "text",
        placeholder: "Ej. TAR-HFC-09",
        required: true,
        maxLength: 80,
      },
      {
        name: "tecnologia",
        label: "Tecnología (HFC / FTTH)",
        type: "select",
        required: true,
        options: opciones(["HFC", "FTTH"]),
      },
      {
        name: "asesor",
        label: "Asesor que aplicó tarifa",
        type: "text",
        placeholder: "Ej. Carlos Martínez",
        required: true,
        maxLength: 120,
      },
      {
        name: "se_requiere_cambio",
        label: "Se requiere cambio de tarifa",
        type: "text",
        placeholder: "Ej. Cambiar Tarifa Básica 200M por Tarifa Promo 500M",
        required: true,
        maxLength: 250,
      },
      {
        name: "valor_final",
        label: "Valor mensual final",
        type: "text",
        placeholder: "Ej. $79.900",
        required: true,
        maxLength: 60,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Tarifa especial por tarifa nueva comercial
Cuenta: ${v(datos, "cuenta")}
Orden de trabajo donde se aplicó tarifa especial: ${v(datos, "orden_trabajo")}
Código de tarifa: ${v(datos, "codigo_tarifa")}
Tecnología (HFC / FTTH): ${v(datos, "tecnologia")}
Asesor que aplicó tarifa: ${v(datos, "asesor")}
Se requiere cambio de tarifa: ${v(datos, "se_requiere_cambio")}
Valor mensual final: ${v(datos, "valor_final")}`,
  },
  {
    nombre: "Desbloqueo de Televisor",
    categoria: "Televisor",
    descripcion:
      "IMPORTANTE: Se debe escalar directamente al apoyo en piso.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ej. 10928374",
        required: true,
        maxLength: 60,
      },
      {
        name: "nombre_cliente",
        label: "Nombre de cliente",
        type: "text",
        placeholder: "Ej. Juan Pérez Gómez",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula",
        label: "Cédula",
        type: "text",
        placeholder: "Ej. 1020304050",
        required: true,
        maxLength: 30,
      },
      {
        name: "imei",
        label: "IMEI",
        type: "text",
        placeholder: "Ej. 864521038472910",
        required: true,
        maxLength: 30,
      },
      {
        name: "credito",
        label: "Crédito",
        type: "text",
        placeholder: "Ej. CR-98321",
        required: true,
        maxLength: 60,
      },
      {
        name: "fecha_ultimo_pago",
        label: "Fecha de último pago",
        type: "date",
        required: true,
      },
      {
        name: "saldo",
        label: "Saldo debe estar en $0",
        type: "select",
        required: true,
        options: opciones(["Sí ($0)", "No"]),
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Desbloqueo de Televisor
Cuenta: ${v(datos, "cuenta")}
Nombre de cliente: ${v(datos, "nombre_cliente")}
Cédula: ${v(datos, "cedula")}
IMEI: ${v(datos, "imei")}
Crédito: ${v(datos, "credito")}
Fecha de último pago: ${v(datos, "fecha_ultimo_pago")}
Saldo debe estar en $0: ${v(datos, "saldo")}`,
  },
  {
    nombre: "Visita técnica",
    categoria: "Visita técnica",
    descripcion:
      "IMPORTANTE: Esta plantilla se utiliza para cierres de órdenes de trabajo, recomendaciones de visitas técnicas, reportar incumplimiento de técnicos o solicitar reagendamientos (si el cliente no puede por autogestión).",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ingrese la cuenta",
        required: true,
        maxLength: 60,
      },
      {
        name: "ot_lls",
        label: "OT/LLS",
        type: "text",
        placeholder: "Ingrese OT o LLS",
        required: true,
        maxLength: 120,
      },
      {
        name: "motivo_visita",
        label: "Motivo de visita",
        type: "text",
        placeholder: "Ingrese el motivo de la visita",
        required: true,
        maxLength: 250,
      },
      {
        name: "ciudad",
        label: "Ciudad",
        type: "text",
        placeholder: "Ingrese la ciudad",
        required: true,
        maxLength: 120,
      },
      {
        name: "aliado",
        label: "Aliado",
        type: "text",
        placeholder: "Ingrese el aliado",
        required: true,
        maxLength: 120,
      },
      {
        name: "dia",
        label: "Día",
        type: "date",
        required: true,
      },
      {
        name: "franja",
        label: "Franja",
        type: "text",
        placeholder: "Ingrese la franja horaria",
        required: true,
        maxLength: 120,
      },
      {
        name: "contacto",
        label: "Contacto",
        type: "tel",
        placeholder: "Ingrese el número de contacto",
        required: true,
        maxLength: 30,
      },
      {
        name: "detalle",
        label: "Detalle",
        type: "textarea",
        placeholder: "Ingrese el detalle de la solicitud",
        required: true,
        maxLength: 1500,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Visita técnica
Cuenta: ${v(datos, "cuenta")}
OT/LLS: ${v(datos, "ot_lls")}
Motivo de visita: ${v(datos, "motivo_visita")}
Ciudad: ${v(datos, "ciudad")}
Aliado: ${v(datos, "aliado")}
Día: ${v(datos, "dia")}
Franja: ${v(datos, "franja")}
Contacto: ${v(datos, "contacto")}
Detalle: ${v(datos, "detalle")}`,
  },
  {
    nombre: "Alarma puntual",
    categoria: "Alarmas",
    descripcion:
      "IMPORTANTE: Se puede enviar a los Back Office o al supervisor.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ingrese la cuenta",
        required: true,
        maxLength: 60,
      },
      {
        name: "orden",
        label: "Orden",
        type: "text",
        placeholder: "Ingrese la orden",
        required: true,
        maxLength: 120,
      },
      {
        name: "radicado_tickler",
        label: "Radicado/tickler",
        type: "text",
        placeholder: "Ingrese el radicado o tickler",
        required: true,
        maxLength: 120,
      },
      {
        name: "tarifa",
        label: "Tarifa",
        type: "text",
        placeholder: "Ingrese la tarifa",
        required: true,
        maxLength: 120,
      },
      {
        name: "asesor",
        label: "Asesor",
        type: "text",
        placeholder: "Ingrese el asesor",
        required: true,
        maxLength: 120,
      },
      {
        name: "detalle_alarma",
        label: "Detalle de la alarma",
        type: "textarea",
        placeholder: "Describa el detalle de la alarma",
        required: true,
        maxLength: 1500,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Alarma puntual
Cuenta: ${v(datos, "cuenta")}
Orden: ${v(datos, "orden")}
Radicado/tickler: ${v(datos, "radicado_tickler")}
Tarifa: ${v(datos, "tarifa")}
Asesor: ${v(datos, "asesor")}
Detalle de la alarma: ${v(datos, "detalle_alarma")}`,
  },
  {
    nombre: "Revista 15 min no llega",
    categoria: "Alarmas",
    descripcion:
      "IMPORTANTE: Dejar la plantilla en la carpeta de RR F7 Gestión cliente críticos y escalar al Back Office desde Genesys.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ingrese la cuenta",
        required: true,
        maxLength: 60,
      },
      {
        name: "nombre_usuario",
        label: "Nombre completo del Usuario",
        type: "text",
        placeholder: "Ingrese el nombre completo",
        required: true,
        maxLength: 160,
      },
      {
        name: "numero_celular",
        label: "Número Celular",
        type: "tel",
        placeholder: "Ingrese el número celular",
        required: true,
        maxLength: 30,
      },
      {
        name: "identificacion_cliente",
        label: "Número de Identificación del Cliente",
        type: "text",
        placeholder: "Ingrese el número de identificación",
        required: true,
        maxLength: 30,
      },
      {
        name: "orden_fecha_activacion",
        label: "Orden y Fecha de activación del Servicio",
        type: "text",
        placeholder: "Ingrese la orden y fecha de activación",
        required: true,
        maxLength: 160,
      },
      {
        name: "detalle_reclamacion",
        label: "Detalle de la reclamación",
        type: "textarea",
        placeholder: "Describa el detalle de la reclamación",
        required: true,
        maxLength: 1500,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Revista 15 min no llega
Cuenta: ${v(datos, "cuenta")}
Nombre completo del Usuario: ${v(datos, "nombre_usuario")}
Número Celular: ${v(datos, "numero_celular")}
Número de Identificación del Cliente: ${v(datos, "identificacion_cliente")}
Orden y Fecha de activación del Servicio: ${v(datos, "orden_fecha_activacion")}
Detalle de la reclamación: ${v(datos, "detalle_reclamacion")}`,
  },
  {
    nombre: "OTT",
    categoria: "Aplicaciones",
    descripcion:
      "IMPORTANTE: Plantilla de OTTs de Mi Asistencia 360. Solicitar pantallazos de los errores al cliente. Dejar la plantilla en la carpeta de RR F7 Gestión cliente críticos y escalar al Back Office desde Genesys.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ej. 92837465",
        required: true,
        maxLength: 60,
      },
      {
        name: "cedula",
        label: "Cédula (si es móvil)",
        type: "text",
        placeholder: "Ej. 1020304050",
        maxLength: 30,
      },
      {
        name: "correo",
        label: "Correo electrónico",
        type: "email",
        placeholder: "Ej. cliente@gmail.com",
        required: true,
        maxLength: 160,
      },
      {
        name: "nombre_ott",
        label: "Nombre de OTT",
        type: "text",
        placeholder: "Ej. Netflix",
        required: true,
        maxLength: 120,
      },
      {
        name: "otts",
        label: "OTTs",
        type: "text",
        placeholder: "Ej. Netflix, Max, Paramount+",
        required: true,
        maxLength: 250,
      },
      ...camposAccesoApp,
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Requerimiento Mi Asistencia 360 - OTT
Cuenta: ${v(datos, "cuenta")}
Cédula (si es móvil): ${v(datos, "cedula")}
Correo electrónico: ${v(datos, "correo")}

DATOS OTTs
Nombre de ott: ${v(datos, "nombre_ott")}
Otts: ${v(datos, "otts")}

DATOS DEL ACCESO
Fecha y hora de falla: ${v(datos, "fecha_hora_falla")}
Dispositivo utilizado (computador o teléfono): ${v(datos, "dispositivo")}
Marca o modelo de equipo: ${v(datos, "marca_modelo")}
Sistema operativo (iOS, Android, etc.): ${v(datos, "sistema_operativo")}
Versión del App: ${v(datos, "version_app")}
Tipo de acceso a la red (Wifi o LAN): ${v(datos, "acceso_red")}
Navegador: ${v(datos, "navegador")}
¿Utiliza Proxy?: ${v(datos, "utiliza_proxy")}`,
  },
  {
    nombre: "Claro Drive",
    categoria: "Aplicaciones",
    descripcion:
      "IMPORTANTE: Plantilla de Claro Drive de Mi Asistencia 360. Solicitar pantallazos de los errores al cliente. Dejar la plantilla en la carpeta de RR F7 Gestión cliente críticos y escalar al Back Office desde Genesys.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ej. 92837465",
        required: true,
        maxLength: 60,
      },
      {
        name: "cedula",
        label: "Cédula (si es móvil)",
        type: "text",
        placeholder: "Ej. 1020304050",
        maxLength: 30,
      },
      {
        name: "correo",
        label: "Correo electrónico",
        type: "email",
        placeholder: "Ej. cliente@gmail.com",
        required: true,
        maxLength: 160,
      },
      {
        name: "numero_contacto",
        label: "Número de contacto",
        type: "tel",
        placeholder: "Ej. 3101234567",
        required: true,
        maxLength: 30,
      },
      {
        name: "mensaje_error",
        label: "Mensaje de error",
        type: "text",
        placeholder: "Ej. Error de autenticación 500",
        required: true,
        maxLength: 250,
      },
      {
        name: "tipo_suscripcion",
        label: "Tipo de suscripción (Paga o Bundle)",
        type: "select",
        required: true,
        options: opciones(["Paga", "Bundle"]),
      },
      ...camposAccesoApp,
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Requerimiento Mi Asistencia 360 - Claro Drive
Cuenta: ${v(datos, "cuenta")}
Cédula (si es móvil): ${v(datos, "cedula")}
Correo electrónico: ${v(datos, "correo")}

DATOS CLARO DRIVE
Número de contacto: ${v(datos, "numero_contacto")}
Mensaje de error: ${v(datos, "mensaje_error")}
Tipo de suscripción (Paga o Bundle): ${v(datos, "tipo_suscripcion")}

DATOS DEL ACCESO
Fecha y hora de falla: ${v(datos, "fecha_hora_falla")}
Dispositivo utilizado (computador o teléfono): ${v(datos, "dispositivo")}
Marca o modelo de equipo: ${v(datos, "marca_modelo")}
Sistema operativo (iOS, Android, etc.): ${v(datos, "sistema_operativo")}
Versión del App: ${v(datos, "version_app")}
Tipo de acceso a la red (Wifi o LAN): ${v(datos, "acceso_red")}
Navegador: ${v(datos, "navegador")}
¿Utiliza Proxy?: ${v(datos, "utiliza_proxy")}`,
  },
  {
    nombre: "Pagos no aplicados",
    categoria: "Pagos",
    descripcion:
      "IMPORTANTE: Enviar correo al asunto indicado especificando el tipo de cuenta (PAGOS NO APLICADOS CUENTA...). Adjuntar evidencias del pago. Responden de 24 a 72 horas hábiles y se registra la respuesta en notas F7 o tickler como PWA.",
    campos: [
      {
        name: "cuenta_tipo",
        label:
          "Tipo de cuenta (línea móvil, cuenta hogar o crédito equipo)",
        type: "text",
        placeholder: "Indique el tipo y número de cuenta",
        required: true,
        maxLength: 120,
      },
      {
        name: "nombre_completo",
        label: "Nombre completo",
        type: "text",
        placeholder: "Ingrese el nombre completo",
        required: true,
        maxLength: 160,
      },
      {
        name: "documento",
        label: "Documento",
        type: "text",
        placeholder: "Ingrese el documento",
        required: true,
        maxLength: 30,
      },
      {
        name: "dia_pago",
        label: "Día del pago realizado",
        type: "date",
        required: true,
      },
      {
        name: "medio_pago",
        label: "Medio de pago",
        type: "select",
        required: true,
        options: opciones([
          "App Mi Claro",
          "Banco",
          "Pasarela PSE",
          "Portal Pagos Claro",
        ]),
      },
      {
        name: "valor_pagado",
        label: "Valor pagado",
        type: "text",
        placeholder: "Ej. $50.000",
        required: true,
        maxLength: 60,
      },
    ],
    formato: (datos) =>
      `Para: pagos@claro.com.co
Asunto: PAGOS NO APLICADOS CUENTA (${v(datos, "cuenta_tipo") || "LÍNEA MÓVIL, CUENTA HOGAR, CRÉDITO EQUIPO"})
Nombre completo: ${v(datos, "nombre_completo")}
Documento: ${v(datos, "documento")}
Día del pago realizado: ${v(datos, "dia_pago")}
Medio de pago: ${v(datos, "medio_pago")}
Valor pagado: ${v(datos, "valor_pagado")}`,
  },
  {
    nombre: "Creación de visita error T&D",
    categoria: "Visita técnica",
    descripcion:
      "IMPORTANTE: Enviar al apoyo en piso por Teams, junto con el pantallazo del error de T&D y los datos de la plantilla.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ingrese la cuenta",
        required: true,
        maxLength: 60,
      },
      {
        name: "nombre_cliente",
        label: "Nombre cliente",
        type: "text",
        placeholder: "Ingrese el nombre completo",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula",
        label: "Cédula",
        type: "text",
        placeholder: "Ingrese el documento",
        required: true,
        maxLength: 30,
      },
      {
        name: "id_td",
        label: "Id de T&D",
        type: "text",
        placeholder: "Ingrese el ID de T&D",
        required: true,
        maxLength: 120,
      },
      {
        name: "razon_envio_visita",
        label: "Razón de envío de visita",
        type: "textarea",
        placeholder: "Describa la razón",
        required: true,
        maxLength: 1500,
      },
      {
        name: "tecnologia",
        label: "HFC / FTTH",
        type: "select",
        required: true,
        options: opciones(["HFC", "FTTH"]),
      },
      {
        name: "usuario_asesor",
        label: "Usuario asesor",
        type: "text",
        placeholder: "Ingrese el usuario del asesor",
        required: true,
        maxLength: 120,
      },
      {
        name: "aliado",
        label: "Aliado",
        type: "text",
        placeholder: "INDRA",
        required: true,
        maxLength: 120,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Creación de visita error T&D
Cuenta: ${v(datos, "cuenta")}
Nombre cliente: ${v(datos, "nombre_cliente")}
Cédula: ${v(datos, "cedula")}
Id de T&D: ${v(datos, "id_td")}
Razón de envío de visita: ${v(datos, "razon_envio_visita")}
HFC / FTTH: ${v(datos, "tecnologia")}
Usuario asesor: ${v(datos, "usuario_asesor")}
Aliado: ${v(datos, "aliado") || "INDRA"}`,
  },
  {
    nombre: "McAfee",
    categoria: "Aplicaciones",
    descripcion:
      "IMPORTANTE: Dejar esta plantilla en la carpeta de RR F7 Gestión cliente críticos y escalar al Back Office desde Genesys.",
    campos: [
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ingrese la cuenta",
        required: true,
        maxLength: 60,
      },
      {
        name: "nombre_titular",
        label: "Nombre titular",
        type: "text",
        placeholder: "Ingrese el nombre del titular",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula",
        label: "Cédula",
        type: "text",
        placeholder: "Ingrese el documento",
        required: true,
        maxLength: 30,
      },
      {
        name: "orden_activacion",
        label: "Orden de trabajo donde se activó McAfee",
        type: "text",
        placeholder: "Ingrese la orden de trabajo",
        required: true,
        maxLength: 120,
      },
      {
        name: "codigo_mcafee",
        label: "Código de McAfee",
        type: "text",
        placeholder: "Ingrese el código",
        required: true,
        maxLength: 120,
      },
      {
        name: "correo",
        label: "Correo electrónico",
        type: "email",
        placeholder: "Ingrese el correo electrónico",
        required: true,
        maxLength: 160,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
McAfee
Cuenta: ${v(datos, "cuenta")}
Nombre titular: ${v(datos, "nombre_titular")}
Cédula: ${v(datos, "cedula")}
Orden de trabajo donde se activó McAfee: ${v(datos, "orden_activacion")}
Código de McAfee: ${v(datos, "codigo_mcafee")}
Correo electrónico: ${v(datos, "correo")}`,
  },
  {
    nombre: "Escalamiento Cartera",
    categoria: "Cartera",
    descripcion:
      "IMPORTANTE: Primero se debe validar que el cliente no tenga deuda ni en RR ni en AC (apoyarse con certificado de cuenta al día). Si no tiene deuda, preguntar dónde le indican pagar y escalar por Mi Asistencia 360 > Catálogo > Servicios para cliente > Cartera.",
    campos: [
      {
        name: "nombre_cliente_notificaciones",
        label: "Nombre de cliente con notificaciones de cobro",
        type: "text",
        placeholder: "Ingrese el nombre del cliente",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula_cliente",
        label: "Cédula",
        type: "text",
        placeholder: "Ingrese el documento",
        required: true,
        maxLength: 30,
      },
      {
        name: "numero_contacto_cobros",
        label: "Número de contacto donde llegan los cobros",
        type: "tel",
        placeholder: "Ingrese el número de contacto",
        required: true,
        maxLength: 30,
      },
      {
        name: "ultimo_mensaje_cobro",
        label: "Último mensaje de cobro",
        type: "textarea",
        placeholder: "Ingrese el último mensaje recibido",
        required: true,
        maxLength: 1500,
      },
      {
        name: "nombre_deudor",
        label: "Nombre de quien tiene deuda",
        type: "text",
        placeholder: "Ingrese el nombre del deudor",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula_deudor",
        label: "Cédula",
        type: "text",
        placeholder: "Ingrese el documento del deudor",
        required: true,
        maxLength: 30,
      },
      {
        name: "cuenta",
        label: "Cuenta",
        type: "text",
        placeholder: "Ingrese la cuenta",
        required: true,
        maxLength: 60,
      },
      {
        name: "ultimo_pago",
        label: "Último pago",
        type: "text",
        placeholder: "Ingrese la fecha o valor del último pago",
        required: true,
        maxLength: 120,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Escalamiento Cartera
Nombre de cliente con notificaciones de cobro: ${v(datos, "nombre_cliente_notificaciones")}
Cédula: ${v(datos, "cedula_cliente")}
Número de contacto donde llegan los cobros: ${v(datos, "numero_contacto_cobros")}
Último mensaje de cobro: ${v(datos, "ultimo_mensaje_cobro")}
Nombre de quien tiene deuda: ${v(datos, "nombre_deudor")}
Cédula: ${v(datos, "cedula_deudor")}
Cuenta: ${v(datos, "cuenta")}
Último pago: ${v(datos, "ultimo_pago")}`,
  },
  {
    nombre: "Materialización PQR",
    categoria: "PQR",
    descripcion:
      "IMPORTANTE: Dejar esta plantilla en la carpeta de RR F7 Gestión cliente críticos y escalar al Back Office desde Genesys.",
    campos: [
      {
        name: "cuenta_min",
        label: "Cuenta o Min",
        type: "text",
        placeholder: "Ingrese cuenta o MIN",
        required: true,
        maxLength: 60,
      },
      {
        name: "pqr_cum",
        label: "PQR o Cum",
        type: "text",
        placeholder: "Ingrese PQR o CUM",
        required: true,
        maxLength: 120,
      },
      {
        name: "fecha_respuesta_sap",
        label: "Fecha de respuesta SAP",
        type: "date",
        required: true,
      },
      {
        name: "asesor_responde",
        label: "Asesor que responde",
        type: "text",
        placeholder: "Ingrese el asesor",
        required: true,
        maxLength: 120,
      },
      {
        name: "carpeta_tickler",
        label: "Carpeta F7 o tickler donde está la respuesta",
        type: "text",
        placeholder: "Ingrese carpeta o tickler",
        required: true,
        maxLength: 160,
      },
      {
        name: "descripcion",
        label: "Descripción",
        type: "textarea",
        placeholder: "Describa el caso",
        required: true,
        maxLength: 1500,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Materialización PQR
Cuenta o Min: ${v(datos, "cuenta_min")}
PQR o Cum: ${v(datos, "pqr_cum")}
Fecha de respuesta SAP: ${v(datos, "fecha_respuesta_sap")}
Asesor que responde: ${v(datos, "asesor_responde")}
Carpeta F7 o tickler donde está la respuesta: ${v(datos, "carpeta_tickler")}
Descripción: ${v(datos, "descripcion")}`,
  },
  {
    nombre: "Modificación envío equipo",
    categoria: "Logística equipos",
    descripcion:
      "IMPORTANTE: Cuando el cliente informa que la dirección de envío del equipo es incorrecta. Se escala a través de Mi Asistencia 360 > Catálogo > Servicios para el cliente Claro > Asesorías y Solicitudes - Soluciones Transversales - Logística Equipos.",
    campos: [
      {
        name: "nombre_cliente",
        label: "Nombre de cliente",
        type: "text",
        placeholder: "Ingrese el nombre del cliente",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula",
        label: "Cédula",
        type: "text",
        placeholder: "Ingrese el documento",
        required: true,
        maxLength: 30,
      },
      {
        name: "credito",
        label: "Crédito",
        type: "text",
        placeholder: "Ingrese el crédito",
        required: true,
        maxLength: 60,
      },
      {
        name: "equipo",
        label: "Equipo",
        type: "text",
        placeholder: "Ingrese el equipo",
        required: true,
        maxLength: 160,
      },
      {
        name: "solicitud",
        label: "Solicitud",
        type: "textarea",
        placeholder: "Describa la solicitud",
        required: true,
        maxLength: 1500,
      },
      {
        name: "direccion",
        label: "Dirección",
        type: "text",
        placeholder: "Ingrese la dirección correcta",
        required: true,
        maxLength: 250,
      },
      {
        name: "estado_logytech",
        label: "Estado en Logytech",
        type: "text",
        placeholder: "Ingrese el estado",
        required: true,
        maxLength: 120,
      },
      {
        name: "numero_contacto",
        label: "Número de contacto",
        type: "tel",
        placeholder: "Ingrese el número de contacto",
        required: true,
        maxLength: 30,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Modificación envío equipo
Nombre de cliente: ${v(datos, "nombre_cliente")}
Cédula: ${v(datos, "cedula")}
Crédito: ${v(datos, "credito")}
Equipo: ${v(datos, "equipo")}
Solicitud: ${v(datos, "solicitud")}
Dirección: ${v(datos, "direccion")}
Estado en Logytech: ${v(datos, "estado_logytech")}
Número de contacto: ${v(datos, "numero_contacto")}`,
  },
  {
    nombre: "Eliminación plan de pagos Ascard",
    categoria: "Logística equipos",
    descripcion:
      "IMPORTANTE: Cuando el cliente posee un crédito pero se requiere eliminar el plan de pagos por motivo de no entrega del equipo. Se escala a través de Mi Asistencia 360 > Catálogo > Servicios para el cliente Claro > Asesorías y Solicitudes - Soluciones Transversales - Logística Equipos.",
    campos: [
      {
        name: "nombre_cliente",
        label: "Nombre de cliente",
        type: "text",
        placeholder: "Ingrese el nombre del cliente",
        required: true,
        maxLength: 160,
      },
      {
        name: "cedula",
        label: "Cédula",
        type: "text",
        placeholder: "Ingrese el documento",
        required: true,
        maxLength: 30,
      },
      {
        name: "credito",
        label: "Crédito",
        type: "text",
        placeholder: "Ingrese el crédito",
        required: true,
        maxLength: 60,
      },
      {
        name: "equipo",
        label: "Equipo",
        type: "text",
        placeholder: "Ingrese el equipo",
        required: true,
        maxLength: 160,
      },
      {
        name: "solicitud",
        label: "Solicitud",
        type: "textarea",
        placeholder: "Describa la solicitud",
        required: true,
        maxLength: 1500,
      },
      {
        name: "estado_logytech",
        label: "Estado en Logytech",
        type: "text",
        placeholder: "Ingrese el estado",
        required: true,
        maxLength: 120,
      },
      {
        name: "fecha_recibido_bodega",
        label: "Fecha de recibido en bodega",
        type: "date",
        required: true,
      },
    ],
    formato: (datos) =>
      `PLANTILLAS DE GESTIÓN
Eliminación plan de pagos Ascard
Nombre de cliente: ${v(datos, "nombre_cliente")}
Cédula: ${v(datos, "cedula")}
Crédito: ${v(datos, "credito")}
Equipo: ${v(datos, "equipo")}
Solicitud: ${v(datos, "solicitud")}
Estado en Logytech: ${v(datos, "estado_logytech")}
Fecha de recibido en bodega: ${v(datos, "fecha_recibido_bodega")}`,
  },
];

export const CATEGORIAS = Array.from(
  new Set(PLANTILLAS.map((plantilla) => plantilla.categoria)),
);

export function getPlantilla(tipologia: string): Plantilla | undefined {
  return PLANTILLAS.find((plantilla) => plantilla.nombre === tipologia);
}

export function getCampo(
  tipologia: string,
  campoNombre: string,
): CampoPlantilla | undefined {
  return getPlantilla(tipologia)?.campos.find(
    (campo) => campo.name === campoNombre,
  );
}

export function generarTextoPlantilla(
  tipologia: string,
  datos: DatosPlantilla,
): string {
  const plantilla = getPlantilla(tipologia);
  if (!plantilla) return "";
  return plantilla.formato(datos);
}

export function formatearValorCampo(
  campo: CampoPlantilla | undefined,
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  const option = campo?.options?.find((item) => item.value === raw);
  return option?.label ?? raw;
}
