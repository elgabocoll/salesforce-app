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

  const { action, tipo } = body || {};
  if (action === 'ping') return json(200, { ok: true });

  // 1) Auth por refresh_token
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
        details: authData.error_description || authData.error || authText || 'No se pudo obtener access_token',
        status: authRes.status,
      });
    }

    accessToken = authData.access_token;
    instanceUrl = authData.instance_url;
  } catch (e) {
    return json(500, { error: 'No se pudo conectar con Salesforce.', details: e.message });
  }

  // 2) Map tipo → endpoint Apex REST
  const endpoints = {
    contactos: {
      path: '/services/apexrest/getContacts/',
      // cómo convertir la respuesta de Apex al formato que tu front espera
      toRecords: (data) => data?.contacts ?? [],
      // opcional: si quieres detectar “error” por errorCode
      isOk: (data) => String(data?.errorCode) === '200',
      getError: (data) => data?.message || 'Error en Apex REST',
    },
    // Ejemplo para añadir más:
    // cuentas: { path: '/services/apexrest/getAccounts/', toRecords: d => d?.accounts ?? [], isOk: d => String(d?.errorCode)==='200', getError: d => d?.message },
  };

  const cfg = endpoints[tipo];
  if (!cfg) return json(400, { error: 'Tipo no válido', allowed: Object.keys(endpoints) });

  // 3) Llamar a tu servicio Apex REST
  try {
    const url = `${instanceUrl}${cfg.path}`;
    const apiRes = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const text = await apiRes.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (!apiRes.ok) {
      return json(apiRes.status, {
        error: 'Error al llamar al endpoint Apex REST.',
        details: (Array.isArray(data) && data[0]?.message) || data?.message || text || 'Respuesta no válida',
      });
    }

    // Si tu Apex usa errorCode como “estado”
    if (cfg.isOk && !cfg.isOk(data)) {
      return json(400, { error: 'Apex REST devolvió error', details: cfg.getError(data), raw: data });
    }

    return json(200, { records: cfg.toRecords(data) });
  } catch (e) {
    return json(500, { error: 'Error al consultar Salesforce.', details: e.message });
  }
};
