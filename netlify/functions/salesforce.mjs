// netlify/functions/salesforce.mjs
const requiredEnv = ['SF_LOGIN_URL', 'SF_CLIENT_ID', 'SF_CLIENT_SECRET', 'SF_REFRESH_TOKEN'];

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length) return json(500, { error: 'Faltan variables de entorno requeridas.', missing });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Body inválido (JSON requerido)' });
  }

  const { action, tipo, nombre, fecha } = body || {};
  if (action === 'ping') return json(200, { ok: true });

  // ── 1. Autenticación con refresh_token ──────────────────────
  const SF_LOGIN_URL = process.env.SF_LOGIN_URL.replace(/\/+$/, '');
  const authBody = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.SF_CLIENT_ID,
    client_secret: process.env.SF_CLIENT_SECRET,
    refresh_token: process.env.SF_REFRESH_TOKEN,
  });

  let accessToken, instanceUrl;
  try {
    const authRes = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authBody.toString(),
    });
    const authText = await authRes.text();
    let authData = {};
    try { authData = JSON.parse(authText); } catch {}

    if (!authRes.ok || !authData.access_token || !authData.instance_url) {
      return json(401, {
        error: 'Error de autenticación con Salesforce (refresh_token).',
        details: authData.error_description || authData.error || authText,
        status: authRes.status,
      });
    }
    accessToken = authData.access_token;
    instanceUrl = authData.instance_url;
  } catch (e) {
    return json(500, { error: 'No se pudo conectar con Salesforce.', details: e.message });
  }

  // ── 2. Configuración de endpoints ───────────────────────────
  const endpoints = {

    // GET /services/apexrest/getContacts/
    // Devuelve lista de contactos con membresía
    contactos: {
      path: '/services/apexrest/getContacts/',
      method: 'GET',
      toRecords: (data) => data?.contacts ?? [],
      isOk: (data) => String(data?.errorCode) === '200',
      getError: (data) => data?.message || 'Error en Apex REST',
    },

    // GET /services/apexrest/getContact/Me
    // Devuelve el perfil del contacto actual
    perfilSocio: {
      path: '/services/apexrest/getContact/Me',
      method: 'GET',
      toRecords: (data) => Array.isArray(data) ? data : [data],
      isOk: (data) => !data?.errorCode || String(data?.errorCode) === '200',
      getError: (data) => data?.message || 'Error obteniendo perfil',
    },

    // GET /services/apexrest/me/bookings
    // Devuelve las reservas del contacto actual
    reservasSocio: {
      path: '/services/apexrest/getBookings/me',
      method: 'GET',
      toRecords: (data) => data?.bookings ?? data?.records ?? (Array.isArray(data) ? data : []),
      isOk: (data) => !data?.errorCode || String(data?.errorCode) === '200',
      getError: (data) => data?.message || 'Error obteniendo reservas',
    },

    // POST /services/apexrest/cancelSession
    // Body: { nombre, fecha }
    // Cancela una reserva por nombre de clase y fecha
    cancelarReserva: {
      path: '/services/apexrest/cancelSession',
      method: 'POST',
      bodyData: { nombre, fecha },
      toRecords: () => [],
      isOk: (data) => !data?.errorCode || String(data?.errorCode) === '200',
      getError: (data) => data?.message || 'Error al cancelar reserva',
    },
     clases: {
      path: '/services/apexrest/getBookings',
      method: 'GET',
      toRecords: (data) => data?.bookings ?? data?.records ?? (Array.isArray(data) ? data : []),
      isOk: (data) => !data?.errorCode || String(data?.errorCode) === '200',
      getError: (data) => data?.message || 'Error obteniendo clases',
    },
    // TODO: añadir más endpoints aquí cuando estén listos en Apex
    // GET /services/apexrest/getBookings
// Devuelve todas las clases para la vista de personal
   
    // reservasPersonal: { path: '/services/apexrest/getBookings/', method: 'GET', toRecords: d => d?.bookings ?? [], ... },
  };

  const cfg = endpoints[tipo];
  if (!cfg) return json(400, { error: 'Tipo no válido', allowed: Object.keys(endpoints) });

  // ── 3. Llamar al endpoint Apex REST ─────────────────────────
  try {
    const url = `${instanceUrl}${cfg.path}`;
    const fetchOptions = {
      method: cfg.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    // Si es POST, añadir el body con los datos
    if (cfg.method === 'POST' && cfg.bodyData) {
      fetchOptions.body = JSON.stringify(cfg.bodyData);
    }

    const apiRes = await fetch(url, fetchOptions);
    const text = await apiRes.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (!apiRes.ok) {
      return json(apiRes.status, {
        error: 'Error al llamar al endpoint Apex REST.',
        details: (Array.isArray(data) && data[0]?.message) || data?.message || text,
      });
    }

    if (cfg.isOk && !cfg.isOk(data)) {
      return json(400, {
        error: 'Apex REST devolvió error',
        details: cfg.getError(data),
        raw: data,
      });
    }

    return json(200, { records: cfg.toRecords(data), ok: true });

  } catch (e) {
    return json(500, { error: 'Error al consultar Salesforce.', details: e.message });
  }
};
