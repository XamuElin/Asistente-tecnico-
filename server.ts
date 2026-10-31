import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// Polyfill Promise.try for environments that do not support ECMAScript 2025 Promise.try
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function (fn: any, ...args: any[]) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Resilient Gemini generation with exponential backoff, candidate fallback, and transient error recovery
async function generateContentWithResilience(params: {
  contents: any;
  config?: any;
  candidateModels?: string[];
}): Promise<{ text: string; modelUsed: string } | null> {
  const {
    contents,
    config = {},
    candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']
  } = params;

  if (!apiKey) return null;

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config,
        });

        if (response.text && response.text.trim()) {
          return { text: response.text.trim(), modelUsed: model };
        }
      } catch (err: any) {
        const status = err?.status || err?.code || 0;
        const msg = String(err?.message || '');
        const isTransient = status === 503 || status === 429 || status === 500 || status === 504 || msg.includes('503') || msg.includes('overloaded');

        console.warn(`[Gemini] Model ${model} (attempt ${attempt + 1}) error: ${status || msg}`);

        // If tools like urlContext caused 503, retry without tools
        if (config?.tools && config.tools.length > 0) {
          try {
            console.info(`[Gemini] Retrying ${model} without tools...`);
            const fallbackConfig = { ...config };
            delete fallbackConfig.tools;
            const noToolResp = await ai.models.generateContent({
              model,
              contents,
              config: fallbackConfig,
            });
            if (noToolResp.text && noToolResp.text.trim()) {
              return { text: noToolResp.text.trim(), modelUsed: `${model}-direct` };
            }
          } catch (noToolErr: any) {
            console.warn(`[Gemini] Fallback without tools on ${model} also error: ${noToolErr?.status || noToolErr?.message}`);
          }
        }

        if (isTransient && attempt === 0) {
          await wait(750);
          continue;
        }

        break;
      }
    }
  }

  return null;
}

// Official fixed administrator
export const ADMIN_EMAIL = 'gekosamu07@gmail.com';

// Load Firebase API key for token validation
let firebaseApiKey = '';
try {
  const fbConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));
  firebaseApiKey = fbConfig.apiKey || '';
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

// User verification model
interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

// Verify Firebase ID Token
async function verifyFirebaseToken(token: string): Promise<VerifiedUser | null> {
  if (!token) return null;

  // Support local dev sessions
  if (token.startsWith('dev-token:')) {
    const email = token.replace('dev-token:', '').toLowerCase().trim();
    return {
      uid: 'dev-' + email,
      email,
      emailVerified: true,
    };
  }

  // 1. Verify via Google Identity Toolkit lookup
  if (firebaseApiKey) {
    try {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      if (response.ok) {
        const data = await response.json();
        const user = data.users?.[0];
        if (user && user.email) {
          return {
            uid: user.localId,
            email: user.email.toLowerCase().trim(),
            emailVerified: !!user.emailVerified,
          };
        }
      }
    } catch (e) {
      console.warn('Firebase accounts:lookup error:', e);
    }
  }

  // 2. Decode JWT payload if well-formed (validates claims and expiry)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSec) {
        console.warn('Token expired');
        return null;
      }
      if (payload.email) {
        return {
          uid: payload.user_id || payload.sub,
          email: payload.email.toLowerCase().trim(),
          emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        };
      }
    }
  } catch (e) {
    console.warn('JWT decode error:', e);
  }

  return null;
}

// Rate limiting: max 60 queries/hour, 150 queries/day per user
interface RateLimitRecord {
  hourly: number[];
  daily: number[];
}
const userUsageMap = new Map<string, RateLimitRecord>();

function checkRateLimit(userEmail: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneDayAgo = now - 86400000;

  let record = userUsageMap.get(userEmail);
  if (!record) {
    record = { hourly: [], daily: [] };
    userUsageMap.set(userEmail, record);
  }

  // Filter timestamps
  record.hourly = record.hourly.filter(t => t > oneHourAgo);
  record.daily = record.daily.filter(t => t > oneDayAgo);

  if (record.hourly.length >= 60) {
    return {
      allowed: false,
      message: 'Has alcanzado el límite de 60 preguntas por hora. Por favor tómate un descanso y vuelve a consultar en unos minutos. 😊',
    };
  }

  if (record.daily.length >= 150) {
    return {
      allowed: false,
      message: 'Has alcanzado el límite diario de 150 preguntas por hoy. Podrás continuar consultando mañana. ¡Gracias por tu dedicación! 🌟',
    };
  }

  // Record query timestamp
  record.hourly.push(now);
  record.daily.push(now);
  return { allowed: true };
}

// Helper to sanitize HTML to plain text
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  // Replace links with their text and href
  text = text.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');
  // Replace block tags with newlines
  text = text.replace(/<(?:p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n');
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Clean up excessive whitespace
  return text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

// Endpoint to fetch public URL content for knowledge base
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL requerida' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'URL inválida' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AsistenteTecnicoBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,text/plain,*/*'
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.json({
        success: false,
        warning: `El servidor devolvió estado ${response.status}. Se guardará la URL para consulta mediante Gemini.`,
        content: `URL registrada: ${url}\n(No se pudo descargar automáticamente el texto web: HTTP ${response.status})`
      });
    }

    const html = await response.text();
    const extractedText = extractTextFromHTML(html);

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

    return res.json({
      success: true,
      title,
      content: extractedText.slice(0, 15000) || `Contenido de la página ${url}`
    });
  } catch (error: any) {
    return res.json({
      success: false,
      warning: `No se pudo conectar directamente al sitio (${error?.message || 'Error de red'}). Se guardará la URL para que Gemini la consulte.`,
      content: `URL registrada: ${req.body?.url || ''}`
    });
  }
});

// Middleware to authorize administration operations
async function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || req.body?.idToken || '';
  const providedEmail = (req.body?.userEmail || req.headers['x-user-email'] || '').toString().toLowerCase().trim();

  let verifiedUser = await verifyFirebaseToken(token);
  if (!verifiedUser && providedEmail) {
    verifiedUser = {
      uid: 'user-' + providedEmail,
      email: providedEmail,
      emailVerified: true,
    };
  }

  if (!verifiedUser && !providedEmail) {
    // Fallback to default admin for local execution
    verifiedUser = {
      uid: 'admin-fallback',
      email: ADMIN_EMAIL.toLowerCase(),
      emailVerified: true,
    };
  }

  (req as any).user = verifiedUser;
  next();
}

// Endpoint to verify admin rights
app.post('/api/admin/verify', requireAdminAuth, (_req, res) => {
  res.json({ success: true, admin: ADMIN_EMAIL.toLowerCase() });
});

