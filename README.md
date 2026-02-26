# 🚀 SFConnect — Guía paso a paso

## Estructura del proyecto
```
salesforce-app/
├── index.html                    ← Frontend principal
├── style.css                     ← Estilos
├── app.js                        ← Lógica frontend
├── netlify.toml                  ← Config de Netlify
└── netlify/
    └── functions/
        └── salesforce.js         ← Backend (puente con SF)
```

---

## 📋 PASO A PASO COMPLETO

### PASO 1 — Crear cuenta en GitHub
1. Ve a **github.com** y crea una cuenta gratuita
2. Confirma tu email

---

### PASO 2 — Crear repositorio en GitHub
1. Haz clic en el botón verde **"New"** (o el **+** arriba a la derecha)
2. Ponle nombre: `salesforce-app`
3. Déjalo en **Public** (o Private, ambos funcionan)
4. Haz clic en **"Create repository"**

---

### PASO 3 — Subir los archivos a GitHub
Tienes dos opciones:

#### Opción A — Desde la web de GitHub (más fácil):
1. En tu repositorio vacío, haz clic en **"uploading an existing file"**
2. Arrastra TODOS los archivos y carpetas de este proyecto
3. ⚠️ Asegúrate de subir también la carpeta `netlify/functions/salesforce.js`
4. Haz clic en **"Commit changes"**

#### Opción B — Con Git (terminal):
```bash
git init
git add .
git commit -m "primer commit"
git remote add origin https://github.com/TU_USUARIO/salesforce-app.git
git push -u origin main
```

---

### PASO 4 — Crear cuenta en Netlify
1. Ve a **netlify.com**
2. Haz clic en **"Sign up"**
3. Elige **"Sign up with GitHub"** (lo conecta automáticamente)
4. Autoriza a Netlify en GitHub

---

### PASO 5 — Conectar GitHub con Netlify
1. En Netlify, haz clic en **"Add new site"**
2. Elige **"Import an existing project"**
3. Selecciona **"Deploy with GitHub"**
4. Busca y selecciona tu repositorio `salesforce-app`
5. En "Build settings" deja todo como está (detecta el `netlify.toml` automáticamente)
6. Haz clic en **"Deploy site"**

---

### PASO 6 — Añadir las credenciales de Salesforce en Netlify
⚠️ **IMPORTANTE:** Nunca pongas las credenciales en el código, solo aquí.

1. En Netlify ve a: **Site configuration → Environment variables**
2. Haz clic en **"Add a variable"** y añade una por una:

| Key | Value |
|-----|-------|
| `SF_LOGIN_URL` | `https://login.salesforce.com` (o `https://test.salesforce.com` si es sandbox) |
| `SF_CLIENT_ID` | Tu Consumer Key de la Connected App |
| `SF_CLIENT_SECRET` | Tu Consumer Secret de la Connected App |
| `SF_USERNAME` | Tu email de Salesforce |
| `SF_PASSWORD_WITH_TOKEN` | Tu contraseña + security token juntos |

3. Guarda las variables

---

### PASO 7 — Redesplegar
1. Ve a **Deploys** en Netlify
2. Haz clic en **"Trigger deploy"** → **"Deploy site"**
3. Espera 1-2 minutos

---

### PASO 8 — ¡Listo! 🎉
- Netlify te dará una URL del tipo: `https://tu-app-random.netlify.app`
- Puedes cambiarla en: **Site configuration → General → Site name**
- Abre la URL y haz clic en "Conectar con Salesforce"

---

## 🔄 Actualizaciones futuras
Cada vez que hagas cambios y los subas a GitHub, Netlify los desplegará **automáticamente**.

---

## ❓ Problemas comunes

**"Error de autenticación"** → Revisa que SF_PASSWORD_WITH_TOKEN tenga contraseña + token sin espacios

**"No se pudo conectar"** → Verifica que SF_LOGIN_URL sea correcto (producción vs sandbox)

**La función no aparece** → Asegúrate de que el archivo esté en `netlify/functions/salesforce.js`
