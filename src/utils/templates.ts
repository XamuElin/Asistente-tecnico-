export interface AdvisorTemplate {
  id: string;
  category: 'traslados' | 'soporte' | 'pagos' | 'contratos' | 'garantias' | 'protocolo';
  categoryLabel: string;
  title: string;
  shortDesc: string;
  clientTemplate: string;
  advisorGuidance: string;
  recommendedQuery: string;
}

export const ADVISOR_TEMPLATES: AdvisorTemplate[] = [
  {
    id: 'tpl-traslado-interno',
    category: 'traslados',
    categoryLabel: 'Traslados',
    title: 'Traslado Interno (Mismo Predio / Habitación)',
    shortDesc: 'Reubicación de módem o router en la misma vivienda o local ($45.000 COP, 24-48h).',
    clientTemplate: `¡Hola, [Nombre del Cliente]! Con gusto te colaboramos con la reubicación de tus equipos de internet dentro de tu domicilio.

📋 Información y condiciones del servicio:
• Plazo de atención: La visita técnica se programa en un lapso de 24 a 48 horas hábiles.
• Costo oficial: $45.000 COP, los cuales se cargarán automáticamente a tu siguiente factura mensual. (Por tu seguridad, ningún técnico está autorizado para recibir dinero en efectivo en el domicilio).
• Requisito indispensable: Debe estar presente una persona mayor de edad y tener despejada la ruta por donde pasará el cableado de fibra óptica.

¿Nos confirmas tu número de documento de identidad y en qué horario te queda mejor recibir al técnico para radicar la orden de trabajo?`,
    advisorGuidance: `1. Caso: Traslado Interno dentro del mismo predio.
2. Pasos en CRM:
   - Validar que la cuenta esté al día y sin órdenes de suspensión.
   - Generar Orden de Trabajo tipo "OT - Traslado Interno de Equipo" ($45.000 COP cargados a factura).
   - Indicar al cliente que despeje el área de paso del cable.
3. Justificación técnica (¿Por qué?): La fibra óptica es un filamento de vidrio que no admite dobleces bruscos (<30 mm) ni empalmes caseros; se requiere técnico certificado para recablear, conectorizar y calibrar potencia (-15 a -24 dBm).`,
    recommendedQuery: '¿Cómo se gestiona el traslado interno de equipos y cuál es su costo?',
  },
  {
    id: 'tpl-traslado-externo-paso1',
    category: 'traslados',
    categoryLabel: 'Traslados',
    title: 'Traslado Externo - Paso 1: Solicitud de Dirección y Validación de Cobertura',
    shortDesc: 'Paso obligatorio antes de radicar: pedir dirección exacta para verificar caja NAP y factibilidad.',
    clientTemplate: `¡Hola, [Nombre del Cliente]! Con gusto atendemos tu solicitud de traslado de servicio a tu nueva dirección.

Para verificar la disponibilidad técnica de fibra óptica y puertos en tu nuevo sector, por favor compártenos los siguientes datos:
1. Municipio y Barrio de destino.
2. Dirección exacta (Calle / Carrera, Número, Conjunto / Torre / Apto o Casa).
3. Nombre completo y cédula del titular del contrato.

Una vez verifiquemos la cobertura en el sistema y confirmemos que tu cuenta se encuentra al día a paz y salvo, procederemos de inmediato con la programación del traslado. ¡Quedamos atentos a tus datos!`,
    advisorGuidance: `1. Caso: Traslado Externo de Domicilio (Paso 1).
2. Pasos en CRM:
   - NUNCA agendar sin verificar cobertura.
   - Buscar en el mapa de red la caja NAP más cercana (máximo 300 metros permitidos).
   - Verificar si tiene puertos ópticos libres.
   - Validar estado de cuenta en el ERP (debe estar a PAZ Y SALVO).
3. Justificación técnica (¿Por qué?): Si no hay fibra o puertos libres en la caja NAP es imposible conectar el servicio. Validar primero evita citas fallidas y quejas graves.`,
    recommendedQuery: '¿Qué datos se deben pedir al cliente para validar cobertura de traslado externo?',
  },
  {
    id: 'tpl-traslado-externo-aprobado',
    category: 'traslados',
    categoryLabel: 'Traslados',
    title: 'Traslado Externo - Paso 2: Cobertura Aprobada y Traslado de Equipos',
    shortDesc: 'Factibilidad confirmada: agendamiento (3-5 días, $60.000 COP) y aviso de llevar sus equipos.',
    clientTemplate: `¡Excelente noticia, [Nombre del Cliente]! Hemos validado cobertura técnica disponible en tu nueva dirección y confirmamos que tu cuenta se encuentra al día.

📋 Condiciones y agendamiento del traslado:
• Plazo de instalación: Visita técnica programada entre 3 y 5 días hábiles.
• Costo del servicio: $60.000 COP, facturados en tu próxima mensualidad. (Recuerda no entregar dinero en efectivo al instalador).
• IMPORTANTE - TRASLADO DE EQUIPOS: Tú mismo(a) debes desconectar con cuidado y transportar personalmente tus equipos (módem ONT, cable de poder, decodificadores y controles) a tu nuevo domicilio. Nuestro técnico llegará a la nueva dirección a tender la acometida desde el poste y conectar tus equipos.

¿Nos confirmas por favor un número de celular de contacto activo para que el técnico te llame antes de la visita?`,
    advisorGuidance: `1. Caso: Traslado Externo con Cobertura y Paz y Salvo confirmados.
2. Pasos en CRM:
   - Radicar "OT - Traslado Externo de Domicilio" ($60.000 COP diferidos a factura).
   - Asignar puerto de caja NAP reservado.
   - Reiterar al cliente que traslade sus equipos personalmente.
3. Justificación técnica (¿Por qué?): La ONT ya está configurada con su perfil y serial en la OLT central; el cliente los traslada para evitar pérdidas en tránsito y costos de reposición.`,
    recommendedQuery: '¿Cuáles son las condiciones y qué pasa con los equipos en un traslado externo con cobertura?',
  },
  {
    id: 'tpl-traslado-externo-sin-cobertura',
    category: 'traslados',
    categoryLabel: 'Traslados',
    title: 'Traslado Externo - Sin Cobertura / Alternativas Oficiales',
    shortDesc: 'Inviabilidad de red: ofrecer Cesión de Contrato gratuita o Cancelación sin penalidad.',
    clientTemplate: `Estimado(a) [Nombre del Cliente], lamentamos informarte que tras validar nuestra red técnica, en este momento no contamos con cobertura de fibra óptica ni puertos disponibles en la dirección solicitada.

Por este motivo te ofrecemos dos alternativas oficiales de Super Redes:
1. Cesión de Contrato (100% gratuita): Si una persona (familiar, amigo o nuevo habitante) se queda en tu predio actual, podemos traspasarle el servicio a su nombre sin ningún costo ni interrupción del servicio.
2. Cancelación por Falta de Cobertura sin penalización: Al tratarse de una limitación técnica de red, puedes solicitar la terminación del contrato sin penalidad, coordinando únicamente la entrega de los equipos en nuestra oficina principal.

Indícanos por favor cuál de estas dos opciones prefieres gestionar para orientarte de inmediato con los requisitos.`,
    advisorGuidance: `1. Caso: Traslado Externo inviable por falta de cobertura técnica.
2. Pasos en CRM:
   - Marcar solicitud como "No Factible por Cobertura".
   - Ofrecer Cesión de Contrato si hay nuevo inquilino.
   - Si solicita cancelación, radicar por causal "Fuerza Mayor - Falta de Cobertura" sin cobro de cláusula de permanencia, y generar orden de recojo o entrega de equipos en sede.
3. Justificación técnica (¿Por qué?): Es ilegal penalizar al usuario cuando la imposibilidad de prestar el servicio es atribuible a la infraestructura de la empresa.`,
    recommendedQuery: '¿Qué se debe hacer si no hay cobertura en la nueva dirección del cliente?',
  },
  {
    id: 'tpl-cesion-contrato',
    category: 'contratos',
    categoryLabel: 'Contratos',
    title: 'Cesión de Contrato (Cambio de Titularidad)',
    shortDesc: 'Traspaso formal a otra persona (trámite 100% gratuito, 24-48h).',
    clientTemplate: `¡Hola, [Nombre del Cliente]! Claro que sí, el trámite de cesión o traspaso de contrato en Super Redes es 100% gratuito y no genera interrupción en tu servicio.

📋 Requisitos obligatorios:
1. Formulario oficial de Cesión diligenciado y firmado tanto por el titular actual (cedente) como por el nuevo titular (cesionario).
2. Fotocopia legible del documento de identidad de ambas partes (cédula por ambas caras).
3. Contrato a Paz y Salvo (sin facturas pendientes de pago).

El tiempo de procesamiento y actualización en sistema es de 24 a 48 horas hábiles. ¿Deseas que te compartamos el formulario digital para su diligenciamiento?`,
    advisorGuidance: `1. Caso: Cesión de Contrato.
2. Pasos en CRM:
   - Validar que no haya facturas vencidas.
   - Adjuntar formulario firmado y cédulas legibles en el expediente del cliente.
   - Realizar cambio de titular en CRM/ERP y notificar a ambas partes (plazo 24-48h).
3. Justificación legal (¿Por qué?): Transfiere formalmente derechos y deberes contractuales al nuevo titular sin cortar el servicio.`,
    recommendedQuery: '¿Cuáles son los requisitos y el costo de una cesión de contrato?',
  },
  {
    id: 'tpl-falla-los-rojo',
    category: 'soporte',
    categoryLabel: 'Soporte',
    title: 'Falla Luz "LOS" en Rojo o Titilando (Pérdida de Señal)',
    shortDesc: 'Pérdida de señal óptica: descarte de cable amarillo, reinicio de 30s y ticket técnico.',
    clientTemplate: `¡Hola, [Nombre del Cliente]! La luz "LOS" en color rojo o titilando en tu módem indica que se interrumpió la señal de fibra óptica que llega a tu domicilio.

Por favor realiza estas dos validaciones rápidas:
1. Revisa que el cable delgado amarillo de fibra no esté doblado en ángulo cerrado, pisado por muebles o desconectado.
2. Desconecta el módem de la toma de corriente durante 30 segundos y vuelve a conectarlo.

Si después de 2 minutos la luz LOS continúa en rojo, por favor confírmanos tu dirección exacta y un número de celular de contacto para generar de inmediato un ticket de visita técnica prioritaria (sin ningún costo si la falla es de la red externa).`,
    advisorGuidance: `1. Caso: Falla LOS en rojo (Loss of Signal).
2. Pasos en CRM:
   - Consultar en OLT el estado del puerto PON (verificar si es falla individual o masiva de sector).
   - Si no es masiva y el reinicio no recupera señal, generar "Ticket Nivel 2 - Corte de Fibra Óptica".
   - Programar visita técnica prioritaria (<24 horas).
3. Justificación técnica (¿Por qué?): LOS rojo significa potencia óptica menor a -30 dBm o cable cortado; el técnico debe medir potencia y fusionar nuevamente la fibra.`,
    recommendedQuery: '¿Qué se debe hacer cuando la luz LOS del módem está en rojo o titilando?',
  },
  {
    id: 'tpl-pago-pse',
    category: 'pagos',
    categoryLabel: 'Pagos',
    title: 'Consulta de Factura y Enlace de Pago PSE Oficial',
    shortDesc: 'Enlace oficial PSE y tarjetas con confirmación inmediata y reconexión en 15-30 min.',
    clientTemplate: `¡Hola, [Nombre del Cliente]! Con gusto te compartimos nuestros canales oficiales para realizar el pago de tu factura de manera rápida, segura y con confirmación inmediata:

💳 Pasarela de Pago PSE y Tarjetas: https://pagos.superredes.com/pse-directo
📄 Consulta de Factura Electrónica: https://soporte.superredes.com/facturacion

El enlace genera un comprobante oficial con código de autorización en tiempo real y, en caso de suspensión por pago, el sistema realiza la reconexión automática del servicio en un lapso de 15 a 30 minutos. ¿Deseas que te validemos el valor exacto facturado a la fecha?`,
    advisorGuidance: `1. Caso: Solicitud de Enlace de Pago y Consulta de Saldo.
2. Pasos en CRM:
   - Verificar saldo actual y fecha límite de pago.
   - Brindar el enlace oficial directo de PSE (https://pagos.superredes.com/pse-directo).
   - Informar que la reconexión automática toma entre 15 y 30 minutos tras el reporte de la pasarela.`,
    recommendedQuery: '¿Cuál es el enlace oficial de pago PSE y facturación para enviarle al cliente?',
  },
  {
    id: 'tpl-garantia-equipos',
    category: 'garantias',
    categoryLabel: 'Garantías',
    title: 'Requisitos y Radicación de Garantía Técnica de Equipos',
    shortDesc: 'Requisitos obligatorios: factura, serial legible, sellos intactos y menos de 365 días.',
    clientTemplate: `¡Hola, [Nombre del Cliente]! Con gusto te orientamos en el proceso de garantía técnica de tus equipos con Super Redes.

📋 Requisitos indispensables para radicar la garantía:
1. Factura electrónica original de compra o número de pedido verificado.
2. Número de serie (S/N) legible del producto y sellos de seguridad intactos (sin roturas ni signos de manipulación).
3. Que la solicitud esté dentro de los 365 días calendario de garantía.
4. Descripción de la falla que presenta el equipo.

El diagnóstico técnico se realiza en un plazo máximo de 48 horas hábiles. Si la falla corresponde a un defecto de fábrica, el repuesto y la mano de obra son 100% cubiertos por Super Redes. ¿Nos compartes por favor el número de serie de tu equipo para validarlo en sistema?`,
    advisorGuidance: `1. Caso: Solicitud de Garantía Técnica.
2. Pasos en CRM:
   - Validar antigüedad de compra (menor a 365 días) y número de serie en base de datos.
   - Crear orden de servicio de laboratorio "OS - Garantía Técnica".
   - Recordar exclusiones: daños por líquidos, descargas eléctricas sin supresor de picos, golpes físicos o sellos rotos.`,
    recommendedQuery: '¿Cuáles son los requisitos obligatorios para solicitar una garantía de equipos?',
  },
  {
    id: 'tpl-saludo-protocolario',
    category: 'protocolo',
    categoryLabel: 'Protocolo',
    title: 'Saludo Inicial y Validación de Identidad',
    shortDesc: 'Saludo institucional, presentación del asesor y solicitud de datos del titular.',
    clientTemplate: `¡Hola! Bienvenido(a) al canal oficial de atención y soporte técnico de Super Redes. Mi nombre es [Nombre del Asesor] y será un gusto colaborarte el día de hoy.

Para brindarte una atención personalizada y segura, ¿me podrías indicar por favor tu nombre completo y número de cédula o código de contrato?`,
    advisorGuidance: `1. Caso: Saludo y apertura de conversación.
2. Pasos en CRM: Buscar de inmediato al cliente por cédula o número de contrato para tener visible su historial técnico, estado de cuenta y plan contratado.`,
    recommendedQuery: '¿Cuál es el saludo protocolario para iniciar la conversación con un cliente?',
  },
  {
    id: 'tpl-despedida-protocolaria',
    category: 'protocolo',
    categoryLabel: 'Protocolo',
    title: 'Despedida Institucional y Encuesta de Calidad',
    shortDesc: 'Cierre de conversación, verificación de dudas y enlace a PQRS / satisfacción.',
    clientTemplate: `Ha sido un verdadero placer atenderte el día de hoy, [Nombre del Cliente]. ¿Hay algo más en lo que pueda orientarte o colaborarte respecto a tus servicios de Super Redes?

Te invitamos a dejarnos tu opinión sobre la atención brindada en este enlace: https://soporte.superredes.com/pqrs. ¡Que tengas un excelente día!`,
    advisorGuidance: `1. Caso: Cierre y tipificación de conversación.
2. Pasos en CRM: Tipificar la llamada o chat con el motivo exacto de la consulta y cerrar el ticket o dejarlo en seguimiento si queda orden pendiente.`,
    recommendedQuery: '¿Cuál es la plantilla oficial de despedida y calificación para el cliente?',
  },
];
