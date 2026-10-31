// IndexedDB storage for Super Redes - Asistente para Asesores Técnicos
import { KnowledgeItem, Conversation, UserSession } from '../types';

export type { KnowledgeItem };

const DB_NAME = 'asesores_tecnicos_kb';
const DB_VERSION = 2;
const STORE_KB = 'knowledge_items';
const STORE_CONV = 'conversations';

export const DEFAULT_USER: UserSession = {
  id: 'user-asesor-1',
  name: 'Asesor Técnico',
  email: 'asesor@superredes.com',
  role: 'advisor',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_KB)) {
        db.createObjectStore(STORE_KB, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CONV)) {
        db.createObjectStore(STORE_CONV, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Knowledge Base Functions
export async function getAllKnowledgeItems(): Promise<KnowledgeItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KB, 'readonly');
    const store = transaction.objectStore(STORE_KB);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result as KnowledgeItem[]) || [];
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveKnowledgeItem(item: KnowledgeItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KB, 'readwrite');
    const store = transaction.objectStore(STORE_KB);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KB, 'readwrite');
    const store = transaction.objectStore(STORE_KB);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllKnowledgeItems(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_KB, 'readwrite');
    const store = transaction.objectStore(STORE_KB);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Conversations Functions
export async function getAllConversations(): Promise<Conversation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CONV, 'readonly');
    const store = transaction.objectStore(STORE_CONV);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result as Conversation[]) || [];
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CONV, 'readwrite');
    const store = transaction.objectStore(STORE_CONV);
    const request = store.put(conv);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CONV, 'readwrite');
    const store = transaction.objectStore(STORE_CONV);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export const SAMPLE_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: 'sample-procedimiento-traslados',
    name: 'Procedimiento_Oficial_Traslados_y_Casos_Super_Redes.txt',
    type: 'file',
    fileType: 'txt',
    category: 'Procedimientos',
    charCount: 4100,
    size: 4100,
    createdAt: Date.now() - 7200000,
    createdBy: 'admin@superredes.co',
    updatedAt: Date.now() - 7200000,
    updatedBy: 'admin@superredes.co',
    content: `SUPER REDES - PROCEDIMIENTO OFICIAL DE SOLICITUDES DE TRASLADO Y ATENCIÓN TÉCNICA (2025)

============================================================
1. SOLICITUDES DE TRASLADO DE SERVICIO: REGLAS Y PROCEDIMIENTOS
============================================================

Existen dos tipos de traslado con políticas, costos y validaciones distintas:

------------------------------------------------------------
CASO 1: TRASLADO INTERNO (DENTRO DEL MISMO PREDIO O INMUEBLE)
------------------------------------------------------------
• ¿Qué es?: Cambio de ubicación física del módem ONT / router a otra habitación, piso o sector dentro de la misma vivienda, local o inmueble.
• Requisitos indispensables:
  a) Solicitud realizada por el titular del contrato o persona mayor de edad expresamente autorizada.
  b) Servicio activo y al día en pagos (sin suspensión por mora).
  c) Equipos en buen estado físico.
• Costo oficial: $45.000 COP. Se carga automáticamente a la siguiente factura mensual del cliente. (Queda prohibido entregar dinero en efectivo al personal técnico en el domicilio).
• Plazo de atención: Visita técnica programada en un lapso de 24 a 48 horas hábiles.
• Instrucción de acción para el asesor:
  1. Validar en el sistema CRM que la cuenta esté al día y sin órdenes de suspensión.
  2. Generar orden de trabajo tipo "OT - Traslado Interno de Equipo".
  3. Indicar al cliente que debe estar presente un mayor de edad y tener despejada la ruta por donde pasará el cableado.
• Justificación lógica y técnica (¿Por qué se hace así?):
  La fibra óptica es un filamento de vidrio extremadamente sensible que no puede doblarse en ángulos cerrados (radio de curvatura menor a 30 mm) ni empalmarse con cinta. Se requiere un técnico certificado para tender un nuevo tramo de cable drop óptico, realizar conectorización mecánica o por fusión y calibrar la potencia óptica (rango ideal: -15 dBm a -24 dBm) para no degradar la velocidad ni causar microcortes.

------------------------------------------------------------
CASO 2: TRASLADO EXTERNO (MUDANZA A NUEVA DIRECCIÓN O DOMICILIO)
------------------------------------------------------------
• ¿Qué es?: Cambio de domicilio del cliente a otra vivienda, conjunto residencial o barrio.

• PASO 1 OBLIGATORIO: VALIDACIÓN DE COBERTURA Y FACTIBILIDAD TÉCNICA
  El asesor DEBE solicitar la dirección exacta de destino antes de radicar la solicitud:
  - Municipio y Barrio.
  - Dirección completa (Calle, Carrera, Número, Conjunto, Torre, Bloque, Apto/Casa).
  El asesor consulta en la plataforma de red la caja NAP más cercana (distancia máxima permitida: 300 metros) y verifica que disponga de puertos ópticos libres.

• PASO 2 OBLIGATORIO: VALIDACIÓN DE ESTADO DE CUENTA (PAZ Y SALVO)
  La cuenta debe encontrarse a PAZ Y SALVO (al día sin facturas vencidas). Si registra saldo pendiente, el cliente debe pagar antes de ingresar la orden de traslado.

• SUB-CASO 2A: SI HAY COBERTURA EN LA NUEVA DIRECCIÓN
  1. Radicar la orden "OT - Traslado Externo de Domicilio".
  2. Plazo de instalación técnica: 3 a 5 días hábiles.
  3. Costo oficial: $60.000 COP, facturados en la siguiente mensualidad (no pagar en efectivo al instalador).
  4. Instrucción CRÍTICA sobre los equipos: El cliente DEBE desconectar con cuidado y transportar personalmente sus equipos (módem ONT, cables de poder, decodificadores de televisión y controles) al nuevo domicilio. El técnico llegará a la nueva dirección a tender la acometida desde el poste y conectar los equipos del cliente.

• SUB-CASO 2B: SI NO HAY COBERTURA EN LA NUEVA DIRECCIÓN
  Si en la nueva dirección no existe infraestructura de Super Redes o los puertos de la caja NAP están copados:
  - No es posible realizar la instalación por inviabilidad técnica de red.
  - Opción 1: Cesión de contrato sin costo a la persona que ingrese a habitar el predio actual (nuevo inquilino o familiar).
  - Opción 2: Cancelación del contrato sin penalización por fuerza mayor (falta de cobertura técnica), coordinando la entrega de los equipos en oficina principal o recogida técnica autorizada.

• Justificación lógica y técnica (¿Por qué se hace así?):
  a) Se valida cobertura primero porque es materialmente imposible conectar un servicio si no hay cable troncal de fibra ni puertos ópticos disponibles en la caja NAP. Agendar sin cobertura enviaría al técnico a perder tiempo y frustraría al cliente.
  b) El paz y salvo es mandatorio porque el sistema ERP bloquea la creación de órdenes de servicio en contratos con cartera vencida.
  c) El cliente traslada sus equipos porque la ONT ya se encuentra aprovisionada con su perfil de velocidad y configuración en la OLT central; además previene pérdidas de equipos y evita cobros adicionales por reposición.

------------------------------------------------------------
CASO 3: CESIÓN DE CONTRATO (CAMBIO DE TITULARIDAD)
------------------------------------------------------------
• ¿Qué es?: Traspaso del contrato a otra persona sin suspender el servicio (ideal si el cliente se muda y otra persona se queda en el predio).
• Requisitos:
  1. Formulario oficial de cesión firmado por cedente y cesionario.
  2. Fotocopia legible de documento de identidad de ambas partes.
  3. Contrato completamente a paz y salvo.
• Costo: Trámite 100% gratuito. Plazo: 24 a 48 horas hábiles.
• Justificación: Traslada legal y financieramente las obligaciones del contrato al nuevo usuario.

------------------------------------------------------------
CASO 4: SOPORTE TÉCNICO POR LUZ "LOS" EN ROJO O TITILANDO
------------------------------------------------------------
• ¿Qué significa?: Pérdida total de señal óptica (Loss of Signal).
• Procedimiento:
  1. Verificar que el cable fino amarillo de fibra no esté doblado en ángulo de 90° ni pisado.
  2. Reiniciar la ONT desconectándola de la energía 30 segundos.
  3. Si la luz LOS sigue en rojo, generar ticket de soporte técnico por corte de fibra. No tiene costo para el cliente si es fallo de red externa.`
  },
  {
    id: 'sample-plantillas-asesor',
    name: 'Plantillas_Oficiales_del_Asesor_Super_Redes.txt',
    type: 'file',
    fileType: 'txt',
    category: 'Procedimientos',
    charCount: 3800,
    size: 3800,
    createdAt: Date.now() - 5400000,
    createdBy: 'admin@superredes.co',
    updatedAt: Date.now() - 5400000,
    updatedBy: 'admin@superredes.co',
    content: `SUPER REDES - GUÍA OFICIAL DE PLANTILLAS DEL ASESOR PARA EL CLIENTE (2025)

Estas son las plantillas institucionales por las que se guían los asesores de atención y soporte para comunicarse con los clientes:

1. PLANTILLA TRASLADO INTERNO (MISMO PREDIO):
"¡Hola, [Nombre del Cliente]! Con gusto te colaboramos con la reubicación de tus equipos de internet dentro de tu domicilio.

📋 Información y condiciones del servicio:
• Plazo de atención: La visita técnica se programa en un lapso de 24 a 48 horas hábiles.
• Costo oficial: $45.000 COP, los cuales se cargarán automáticamente a tu siguiente factura mensual. (Por tu seguridad, ningún técnico está autorizado para recibir dinero en efectivo en el domicilio).
• Requisito indispensable: Debe estar presente una persona mayor de edad y tener despejada la ruta por donde pasará el cableado de fibra óptica.

¿Nos confirmas tu número de documento de identidad y en qué horario te queda mejor recibir al técnico para radicar la orden de trabajo?"

2. PLANTILLA TRASLADO EXTERNO - PASO 1 (VALIDACIÓN DE COBERTURA Y DATOS):
"¡Hola, [Nombre del Cliente]! Con gusto atendemos tu solicitud de traslado de servicio a tu nueva dirección.

Para verificar la disponibilidad técnica de fibra óptica y puertos en tu nuevo sector, por favor compártenos los siguientes datos:
1. Municipio y Barrio de destino.
2. Dirección exacta (Calle / Carrera, Número, Conjunto / Torre / Apto o Casa).
3. Nombre completo y cédula del titular del contrato.

Una vez verifiquemos la cobertura en el sistema y confirmemos que tu cuenta se encuentra al día a paz y salvo, procederemos de inmediato con la programación del traslado. ¡Quedamos atentos a tus datos!"

3. PLANTILLA TRASLADO EXTERNO - PASO 2 (COBERTURA APROBADA Y TRASLADO DE EQUIPOS):
"¡Excelente noticia, [Nombre del Cliente]! Hemos validado cobertura técnica disponible en tu nueva dirección y confirmamos que tu cuenta se encuentra al día a paz y salvo.

📋 Condiciones y agendamiento del traslado:
• Plazo de instalación: Visita técnica programada entre 3 y 5 días hábiles.
• Costo del servicio: $60.000 COP, facturados en tu próxima mensualidad. (Recuerda no entregar dinero en efectivo al instalador).
• IMPORTANTE - TRASLADO DE EQUIPOS: Tú mismo(a) debes desconectar con cuidado y transportar personalmente tus equipos (módem ONT, cable de poder, decodificadores y controles) a tu nuevo domicilio. Nuestro técnico llegará a la nueva dirección a tender la acometida desde el poste y conectar tus equipos.

¿Nos confirmas por favor un número de celular de contacto activo para que el técnico te llame antes de la visita?"

4. PLANTILLA TRASLADO EXTERNO - SIN COBERTURA (ALTERNATIVAS OFICIALES):
"Estimado(a) [Nombre del Cliente], lamentamos informarte que tras validar nuestra red técnica, en este momento no contamos con cobertura de fibra óptica ni puertos disponibles en la dirección solicitada.

Por este motivo te ofrecemos dos alternativas oficiales de Super Redes:
1. Cesión de Contrato (100% gratuita): Si una persona (familiar, amigo o nuevo habitante) se queda en tu predio actual, podemos traspasarle el servicio a su nombre sin ningún costo ni interrupción del servicio.
2. Cancelación por Falta de Cobertura sin penalización: Al tratarse de una limitación técnica de red, puedes solicitar la terminación del contrato sin penalidad, coordinando únicamente la entrega de los equipos en nuestra oficina principal.

Indícanos por favor cuál de estas dos opciones prefieres gestionar para orientarte de inmediato con los requisitos."

5. PLANTILLA CESIÓN DE CONTRATO (CAMBIO DE TITULARIDAD):
"¡Hola, [Nombre del Cliente]! Claro que sí, el trámite de cesión o traspaso de contrato en Super Redes es 100% gratuito y no genera interrupción en tu servicio.

📋 Requisitos obligatorios:
1. Formulario oficial de Cesión diligenciado y firmado tanto por el titular actual (cedente) como por el nuevo titular (cesionario).
2. Fotocopia legible del documento de identidad de ambas partes (cédula por ambas caras).
3. Contrato a Paz y Salvo (sin facturas pendientes de pago).

El tiempo de procesamiento y actualización en sistema es de 24 a 48 horas hábiles. ¿Deseas que te compartamos el formulario digital para su diligenciamiento?"

6. PLANTILLA FALLA LUZ LOS ROJA:
"¡Hola, [Nombre del Cliente]! La luz 'LOS' en color rojo o titilando en tu módem indica que se interrumpió la señal de fibra óptica que llega a tu domicilio.

Por favor realiza estas dos validaciones rápidas:
1. Revisa que el cable delgado amarillo de fibra no esté doblado en ángulo cerrado, pisado por muebles o desconectado.
2. Desconecta el módem de la toma de corriente durante 30 segundos y vuelve a conectarlo.

Si después de 2 minutos la luz LOS continúa en rojo, por favor confírmanos tu dirección exacta y un número de celular de contacto para generar de inmediato un ticket de visita técnica prioritaria (sin ningún costo si la falla es de la red externa)."

7. PLANTILLA PAGO PSE Y FACTURACIÓN:
"¡Hola, [Nombre del Cliente]! Con gusto te compartimos nuestros canales oficiales para realizar el pago de tu factura de manera rápida, segura y con confirmación inmediata:

💳 Pasarela de Pago PSE y Tarjetas: https://pagos.superredes.com/pse-directo
📄 Consulta de Factura Electrónica: https://soporte.superredes.com/facturacion

El enlace genera un comprobante oficial con código de autorización en tiempo real y, en caso de suspensión por pago, el sistema realiza la reconexión automática del servicio en un lapso de 15 a 30 minutos. ¿Deseas que te validemos el valor exacto facturado a la fecha?"`
  },
  {
    id: 'sample-manual-super-redes',
    name: 'Manual_Operativo_Super_Redes_2025.txt',
    type: 'file',
    fileType: 'txt',
    category: 'Pagos',
    charCount: 2200,
    size: 2200,
    createdAt: Date.now() - 3600000,
    createdBy: 'admin@superredes.co',
    updatedAt: Date.now() - 3600000,
    updatedBy: 'admin@superredes.co',
    content: `SUPER REDES - MANUAL OPERATIVO Y GUÍA RÁPIDA PARA ASESORES TÉCNICOS (2025)

1. ENLACES DE PAGO OFICIALES PARA CLIENTES
- Pasarela Principal PSE y Tarjetas: https://pagos.superredes.com/pse-directo
- Enlace Express para Diagnóstico Rápido: https://pagos.superredes.com/express-checkout
- Pasarela Internacional PayPal / Tarjeta Extranjera: https://pagos.superredes.com/international-usd
- Portal de Consulta y Facturación Electrónica: https://soporte.superredes.com/facturacion

Instrucción al asesor: Entrega el enlace directo correspondiente al cliente indicando que el enlace tiene validez de 24 horas y genera comprobante automático con código de autorización inmediata.

2. LISTA OFICIAL DE PRECIOS Y TARIFAS 2025 (IVA incluido)
- Traslado interno de equipo en el mismo domicilio: $45.000 COP (cargado a siguiente factura).
- Traslado externo a nuevo domicilio (con cobertura): $60.000 COP (cargado a siguiente factura).
- Diagnóstico técnico estándar en laboratorio: $35.000 COP (o $15 USD). Si el cliente aprueba la reparación posterior, el diagnóstico no se cobra.
- Mantenimiento preventivo general (limpieza física, pasta térmica, calibración): $85.000 COP ($30 USD).
- Mantenimiento correctivo especializado: $130.000 COP ($48 USD) + costo de repuestos.
- Servicio prioritario a domicilio / en sitio (atención en menos de 2 horas): $120.000 COP ($45 USD).
- Reinstalación de sistema operativo y software base autorizado: $60.000 COP ($22 USD).
- Copia de seguridad y recuperación de datos (hasta 500GB): $90.000 COP ($32 USD).

3. REQUISITOS OBLIGATORIOS PARA SOLICITAR GARANTÍA
Para radicar una solicitud de garantía técnica en Super Redes, el cliente debe presentar:
a) Factura electrónica de compra original o número de pedido verificado.
b) Número de serie (S/N) legible del producto (ubicado en etiqueta plateada o en el menú de ajustes).
c) Que los sellos de seguridad originales no estén rotos, manipulados o removidos.
d) Que la solicitud se encuentre dentro de los 365 días calendario posteriores a la entrega del producto.
e) Descripción detallada de la falla o síntoma observado.

4. POLÍTICAS Y ALCANCE DE GARANTÍAS
- Diagnóstico de garantía: Máximo 48 horas hábiles desde la recepción física del equipo.
- Si el fallo es atribuible a defecto de fábrica, el repuesto y la mano de obra son 100% cubiertos, sin costo de flete.
- EXCLUSIONES DE GARANTÍA: No están cubiertos daños por derrame de líquidos o humedad, sobrevoltaje eléctrico por tormentas sin protector, golpes o caídas físicas, o modificaciones no autorizadas de software/hardware.
- En caso de cambio de equipo nuevo por garantía, debe solicitarse dentro de los primeros 15 días continuos de la compra, con empaque original y todos sus accesorios intactos.`
  },
  {
    id: 'sample-portales-super-redes',
    name: 'https://soporte.superredes.com/recursos-asesores',
    type: 'url',
    url: 'https://soporte.superredes.com/recursos-asesores',
    category: 'Procedimientos',
    charCount: 850,
    createdAt: Date.now() - 1800000,
    createdBy: 'admin@superredes.co',
    updatedAt: Date.now() - 1800000,
    updatedBy: 'admin@superredes.co',
    content: `Portal de Recursos y Herramientas Super Redes para Asesores Técnicos:
- Enlace de radicación de tickets de soporte nivel 2: https://tickets.superredes.com/escalar-caso
- Enlace para descarga de firmwares y controladores oficiales: https://drivers.superredes.com/descargas
- Estado de la red y servidores en tiempo real: https://status.superredes.com
- Enlace para agendar visita de técnico presencial: https://citas.superredes.com/agendar-visita
- Enlace de formulario de satisfacción y PQRS: https://soporte.superredes.com/pqrs`
  }
];