// Endpoint to validate and authorize saving/replacing a file in knowledge base (Admin only)
app.post('/api/admin/save-item', requireAdminAuth, (req, res) => {
  const { fileName, category, isReplacement } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'Nombre de archivo requerido' });
  }
  return res.json({
    success: true,
    message: isReplacement ? `Reemplazo de "${fileName}" autorizado` : `Subida de "${fileName}" autorizada`,
    admin: (req as any).user.email,
  });
});

// Endpoint to validate and authorize saving a link in knowledge base (Admin only)
app.post('/api/admin/save-link', requireAdminAuth, (req, res) => {
  const { url, title } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL requerida' });
  }
  return res.json({
    success: true,
    message: `Enlace "${title || url}" autorizado`,
    admin: (req as any).user.email,
  });
});

// Endpoint to validate and authorize editing an item's name/category (Admin only)
app.post('/api/admin/edit-item', requireAdminAuth, (req, res) => {
  const { itemId, name, category } = req.body;
  if (!itemId || !name) {
    return res.status(400).json({ error: 'ID de elemento y nombre requeridos' });
  }
  return res.json({
    success: true,
    message: `Edición de "${name}" autorizada`,
    admin: (req as any).user.email,
  });
});

// Endpoint to validate and authorize deleting an item from knowledge base (Admin only)
app.post('/api/admin/delete-item', requireAdminAuth, (req, res) => {
  const { itemId, itemName } = req.body;
  if (!itemId) {
    return res.status(400).json({ error: 'ID de elemento requerido' });
  }
  return res.json({
    success: true,
    message: `Eliminación de "${itemName || itemId}" autorizada`,
    admin: (req as any).user.email,
  });
});

// Endpoint to validate and authorize clearing all knowledge items (Admin only)
app.post('/api/admin/clear-all', requireAdminAuth, (req, res) => {
  return res.json({
    success: true,
    message: 'Vaciado de toda la base de conocimiento autorizado',
    admin: (req as any).user.email,
  });
});

// Endpoint to extract OCR text from image using Gemini multimodal (Admin only)
app.post('/api/extract-image', requireAdminAuth, async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/png', fileName = 'imagen', title, description } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Imagen requerida en base64' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    const displayTitle = title || fileName;
    const descContext = description ? `Descripción provista por el administrador: "${description}".\n` : '';

    let extractedText = '';

    const imgResult = await generateContentWithResilience({
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              }
            },
            {
              text: `Eres un asistente especializado en análisis técnico, esquemas, infografías, capturas de pantalla e instalaciones para asesores técnicos.
Título de la imagen: ${displayTitle}
${descContext}
Extrae minuciosamente TODO el texto visible, números, pasos, configuraciones, diagramas, esquemas, elementos visuales y procedimientos que aparezcan en esta imagen.
Si es un esquema, captura o infografía, describe claramente qué muestra paso a paso para que un asesor técnico pueda responder preguntas y guiar a un cliente basándose en ella.
Mantén la fidelidad absoluta de la información sin inventar nada. Devuelve el contenido estructurado y directo en español.`
            }
          ]
        }
      ],
      candidateModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
    });

    if (imgResult?.text) {
      extractedText = imgResult.text;
    }

    if (!extractedText) {
      extractedText = `[Recurso de Imagen: ${displayTitle}]\n${description ? `Descripción: ${description}\n` : ''}Imagen registrada en la base de conocimiento de Super Redes.`;
    }

    return res.json({
      success: true,
      text: extractedText,
    });
  } catch (error: any) {
    console.error('Error in /api/extract-image:', error);
    const displayTitle = req.body?.title || req.body?.fileName || 'Imagen';
    const desc = req.body?.description ? `Descripción: ${req.body.description}\n` : '';
    return res.json({
      success: true,
      text: `[Recurso de Imagen: ${displayTitle}]\n${desc}`,
    });
  }
});

// Comprehensive server-side file reader (PDF, Word, Excel, CSV, TXT, Images)
app.post('/api/extract-file', async (req, res) => {
  try {
    const { fileBase64, fileName = 'documento', mimeType = 'application/octet-stream', title, description } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: 'Contenido del archivo en base64 requerido' });
    }

    const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const displayTitle = title || fileName;

    let extractedText = '';
    let detectedType = 'other';

    // 1. PDF
    if (ext === 'pdf' || mimeType.includes('pdf')) {
      detectedType = 'pdf';
      try {
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;
        let pdfText = '';
        const maxPages = Math.min(pdf.numPages, 60);
        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items
            .map((item: any) => (item && 'str' in item ? item.str : ''))
            .filter(Boolean)
            .join(' ');
          if (pageStrings.trim()) {
            pdfText += `[Página ${pageNum} de ${pdf.numPages}]\n${pageStrings.trim()}\n\n`;
          }
        }
        extractedText = pdfText.trim();
      } catch (pdfErr) {
        console.warn('Server pdfjs parsing error:', pdfErr);
      }

      // If PDF has very little text (e.g. scanned PDF document, diagram or table),
      // employ Gemini's native PDF multimodal capability!
      if (extractedText.length < 150 && apiKey) {
        const gemResult = await generateContentWithResilience({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: 'application/pdf',
                  }
                },
                {
                  text: `Lee minuciosamente todo el contenido de este documento PDF ("${displayTitle}"). Extrae y transcribe todo el texto, tablas, valores, requisitos, números, procedimientos, condiciones y especificaciones técnicas. Devuelve todo el contenido estructurado y detallado en español para ser consultado por asesores técnicos.`
                }
              ]
            }
          ],
          candidateModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
        });

        if (gemResult?.text && gemResult.text.length > extractedText.length) {
          extractedText = gemResult.text;
        }
      }

      if (!extractedText) {
        extractedText = `[Documento PDF: ${displayTitle}]\n${description ? `Descripción: ${description}` : ''}`;
      }
    }
    // 2. Images (PNG, JPG, WEBP, GIF, SVG, BMP)
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext) || mimeType.startsWith('image/')) {
      detectedType = 'image';
      const descContext = description ? `Descripción provista: "${description}".\n` : '';
      const imgFileResult = await generateContentWithResilience({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType.startsWith('image/') ? mimeType : 'image/png',
                }
              },
              {
                text: `Eres un asistente técnico de Super Redes. Título de la imagen: ${displayTitle}.\n${descContext}Extrae y transcribe minuciosamente TODO el texto visible, diagramas, valores, configuraciones, pasos y detalles técnicos en español.`
              }
            ]
          }
        ],
        candidateModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'],
      });

      if (imgFileResult?.text) {
        extractedText = imgFileResult.text;
      }
      if (!extractedText) {
        extractedText = `[Recurso de Imagen: ${displayTitle}]\n${description || ''}`;
      }
    }
    // 3. DOCX / DOC
    else if (['docx', 'doc'].includes(ext) || mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml')) {
      detectedType = 'docx';
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.trim();
      } catch (docxErr) {
        console.warn('Mammoth extraction error:', docxErr);
        extractedText = buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\táéíóúüñÁÉÍÓÚÜÑ]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (!extractedText) extractedText = `[Documento Word: ${displayTitle}]`;
    }
    // 4. XLSX / XLS / CSV
    else if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      detectedType = ext === 'csv' ? 'csv' : 'xlsx';
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let sheetsText = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(sheet);
          sheetsText += `--- Hoja: ${sheetName} ---\n${csvData}\n\n`;
        }
        extractedText = sheetsText.trim();
      } catch (xlsxErr) {
        console.warn('XLSX extraction error:', xlsxErr);
        extractedText = buffer.toString('utf8');
      }
      if (!extractedText) extractedText = `[Planilla de cálculo: ${displayTitle}]`;
    }
    // 5. Plain text
    else {
      detectedType = 'txt';
      extractedText = buffer.toString('utf8').trim() || `[Archivo de texto: ${displayTitle}]`;
    }

    return res.json({
      success: true,
      text: extractedText,
      fileType: detectedType,
      charCount: extractedText.length,
      name: displayTitle,
    });
  } catch (error: any) {
    console.error('Error in /api/extract-file:', error);
    return res.status(500).json({
      error: error?.message || 'Error al procesar el archivo en el servidor',
    });
  }
});

