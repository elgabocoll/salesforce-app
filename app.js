// ─── Estado ───────────────────────────────────────────────
let currentTab = 'contactos';
let connected = false;

// ─── Conectar ─────────────────────────────────────────────
async function conectar() {
  const btn = document.querySelector('.btn-primary');
  btn.disabled = true;
  btn.textContent = 'Conectando...';

  try {
    const res = await fetch('/.netlify/functions/salesforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' })
    });
    const data = await res.json();

    if (data.ok) {
      connected = true;
      document.getElementById('statusBadge').textContent = '● Conectado';
      document.getElementById('statusBadge').classList.add('connected');
      document.querySelector('.hero').style.display = 'none';
      document.getElementById('panel').style.display = 'block';
      cargarDatos('contactos');
    } else {
      alert('Error al conectar: ' + (data.error || 'Error desconocido'));
      btn.disabled = false;
      btn.textContent = 'Conectar con Salesforce';
    }
  } catch (e) {
    alert('Error de red: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Conectar con Salesforce';
  }
}

// ─── Tabs ──────────────────────────────────────────────────
function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  cargarDatos(tab);
}

// ─── Cargar datos ──────────────────────────────────────────
async function cargarDatos(tipo) {
  const loading = document.getElementById('loading');
  const container = document.getElementById('dataContainer');
  loading.style.display = 'flex';
  container.innerHTML = '';

  try {
    const res = await fetch('/.netlify/functions/salesforce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'query', tipo })
    });
    const data = await res.json();
    loading.style.display = 'none';

    if (data.error) {
      container.innerHTML = `<div class="error-msg">⚠️ ${data.error}</div>`;
      return;
    }

    renderTabla(data.records || [], tipo);
  } catch (e) {
    loading.style.display = 'none';
    container.innerHTML = `<div class="error-msg">⚠️ Error de red: ${e.message}</div>`;
  }
}

// ─── Renderizar tabla ──────────────────────────────────────
function renderTabla(records, tipo) {
  const container = document.getElementById('dataContainer');

  if (!records.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span>📭</span>
        No se encontraron registros en ${tipo}.
      </div>`;
    return;
  }

  const configs = {
    contactos: {
      cols: ['Name', 'Email', 'Phone', 'Title'],
      labels: ['Nombre', 'Email', 'Teléfono', 'Cargo']
    },
    cuentas: {
      cols: ['Name', 'Industry', 'Phone', 'BillingCity'],
      labels: ['Nombre', 'Industria', 'Teléfono', 'Ciudad']
    },
    oportunidades: {
      cols: ['Name', 'StageName', 'Amount', 'CloseDate'],
      labels: ['Nombre', 'Etapa', 'Importe', 'Cierre']
    }
  };

  const { cols, labels } = configs[tipo];

  const headers = labels.map(l => `<th>${l}</th>`).join('');
  const rows = records.map(r => {
    const cells = cols.map(col => {
      let val = r[col] || '—';
      if (col === 'Amount' && r[col]) val = '€' + Number(r[col]).toLocaleString('es-ES');
      if (col === 'StageName') val = `<span class="badge">${val}</span>`;
      return `<td>${val}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
