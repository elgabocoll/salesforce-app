// netlify/functions/salesforce.mjs
// Puente entre frontend y Salesforce API usando OAuth con REFRESH TOKEN
// (Funciona en orgs donde el password grant está deshabilitado)

const requiredEnv = [
  'SF_LOGIN_URL', // ej: https://login.salesforce.com  (o tu mydomain .my.salesforce.com)
  'SF_CLIENT_ID',
  'SF_CLIENT_SECRET',
  'SF_REFRESH_TOKEN',
];

// Compatible con Netlify Functions (Node): process.env
// y también con runtimes que expongan Netlify.env.get(...)
const getEnv = (name) => (globalThis.Netlify?.env?.get?.(name) ?? process.env[name]);

const getMissingEnv = () => requiredEnv.filter((key) => !getEnv(key));

const json = (statusCode, payload) =>
  new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Método no permitido' });
  }

  const missing = getMissingEnv();
  if (missing.length > 0) {
    return json(500, {
      error: 'Faltan variables de entorno requeridas.',
      missing,
    });
  }

  const SF_LOGIN_URL = getEnv('SF_LOGIN_URL').replace(/\/+$/, ''); // quita / finales
  const SF_CLIENT_ID = getEnv('SF_CLIENT_ID');
  const SF_CLIENT_SECRET = getEnv('SF_CLIENT_SECRET');
  const SF_REFRESH_TOKEN = getEnv('SF_REFRESH_TOKEN');

  let accessToken;
  let instanceUrl;

  // 1) Obtener access_token usando refresh_token
  try {
    const authBody = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
      refresh_token: SF_REFRESH_TOKEN,
    });

    const authRes = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authBody.toString(),
    });

    const authData = await authRes.json().catch(() => ({}));

    if (!authRes.ok || !authData.access_token) {
      return json(401, {
        error: 'Error de autenticación con Salesforce (refresh_token).',
        details:
          authData.error_description ||
          authData.error ||
          'No se pudo obtener access_token',
        status: authRes.status,
      });
    }

    accessToken = authData.access_token;
    instanceUrl = authData.instance_url;
  } catch (e) {
    return json(500, {
      error: 'No se pudo conectar con Salesforce.',
      details: e.message,
    });
  }

  // 2) Leer body
  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Body inválido (JSON requerido)' });
  }

  const { action, tipo } = body || {};

  if (action === 'ping') {
    return json(200, { ok: true });
  }

  // 3) Queries SOQL
  const queries = {
    contactos: 'SELECT Id, Name, Email, Phone, Title FROM Contact LIMIT 50',
    cuentas: 'SELECT Id, Name, Industry, Phone, BillingCity FROM Account LIMIT 50',
    oportunidades: 'SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 50',
  };

  const soql = queries[tipo];
  if (!soql) {
    return json(400, { error: 'Tipo no válido', allowed: Object.keys(queries) });
  }

  // 4) Ejecutar query
  try {
    const queryUrl = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;

    const queryRes = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const queryData = await queryRes.json().catch(() => ({}));

    if (!queryRes.ok) {
      return json(queryRes.status, {
        error: 'Error al consultar Salesforce.',
        details:
          queryData?.[0]?.message ||
          queryData?.message ||
          queryData?.error_description ||
          queryData?.error ||
          'Respuesta no válida',
      });
    }

    return json(200, { records: queryData.records || [] });
  } catch (e) {
    return json(500, {
      error: 'Error al consultar Salesforce.',
      details: e.message,
    });
  }
};