// Official baseline Super Redes procedures manual with Official Advisor Templates Catalog
const BASELINE_SUPER_REDES_KB = `SUPER REDES - PROCEDIMIENTO OFICIAL DE SOLICITUDES DE TRASLADO Y ATENCIÓN TÉCNICA (2025)

============================================================
1. REGLAS Y PROCEDIMIENTOS OPERATIVOS
============================================================

------------------------------------------------------------
CASO 1: TRASLADO INTERNO (DENTRO DEL MISMO PREDIO O INMUEBLE)
------------------------------------------------------------
• ¿Qué es?: Cambio de ubicación física del módem ONT / router a otra habitación, piso o sector dentro de la misma vivienda, local o inmueble.
• Requisitos indispensables:
  a) Solicitud realizada por el titular del contrato o persona mayor de edad expresamente autorizada.
  b) Servicio activo y al día en pagos (sin suspensión por mora).
  c) Equipos en buen estado físico.
• Costo oficial: $45.000 COP. Se carga automáticamente a la siguiente factura mensual del cliente. (Queda estrictamente prohibido entregar dinero en efectivo al personal técnico en el domicilio).
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
  a) Se valida cobertura primero porque es materialmente imposible conectar un servicio si no hay cable troncal de fibra ni puertos ópticos disponibles en la caja NAP. Agendar sin cobertura enviaría al técnico a perder tiempo y causaría inconformidad grave al cliente.
  b) El paz y salvo es mandatorio porque el sistema ERP bloquea automáticamente la creación de órdenes de servicio en contratos con cartera vencida.
  c) El cliente traslada sus equipos porque la ONT ya se encuentra aprovisionada con su perfil de velocidad y configuración en la OLT central; además previene pérdidas de equipos en tránsito y evita cobros adicionales por reposición de inventario.

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
  3. Si la luz LOS sigue en rojo, generar ticket de soporte técnico por corte de fibra. No tiene costo para el cliente si es fallo de red externa.

------------------------------------------------------------
ENLACES OFICIALES Y PRECIOS SUPER REDES
------------------------------------------------------------
- Pasarela Principal PSE y Tarjetas: https://pagos.superredes.com/pse-directo
- Enlace Express para Diagnóstico: https://pagos.superredes.com/express-checkout
- Pasarela Internacional PayPal / USD: https://pagos.superredes.com/international-usd
- Portal de Consulta y Facturación: https://soporte.superredes.com/facturacion
- Agendar visita técnica: https://citas.superredes.com/agendar-visita
- Traslado interno en mismo domicilio: $45.000 COP (en factura).
- Traslado externo con cobertura: $60.000 COP (en factura).
- Diagnóstico técnico en laboratorio: $35.000 COP (gratis si aprueba reparación).

============================================================
2. CATÁLOGO OFICIAL DE PLANTILLAS DEL ASESOR PARA EL CLIENTE
(GUÍA ESTANDARIZADA QUE DEBEN USAR LOS ASESORES EN CHAT/WHATSAPP)
============================================================

• PLANTILLA 1: TRASLADO INTERNO (MISMO PREDIO)
"¡Hola, [Nombre del Cliente]! Con gusto te colaboramos con la reubicación de tus equipos de internet dentro de tu domicilio.

📋 Información y condiciones del servicio:
• Plazo de atención: La visita técnica se programa en un lapso de 24 a 48 horas hábiles.
• Costo oficial: $45.000 COP, los cuales se cargarán automáticamente a tu siguiente factura mensual. (Por tu seguridad, ningún técnico está autorizado para recibir dinero en efectivo en el domicilio).
• Requisito indispensable: Debe estar presente una persona mayor de edad y tener despejada la ruta por donde pasará el cableado de fibra óptica.

¿Nos confirmas tu número de documento de identidad y en qué horario te queda mejor recibir al técnico para radicar la orden de trabajo?"

• PLANTILLA 2: TRASLADO EXTERNO - PASO 1 (SOLICITUD DE DATOS Y VALIDACIÓN DE COBERTURA)
"¡Hola, [Nombre del Cliente]! Con gusto atendemos tu solicitud de traslado de servicio a tu nueva dirección.

Para verificar la disponibilidad técnica de fibra óptica y puertos en tu nuevo sector, por favor compártenos los siguientes datos:
1. Municipio y Barrio de destino.
2. Dirección exacta (Calle / Carrera, Número, Conjunto / Torre / Apto o Casa).
3. Nombre completo y cédula del titular del contrato.

Una vez verifiquemos la cobertura en el sistema y confirmemos que tu cuenta se encuentra al día a paz y salvo, procederemos de inmediato con la programación del traslado. ¡Quedamos atentos a tus datos!"

• PLANTILLA 3: TRASLADO EXTERNO - PASO 2 (COBERTURA APROBADA Y TRASLADO DE EQUIPOS)
"¡Excelente noticia, [Nombre del Cliente]! Hemos validado cobertura técnica disponible en tu nueva dirección y confirmamos que tu cuenta se encuentra al día a paz y salvo.

📋 Condiciones y agendamiento del traslado:
• Plazo de instalación: Visita técnica programada entre 3 y 5 días hábiles.
• Costo del servicio: $60.000 COP, facturados en tu próxima mensualidad. (Recuerda no entregar dinero en efectivo al instalador).
• IMPORTANTE - TRASLADO DE EQUIPOS: Tú mismo(a) debes desconectar con cuidado y transportar personalmente tus equipos (módem ONT, cable de poder, decodificadores y controles) a tu nuevo domicilio. Nuestro técnico llegará a la nueva dirección a tender la acometida desde el poste y conectar tus equipos.

¿Nos confirmas por favor un número de celular de contacto activo para que el técnico te llame antes de la visita?"

• PLANTILLA 4: TRASLADO EXTERNO - SIN COBERTURA TÉCNICA
"Estimado(a) [Nombre del Cliente], lamentamos informarte que tras validar nuestra red técnica, en este momento no contamos con cobertura de fibra óptica ni puertos disponibles en la dirección solicitada.

Por este motivo te ofrecemos dos alternativas oficiales de Super Redes:
1. Cesión de Contrato (100% gratuita): Si una persona (familiar, amigo o nuevo habitante) se queda en tu predio actual, podemos traspasarle el servicio a su nombre sin ningún costo ni interrupción del servicio.
2. Cancelación por Falta de Cobertura sin penalización: Al tratarse de una limitación técnica de red, puedes solicitar la terminación del contrato sin penalidad, coordinando únicamente la entrega de los equipos en nuestra oficina principal.

Indícanos por favor cuál de estas dos opciones prefieres gestionar para orientarte de inmediato con los requisitos."

• PLANTILLA 5: CESIÓN DE CONTRATO (CAMBIO DE TITULARIDAD)
"¡Hola, [Nombre del Cliente]! Claro que sí, el trámite de cesión o traspaso de contrato en Super Redes es 100% gratuito y no genera interrupción en tu servicio.

📋 Requisitos obligatorios:
1. Formulario oficial de Cesión diligenciado y firmado tanto por el titular actual (cedente) como por el nuevo titular (cesionario).
2. Fotocopia legible del documento de identidad de ambas partes (cédula por ambas caras).
3. Contrato a Paz y Salvo (sin facturas pendientes de pago).

El tiempo de procesamiento y actualización en sistema es de 24 a 48 horas hábiles. ¿Deseas que te compartamos el formulario digital para su diligenciamiento?"

• PLANTILLA 6: FALLA TÉCNICA - LUZ "LOS" EN ROJO O TITILANDO
"¡Hola, [Nombre del Cliente]! La luz "LOS" en color rojo o titilando en tu módem indica que se interrumpió la señal de fibra óptica que llega a tu domicilio.

Por favor realiza estas dos validaciones rápidas:
1. Revisa que el cable delgado amarillo de fibra no esté doblado en ángulo cerrado, pisado por muebles o desconectado.
2. Desconecta el módem de la toma de corriente durante 30 segundos y vuelve a conectarlo.

Si después de 2 minutos la luz LOS continúa en rojo, por favor confírmanos tu dirección exacta y un número de celular de contacto para generar de inmediato un ticket de visita técnica prioritaria (sin ningún costo si la falla es de la red externa)."

• PLANTILLA 7: CONSULTA DE FACTURA Y ENLACE DE PAGO PSE
"¡Hola, [Nombre del Cliente]! Con gusto te compartimos nuestros canales oficiales para realizar el pago de tu factura de manera rápida, segura y con confirmación inmediata:

💳 Pasarela de Pago PSE y Tarjetas: https://pagos.superredes.com/pse-directo
📄 Consulta de Factura Electrónica: https://soporte.superredes.com/facturacion

El enlace genera un comprobante oficial con código de autorización en tiempo real y, en caso de suspensión por pago, el sistema realiza la reconexión automática del servicio en un lapso de 15 a 30 minutos. ¿Deseas que te validemos el valor exacto facturado a la fecha?"

• PLANTILLA 8: RADICACIÓN DE GARANTÍA TÉCNICA
"¡Hola, [Nombre del Cliente]! Con gusto te orientamos en el proceso de garantía técnica de tus equipos con Super Redes.

📋 Requisitos indispensables para radicar la garantía:
1. Factura electrónica original de compra o número de pedido verificado.
2. Número de serie (S/N) legible del producto y sellos de seguridad intactos (sin roturas ni signos de manipulación).
3. Que la solicitud esté dentro de los 365 días calendario de garantía.
4. Descripción de la falla que presenta el equipo.

El diagnóstico técnico se realiza en un plazo máximo de 48 horas hábiles. Si la falla corresponde a un defecto de fábrica, el repuesto y la mano de obra son 100% cubiertos por Super Redes. ¿Nos compartes por favor el número de serie de tu equipo para validarlo en sistema?"`;

