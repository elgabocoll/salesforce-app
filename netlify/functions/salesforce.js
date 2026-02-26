// netlify/functions/salesforce.js
// Esta función actúa de puente entre tu frontend y Salesforce API

exports.handler = async function (event) {
  // Solo aceptamos POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  // Credenciales desde variables de entorno de Netlify
  const {
    SF_LOGIN_URL,
    SF_CLIENT_ID,
    SF_CLIENT_SECRET,
    SF_USERNAME,
    SF_PASSWORD_WITH_TOKEN
  } = process.env;

  // ── 1. Autenticación con Salesforce ─────────────────────
  let accessToken, instanceUrl;

  try {
    const authBody = new URLSearchParams({
      grant_type: 'password',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
      username: SF_USERNAME,
      password: SF_PASSWORD_WITH_TOKEN
    });

    const authRes = await fetch(`${SF_LOGIN_URL}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: authBody.toString()
    });

    const authData = await authRes.json();

    if (!authData.access_token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Error de autenticación: ' + (authData.error_description || 'Credenciales inválidas') })
      };
    }

    accessToken = authData.access_token;
    instanceUrl = authData.instance_url;

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo conectar con Salesforce: ' + e.message })
    };
  }

  // ── 2. Leer acción del body ──────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { action, tipo } = body;

  // ── 3. Ping (solo comprueba conexión) ───────────────────
  if (action === 'ping') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  }

  // ── 4. Query según el tipo ───────────────────────────────
  const queries = {
    contactos:     'SELECT Id, Name, Email, Phone, Title FROM Contact LIMIT 50',
    cuentas:       'SELECT Id, Name, Industry, Phone, BillingCity FROM Account LIMIT 50',
    oportunidades: 'SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 50'
  };

  const soql = queries[tipo];

  if (!soql) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Tipo no válido' }) };
  }

  try {
    const queryRes = await fetch(
      `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const queryData = await queryRes.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: queryData.records || [] })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error al consultar Salesforce: ' + e.message })
    };
  }
};