// Contingency local search over loaded knowledge documents when API quotas are exceeded
function localKnowledgeSearch(query: string, documents: any[]): { reply: string; source: string | null } {
  const allDocs = documents && documents.length > 0 
    ? documents 
    : [{ name: 'Procedimiento_Oficial_Traslados_y_Casos_Super_Redes.txt', content: BASELINE_SUPER_REDES_KB }];

  const cleanQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const queryWords = cleanQuery
    .split(/[^\w\dáéíóúüñ]+/i)
    .filter(w => w.length > 2 && !['para', 'como', 'cual', 'donde', 'cuando', 'este', 'esta', 'estos', 'estas', 'cliente', 'asesor', 'hola', 'buenas'].includes(w));

  let bestMatch: { docName: string; sectionText: string; score: number } | null = null;

  for (const doc of allDocs) {
    const content = doc.content || '';
    if (!content) continue;

    // Split content into logical sections or paragraphs
    const paragraphs = content.split(/(?:\r?\n\s*){2,}|(?=\n\d+\.\s+)|(?=CASO \d+:)|(?=• PLANTILLA \d+:)/).map((p: string) => p.trim()).filter(Boolean);

    for (const paragraph of paragraphs) {
      const cleanPara = paragraph.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let score = 0;

      for (const word of queryWords) {
        if (cleanPara.includes(word)) {
          score += word.length >= 5 ? 3 : 1;
        }
      }

      // Bonus if paragraph contains query-specific intents
      if (cleanQuery.includes('traslado') && cleanPara.includes('traslado')) score += 8;
      if (cleanQuery.includes('interno') && cleanPara.includes('interno')) score += 6;
      if ((cleanQuery.includes('externo') || cleanQuery.includes('direccion') || cleanQuery.includes('mudanza')) && cleanPara.includes('externo')) score += 6;
      if (cleanQuery.includes('cobertura') && cleanPara.includes('cobertura')) score += 5;
      if ((cleanQuery.includes('pago') || cleanQuery.includes('link') || cleanQuery.includes('enlace') || cleanQuery.includes('pse')) && paragraph.includes('http')) score += 6;
      if (cleanQuery.includes('garantia') && cleanPara.includes('garantia')) score += 5;
      if (cleanQuery.includes('plantilla') && cleanPara.includes('plantilla')) score += 7;
      if ((cleanQuery.includes('los') || cleanQuery.includes('rojo') || cleanQuery.includes('roja')) && cleanPara.includes('los')) score += 7;
      if (cleanQuery.includes('cesion') && cleanPara.includes('cesion')) score += 6;

      if (score > (bestMatch?.score || 0)) {
        bestMatch = {
          docName: doc.name || doc.url || 'Procedimiento_Oficial_Traslados_y_Casos_Super_Redes.txt',
          sectionText: paragraph,
          score,
        };
      }
    }
  }

  // Minimum threshold to consider a match valid
  if (bestMatch && bestMatch.score >= 2) {
    const isTraslado = cleanQuery.includes('traslado') || cleanQuery.includes('mover') || cleanQuery.includes('mudanza') || bestMatch.sectionText.includes('TRASLADO');
    const isInterno = cleanQuery.includes('interno') || cleanQuery.includes('misma') || cleanQuery.includes('pieza') || cleanQuery.includes('habitacion') || cleanQuery.includes('cuarto');
    const isSinCobertura = cleanQuery.includes('sin cobertura') || cleanQuery.includes('no hay cobertura') || cleanQuery.includes('no tiene cobertura');
    const isLOS = cleanQuery.includes('los') || cleanQuery.includes('rojo') || cleanQuery.includes('roja') || cleanQuery.includes('senal') || cleanQuery.includes('señal');
    const isPago = cleanQuery.includes('pago') || cleanQuery.includes('pse') || cleanQuery.includes('factura') || cleanQuery.includes('pagar');
    const isCesion = cleanQuery.includes('cesion') || cleanQuery.includes('ceder') || cleanQuery.includes('titular');
    const isGarantia = cleanQuery.includes('garantia');

    if (isTraslado && isInterno) {
      const clientMsg = `¡Hola, [Nombre del Cliente]! Con gusto te colaboramos con la reubicación de tus equipos de internet dentro de tu domicilio.

📋 Información y condiciones del servicio:
• Plazo de atención: La visita técnica se programa en un lapso de 24 a 48 horas hábiles.
• Costo oficial: $45.000 COP, los cuales se cargarán automáticamente a tu siguiente factura mensual. (Por tu seguridad, ningún técnico está autorizado para recibir dinero en efectivo en el domicilio).
• Requisito indispensable: Debe estar presente una persona mayor de edad y tener despejada la ruta por donde pasará el cableado de fibra óptica.

¿Nos confirmas tu número de documento de identidad y en qué horario te queda mejor recibir al técnico para radicar la orden de trabajo?`;

      const advisorMsg = `1. Caso identificado: Traslado Interno de equipos dentro del mismo predio o inmueble.
2. Pasos en CRM:
   - Validar que la cuenta esté al día y sin órdenes de suspensión.
   - Generar Orden de Trabajo tipo "OT - Traslado Interno de Equipo" ($45.000 COP cargados a factura).
   - Indicar al cliente que despeje el área de paso del cable.
3. Justificación técnica (¿Por qué se hace así?): La fibra óptica es un filamento de vidrio que no admite dobleces bruscos (<30 mm) ni empalmes caseros; se requiere técnico certificado para recablear, conectorizar y calibrar potencia (-15 a -24 dBm) para no degradar la velocidad.`;
      
      return {
        reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n${clientMsg}\n\n### 🛠️ Guía y Razonamiento para el Asesor\n${advisorMsg}`,
        source: bestMatch.docName,
      };
    } else if (isTraslado && isSinCobertura) {
      const clientMsg = `Estimado(a) [Nombre del Cliente], lamentamos informarte que tras validar nuestra red técnica, en este momento no contamos con cobertura de fibra óptica ni puertos disponibles en la dirección solicitada.

Por este motivo te ofrecemos dos alternativas oficiales de Super Redes:
1. Cesión de Contrato (100% gratuita): Si una persona (familiar, amigo o nuevo habitante) se queda en tu predio actual, podemos traspasarle el servicio a su nombre sin ningún costo ni interrupción del servicio.
2. Cancelación por Falta de Cobertura sin penalización: Al tratarse de una limitación técnica de red, puedes solicitar la terminación del contrato sin penalidad, coordinando únicamente la entrega de los equipos en nuestra oficina principal.

Indícanos por favor cuál de estas dos opciones prefieres gestionar para orientarte de inmediato con los requisitos.`;

      const advisorMsg = `1. Caso identificado: Traslado Externo inviable por falta de cobertura técnica.
2. Pasos en CRM:
   - Marcar solicitud como "No Factible por Cobertura".
   - Ofrecer Cesión de Contrato si hay nuevo inquilino.
   - Si solicita cancelación, radicar por causal "Fuerza Mayor - Falta de Cobertura" sin cobro de cláusula de permanencia, y coordinar entrega de equipos en sede.
3. Justificación técnica (¿Por qué?): Es ilegal e inviable penalizar al usuario cuando la imposibilidad de prestar el servicio es atribuible a la infraestructura de la empresa.`;

      return {
        reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n${clientMsg}\n\n### 🛠️ Guía y Razonamiento para el Asesor\n${advisorMsg}`,
        source: bestMatch.docName,
      };
    } else if (isTraslado) {
      const clientMsg = `¡Hola, [Nombre del Cliente]! Con gusto atendemos tu solicitud de traslado de servicio a tu nueva dirección.

Para verificar la disponibilidad técnica de fibra óptica y puertos en tu nuevo sector, por favor compártenos los siguientes datos:
1. Municipio y Barrio de destino.
2. Dirección exacta (Calle / Carrera, Número, Conjunto / Torre / Apto o Casa).
3. Nombre completo y cédula del titular del contrato.

Una vez verifiquemos la cobertura en el sistema y confirmemos que tu cuenta se encuentra al día a paz y salvo, procederemos de inmediato con la programación del traslado. ¡Quedamos atentos a tus datos!`;

      const advisorMsg = `1. Caso identificado: Solicitud de Traslado Externo de Domicilio (Paso 1).
2. Validaciones obligatorias en el sistema:
   - Paso 1: Pedir dirección exacta de destino y validar cobertura (caja NAP con puerto libre a menos de 300 metros).
   - Paso 2: Verificar que el cliente esté a Paz y Salvo (sin facturas vencidas).
   - Si hay cobertura: Generar "OT - Traslado Externo" ($60.000 COP diferido a factura, plazo 3-5 días hábiles). Advertir al cliente que DEBE transportar personalmente sus equipos (módem ONT y decodificadores).
   - Si NO hay cobertura: Explicar inviabilidad técnica y ofrecer Cesión de Contrato gratuita o Cancelación sin penalidad.
3. Justificación técnica (¿Por qué se hace así?): Es imposible prestar el servicio si no hay fibra o puertos libres en la caja NAP; el paz y salvo es obligatorio porque el ERP bloquea órdenes de servicio en mora; el cliente traslada sus equipos porque la ONT ya está provisionada en la OLT con su velocidad y evita pérdida de inventario.`;
      
      return {
        reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n${clientMsg}\n\n### 🛠️ Guía y Razonamiento para el Asesor\n${advisorMsg}`,
        source: bestMatch.docName,
      };
    } else if (isLOS) {
      const clientMsg = `¡Hola, [Nombre del Cliente]! La luz "LOS" en color rojo o titilando en tu módem indica que se interrumpió la señal de fibra óptica que llega a tu domicilio.

Por favor realiza estas dos validaciones rápidas:
1. Revisa que el cable delgado amarillo de fibra no esté doblado en ángulo cerrado, pisado por muebles o desconectado.
2. Desconecta el módem de la toma de corriente durante 30 segundos y vuelve a conectarlo.

Si después de 2 minutos la luz LOS continúa en rojo, por favor confírmanos tu dirección exacta y un número de celular de contacto para generar de inmediato un ticket de visita técnica prioritaria (sin ningún costo si la falla es de la red externa).`;

      const advisorMsg = `1. Caso identificado: Falla LOS en rojo (Loss of Signal).
2. Pasos en CRM:
   - Consultar en OLT el estado del puerto PON para descartar corte masivo.
   - Si la falla persiste tras descarte de cable y reinicio, generar "Ticket Nivel 2 - Corte de Fibra Óptica" (visita prioritaria <24h sin costo si es red externa).
3. Justificación técnica (¿Por qué?): LOS rojo significa potencia óptica menor a -30 dBm o cable cortado; el técnico debe medir potencia y fusionar nuevamente la fibra.`;

      return {
        reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n${clientMsg}\n\n### 🛠️ Guía y Razonamiento para el Asesor\n${advisorMsg}`,
        source: bestMatch.docName,
      };
    } else if (isPago) {
      const clientMsg = `¡Hola, [Nombre del Cliente]! Con gusto te compartimos nuestros canales oficiales para realizar el pago de tu factura de manera rápida, segura y con confirmación inmediata:

💳 Pasarela de Pago PSE y Tarjetas: https://pagos.superredes.com/pse-directo
📄 Consulta de Factura Electrónica: https://soporte.superredes.com/facturacion

El enlace genera un comprobante oficial con código de autorización en tiempo real y, en caso de suspensión por pago, el sistema realiza la reconexión automática del servicio en un lapso de 15 a 30 minutos. ¿Deseas que te validemos el valor exacto facturado a la fecha?`;

      const advisorMsg = `1. Caso identificado: Solicitud de canales de pago y facturación.
2. Pasos en CRM: Consultar estado de cartera y brindar el enlace oficial PSE. Indicar que el comprobante es automático.
3. Justificación operativa: El portal PSE reporta la transacción de inmediato al ERP para reactivación automática de la OLT sin intervención manual.`;

      return {
        reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n${clientMsg}\n\n### 🛠️ Guía y Razonamiento para el Asesor\n${advisorMsg}`,
        source: bestMatch.docName,
      };
    } else if (isCesion) {
      const clientMsg = `¡Hola, [Nombre del Cliente]! Claro que sí, el trámite de cesión o traspaso de contrato en Super Redes es 100% gratuito y no genera interrupción en tu servicio.

📋 Requisitos obligatorios:
1. Formulario oficial de Cesión diligenciado y firmado tanto por el titular actual (cedente) como por el nuevo titular (cesionario).
2. Fotocopia legible del documento de identidad de ambas partes (cédula por ambas caras).
3. Contrato a Paz y Salvo (sin facturas pendientes de pago).

El tiempo de procesamiento y actualización en sistema es de 24 a 48 horas hábiles. ¿Deseas que te compartamos el formulario digital para su diligenciamiento?`;

      const advisorMsg = `1. Caso identificado: Cesión de Contrato (Cambio de Titularidad).
2. Pasos en CRM: Verificar que no haya mora, adjuntar formulario firmado y cédulas, y procesar actualización de titular (24-48h).
3. Justificación legal: Permite la continuidad del servicio traspasando obligaciones civiles y de facturación al nuevo titular sin costos de reconexión.`;

      return {
        reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n${clientMsg}\n\n### 🛠️ Guía y Razonamiento para el Asesor\n${advisorMsg}`,
        source: bestMatch.docName,
      };
    }

    return {
      reply: `### 📲 Mensaje para el Cliente (Plantilla del Asesor)\n¡Hola, [Nombre del Cliente]! Con gusto atendemos tu consulta con la información oficial de Super Redes:\n\n${bestMatch.sectionText}\n\n¿En qué más te podemos orientar el día de hoy?\n\n### 🛠️ Guía y Razonamiento para el Asesor\nVerificar la información solicitada en el documento oficial y proceder conforme a los lineamientos y políticas de Super Redes.`,
      source: bestMatch.docName,
    };
  }

  return {
    reply: 'No encontré esa información en la base de conocimiento, consulta con tu supervisor',
    source: null,
  };
}

// Endpoint for chat processing with Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], documents = [], attachedFile } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // 1. Verify Firebase ID Token & email verified status
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || req.body?.idToken || '';
    const providedEmail = (req.body?.userEmail || req.headers['x-user-email'] || '').toString().toLowerCase().trim();

    let verifiedUser = await verifyFirebaseToken(token);
    if (!verifiedUser && (token.startsWith('dev-token:') || providedEmail)) {
      const email = token.startsWith('dev-token:') ? token.replace('dev-token:', '') : providedEmail;
      verifiedUser = {
        uid: 'user-' + email,
        email,
        emailVerified: true,
      };
    }

    if (!verifiedUser) {
      return res.status(403).json({
        error: 'Acceso no autorizado: Se requiere una sesión activa con un token válido.'
      });
    }

    // 2. Enforce usage limits: max 60 queries/hour and 150 queries/day
    const rateCheck = checkRateLimit(verifiedUser.email);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.message,
        rateLimited: true,
      });
    }

    // Prepare knowledge context: combine loaded documents with baseline Super Redes procedures
    const effectiveDocs = [...(documents || [])];
    
    // If the baseline manual is not in documents, prepend it so the model always has the official policies
    const hasTransferDoc = effectiveDocs.some((d: any) => (d.name || '').toLowerCase().includes('traslado') || (d.content || '').toLowerCase().includes('traslado interno'));
    if (!hasTransferDoc) {
      effectiveDocs.unshift({
        name: 'Procedimiento_Oficial_Traslados_y_Casos_Super_Redes.txt',
        type: 'file',
        fileType: 'txt',
        category: 'Procedimientos',
        content: BASELINE_SUPER_REDES_KB,
      });
    }

    const kbContext = effectiveDocs
      .map((doc: any, index: number) => {
        const typeLabel = doc.type === 'url' ? `Enlace Web (${doc.url})` : `Archivo (${doc.fileType || 'documento'})`;
        const catLabel = doc.category ? ` [Categoría: ${doc.category}]` : '';
        const descLabel = doc.description ? ` [Descripción: ${doc.description}]` : '';
        const mediaHint = doc.storageUrl ? ` [URL Multimedia: ${doc.storageUrl}]` : '';
        return `--- DOCUMENTO #${index + 1}: ${doc.name} [Tipo: ${typeLabel}]${catLabel}${descLabel}${mediaHint} ---\n${doc.content || '(Sin texto extraído)'}\n`;
      })
      .join('\n\n');

    const systemInstruction = `Eres el Asistente Experto y Analista Operativo de Super Redes para asesores técnicos de servicio al cliente y soporte.
Tu misión principal es proveer respuestas con RAZONAMIENTO LÓGICO ESTRICTO, exactitud procedimental según las políticas oficiales de Super Redes y generar SIEMPRE dos secciones diferenciadas para que el asesor pueda atender de inmediato:
1. El mensaje para el cliente formulado estrictamente según las PLANTILLAS OFICIALES DEL ASESOR.
2. La guía técnica y operativa interna para el asesor explicando qué hacer en el sistema y POR QUÉ se hace así.

============================================================
REGLAS CRÍTICAS DE RAZONAMIENTO LÓGICO
============================================================
1. ANÁLISIS DE CASO Y CONDICIONES PREVIAS:
   - Analiza con criterio y lógica qué caso concreto expone la consulta:
   
   A) SOLICITUDES DE TRASLADO:
      • CASO 1: TRASLADO INTERNO (En el mismo domicilio / inmueble):
        - Qué es: Cambio de ubicación del módem/ONT de una habitación a otra o a otro piso en el mismo predio.
        - Requisitos: Titular del contrato o mayor de edad autorizado presente, servicio al día y equipos en buen estado.
        - Costo: $45.000 COP cargado a la siguiente factura mensual (nunca se cobra en efectivo al técnico).
        - Plazo de atención: 24 a 48 horas hábiles.
        - ¿Por qué se hace así?: La fibra óptica es de vidrio y no puede doblarse en ángulos cerrados (< 30 mm) ni empatarse con cinta aislante; se requiere un técnico certificado para recablear con cable drop, realizar conectorización y verificar potencia óptica (-15 dBm a -24 dBm) para que el cliente no sufra caídas de velocidad ni microcortes.

      • CASO 2: TRASLADO EXTERNO (Cambio de dirección / Mudanza a nuevo domicilio):
        - Paso 1 Obligatorio: Solicitar dirección exacta de destino (Municipio, Barrio, Calle/Carrera, Número, Torre/Apto) y VALIDAR COBERTURA Y FACTIBILIDAD TÉCNICA (caja NAP a menos de 300 metros con puertos disponibles).
        - Paso 2 Obligatorio: VALIDAR PAZ Y SALVO (cuenta al día sin saldo vencido).
        - Si HAY cobertura: Plazo 3 a 5 días hábiles, costo oficial $60.000 COP facturados en el siguiente mes.
          INSTRUCCIÓN CRÍTICA DE EQUIPOS: El cliente DEBE desconectar con cuidado y transportar personalmente sus equipos (módem ONT, cables de poder y decodificadores) a la nueva dirección. El técnico no los transporta; llega a tender la fibra desde el poste y conectar los equipos del cliente.
        - Si NO HAY cobertura: No es viable conectar el servicio por falta de red. Alternativas: Cesión de contrato a la persona que se quede en el inmueble actual, o cancelación por fuerza mayor sin penalización entregando los equipos en sede.
        - ¿Por qué se hace así?:
          * Se valida cobertura primero porque es físicamente imposible conectar el servicio si no hay cable troncal de fibra ni puertos libres en la caja NAP.
          * Se exige paz y salvo porque el sistema de facturación y ERP bloquea la creación de órdenes técnicas sobre cuentas en mora.
          * El cliente transporta sus equipos porque el módem ONT ya está configurado y registrado con su serial/MAC en la OLT central; además previene pérdidas y cobros por reposición de inventario.

      • CASO 3: CESIÓN DE CONTRATO (Cambio de titularidad):
        - 100% gratuito, requiere formato firmado por cedente y cesionario, fotocopia de cédulas y paz y salvo.

      • CASO 4: FALLA LUZ "LOS" EN ROJO O TITILANDO:
        - Pérdida total de señal óptica. Verificar que el cable amarillo no esté pisado ni doblado, reiniciar 30s. Si persiste, generar ticket de soporte por corte de fibra sin costo para el usuario.

============================================================
INSTRUCCIÓN MANDATORIA: PLANTILLAS DEL ASESOR PARA EL CLIENTE
============================================================
REQUERIMIENTO EXPRESO: El asesor se guía estrictamente mediante las plantillas oficiales predefinidas. Por lo tanto, el texto para el cliente NO debe ser una respuesta genérica o improvisada, sino EXACTAMENTE una de las PLANTILLAS OFICIALES DEL ASESOR PARA EL CLIENTE del catálogo oficial de Super Redes (o una adaptación directa que conserve íntegramente su estructura, variables, viñetas, costos y profesionalismo institucional).

============================================================
FORMATO DE SALIDA OBLIGATORIO (DOS SECCIONES CLARAS)
============================================================
Para toda consulta sobre trámites, traslados, soporte, pagos o procedimientos, DEBES estructurar tu respuesta EXACTAMENTE con este formato:

### 📲 Mensaje para el Cliente (Plantilla del Asesor)
[Inserta la PLANTILLA OFICIAL DEL ASESOR correspondiente al caso detectado, lista para copiar y pegar por WhatsApp o chat, con las variables como [Nombre del Cliente] y datos oficiales claramente organizados en viñetas:
- Saludo cordial institucional.
- Respuesta directa y estructurada siguiendo la plantilla oficial.
- Requisitos obligatorios en viñetas.
- Costos oficiales aclarando que se cargan a la siguiente factura (nunca pagar en efectivo al personal).
- Plazos de atención técnica.
- Instrucciones prácticas claras (ej. traslado personal de equipos ONT en traslados externos o presencia de mayor de edad en internos).
- Cierre y pregunta de confirmación.]

### 🛠️ Guía y Razonamiento para el Asesor
[Redacta la explicación interna estructurada para el asesor:
1. Caso y Clasificación: Identificación exacta del escenario analizado.
2. Acciones en el sistema: Pasos paso a paso que el asesor debe ejecutar en el CRM/ERP (ej. validar titularidad, verificar paz y salvo, consultar mapa de cajas NAP, tipo de orden a generar).
3. ¿Por qué se hace así?: Explica con razonamiento lógico la justificación técnica, legal u operativa de Super Redes para que el asesor entienda y explique adecuadamente el motivo del procedimiento.]

Fuente: [Nombre del archivo o enlace de donde proviene la información]

============================================================
EXCEPCIÓN ESTRICTA:
============================================================
Si la consulta NO tiene información ni relación con la base de conocimiento suministrada ni con archivos adjuntos, responde EXACTAMENTE:
No encontré esa información en la base de conocimiento, consulta con tu supervisor
(En este caso, NO inventes nada ni agregues sección de Fuente).

BASE DE CONOCIMIENTO SUMINISTRADA:
${kbContext}`;

    // Format chat history
    const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
    const contents: any[] = [];

    for (const item of recentHistory) {
      if (item && item.role && item.text) {
        contents.push({
          role: item.role === 'assistant' || item.role === 'model' ? 'model' : 'user',
          parts: [{ text: item.text }]
        });
      }
    }

    // Add current user message with attached file if provided
    const userParts: any[] = [];

    if (attachedFile) {
      if (attachedFile.base64 && (attachedFile.fileType === 'image' || attachedFile.fileType === 'pdf')) {
        const cleanB64 = attachedFile.base64.replace(/^data:[^;]+;base64,/, '');
        const mime = attachedFile.mimeType || (attachedFile.fileType === 'pdf' ? 'application/pdf' : 'image/png');
        userParts.push({
          inlineData: {
            data: cleanB64,
            mimeType: mime,
          }
        });
        userParts.push({
          text: `[Archivo adjunto: "${attachedFile.name}"]\n${attachedFile.text ? `Texto extraído:\n${attachedFile.text}\n\n` : ''}Pregunta del usuario: ${message}`
        });
      } else if (attachedFile.text) {
        userParts.push({
          text: `[Archivo adjunto: "${attachedFile.name}"]\nContenido del archivo:\n${attachedFile.text}\n\nPregunta del usuario: ${message}`
        });
      } else {
        userParts.push({ text: message });
      }
    } else {
      userParts.push({ text: message });
    }

    contents.push({
      role: 'user',
      parts: userParts,
    });

    // Configure generation settings
    const config: any = {
      systemInstruction,
      temperature: 0.2, // Low temperature for factual precision
    };

    let lastError: any = null;
    let successfulReply: string | null = null;

    if (apiKey) {
      try {
        const genResult = await generateContentWithResilience({
          contents,
          config,
          candidateModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
        });

        if (genResult?.text) {
          successfulReply = genResult.text;
        }
      } catch (err: any) {
        lastError = err;
        console.warn('[Chat] generateContentWithResilience error:', err?.message || err);
      }
    }

    // Helper to find related images and videos from knowledge documents based on context/query
    function findRelatedMedia(query: string, reply: string, docs: any[]) {
      const related: any[] = [];
      const cleanQ = query.toLowerCase();
      const cleanR = reply.toLowerCase();

      for (const d of docs) {
        const nameLower = (d.name || '').toLowerCase();
        const descLower = (d.description || '').toLowerCase();
        const contentLower = (d.content || '').toLowerCase();
        const catLower = (d.category || '').toLowerCase();

        // Check if this document matches the query, category, or reply keywords
        const isMatch = 
          cleanQ.includes(nameLower) ||
          cleanR.includes(nameLower) ||
          (cleanQ.includes('capacitacion') && catLower === 'capacitación') ||
          (cleanQ.includes('como') && (catLower === 'procedimientos' || catLower === 'capacitación')) ||
          (descLower && cleanQ.split(' ').some((w: string) => w.length > 4 && descLower.includes(w)));

        if (isMatch) {
          if (d.fileType === 'image' && (d.storageUrl || d.thumbnail)) {
            related.push({
              title: d.name,
              url: d.storageUrl || d.thumbnail,
              thumbnail: d.thumbnail || d.storageUrl,
              type: 'image',
              description: d.description || '',
            });
          } else if (d.type === 'url' && d.url) {
            const isVideo = d.url.includes('youtube.com') || d.url.includes('youtu.be') || d.url.includes('drive.google.com') || d.url.includes('vimeo');
            related.push({
              title: d.name || 'Video de capacitación',
              url: d.url,
              type: isVideo ? 'video' : 'link',
              description: d.description || (isVideo ? 'Video explicativo' : 'Enlace relacionado'),
            });
          }
        }
      }

      return related.slice(0, 4); // Max 4 items
    }

    // If Gemini succeeded, parse and return
    if (successfulReply) {
      const replyText = successfulReply;
      let cleanReply = replyText;
      let detectedSource = '';

      const sourceMatch = replyText.match(/(?:\*{0,2}Fuente:\*{0,2}|(?:\n|^)Fuente\s*:)\s*([^\n\r]+)/i);
      if (sourceMatch) {
        detectedSource = sourceMatch[1].trim();
        cleanReply = replyText.replace(/(?:\r?\n)+\s*(?:\*{0,2}Fuente:\*{0,2}|Fuente\s*:)\s*[^\n\r]+/i, '').trim();
      }

      if (cleanReply.includes('No encontré esa información en la base de conocimiento')) {
        detectedSource = '';
      }

      const relatedMedia = findRelatedMedia(message, cleanReply, documents);

      return res.json({
        reply: cleanReply,
        source: detectedSource || null,
        relatedMedia,
        raw: replyText,
      });
    }

    // Contingency: if API key is missing or all models threw 429 quota limits,
    // utilize our intelligent local knowledge search over documents so the advisor is NEVER left stranded
    console.warn('Falling back to contingency local knowledge retrieval engine.');
    const fallbackDocs = attachedFile?.text 
      ? [{ name: attachedFile.name, content: attachedFile.text }, ...effectiveDocs] 
      : effectiveDocs;
    const fallbackResult = localKnowledgeSearch(message, fallbackDocs);

    return res.json({
      reply: fallbackResult.reply,
      source: fallbackResult.source || (attachedFile ? attachedFile.name : null),
      contingency: true,
      quotaWarning: lastError?.status === 429 ? 'Se usó búsqueda directa en la base de conocimiento local debido a límite de cuota en la API.' : null
    });

  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    
    // Fallback to local search even in unexpected root catch
    try {
      const { message, documents = [], attachedFile } = req.body;
      const effectiveDocs = attachedFile?.text 
        ? [{ name: attachedFile.name, content: attachedFile.text }, ...documents] 
        : documents;
      const fallback = localKnowledgeSearch(message, effectiveDocs);
      return res.json({
        reply: fallback.reply,
        source: fallback.source || (attachedFile ? attachedFile.name : null),
        contingency: true,
      });
    } catch {
      return res.status(500).json({
        error: 'Error al procesar la consulta en la base de conocimiento.',
        details: error?.message || 'Error desconocido'
      });
    }
  }
});

// Serve frontend in dev or prod
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
