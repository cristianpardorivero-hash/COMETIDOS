import express from "express";
import path from "path";
import fs from "fs";
import axios from "axios";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Initialize Firebase Admin lazily
let adminApp: admin.app.App | null = null;
function getAdmin() {
  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      try {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        }, 'server-admin');
      } catch (error) {
        console.error("Failed to initialize Firebase Admin:", error);
      }
    }
  }
  return adminApp;
}

// ClaveÚnica Endpoints
const CU_AUTH_URL = "https://accounts.claveunica.gob.cl/openid/authorize/";
const CU_TOKEN_URL = "https://accounts.claveunica.gob.cl/openid/token/";
const CU_USERINFO_URL = "https://accounts.claveunica.gob.cl/openid/userinfo/";

// Helper to get ClaveÚnica credentials based on host or configuration
function getClaveUnicaConfig(req: express.Request) {
  const host = req.get("host") || "";
  let env = "";

  // Auto-detect environment based on actual access host to avoid misconfigurations
  if (host.includes("cometidos.hospitalcurepto.gob.cl") || host.includes("cometidos.hospitaldecurepto.gob.cl")) {
    env = "prod";
  } else if (host.includes("-qa") || host.includes("qa.") || host.includes("qa-") || host.includes("/qa")) {
    env = "qa";
  } else {
    // If we are on some other test or local domain, prioritize environment variable, fallback to sandbox
    env = process.env.CLAVEUNICA_ENVIRONMENT || "sandbox";
  }

  let clientId = "";
  let clientSecret = "";
  let defaultRedirectUri = "";

  if (env === "prod") {
    clientId = process.env.CLAVEUNICA_CLIENT_ID_PROD || "bf9ad98831964b68a82849cc2a82c2c9";
    clientSecret = process.env.CLAVEUNICA_CLIENT_SECRET_PROD || "f9927df3428c4d34b05efb6f0d381f12";
    defaultRedirectUri = `https://${host}/api/auth/claveunica/callback`;
  } else if (env === "qa") {
    clientId = process.env.CLAVEUNICA_CLIENT_ID_QA || "2f0a7232fafb49ab81d6da0353de5ec1";
    clientSecret = process.env.CLAVEUNICA_CLIENT_SECRET_QA || "4ed6976ec1e9427c857b182626b4a174";
    defaultRedirectUri = `https://${host}/api/auth/claveunica/callback`;
  } else {
    // Sandbox / Testing / Dev
    clientId = process.env.CLAVEUNICA_CLIENT_ID_SANDBOX || "3e0bc6a2dbc84c459e570f94553ca2ce";
    clientSecret = process.env.CLAVEUNICA_CLIENT_SECRET_SANDBOX || "4e61dbf4d6a647559825fa1952dac4ac";
    const scheme = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    defaultRedirectUri = `${scheme}://${host}/api/auth/claveunica/callback`;
  }

  // Override with standard explicit environment variables if provided
  if (process.env.CLAVEUNICA_CLIENT_ID) clientId = process.env.CLAVEUNICA_CLIENT_ID;
  if (process.env.CLAVEUNICA_CLIENT_SECRET) clientSecret = process.env.CLAVEUNICA_CLIENT_SECRET;
  
  const redirectUri = process.env.CLAVEUNICA_REDIRECT_URI || defaultRedirectUri;

  return { clientId, clientSecret, redirectUri, env };
}

// API Routes

// ClaveÚnica Logout
app.get("/api/auth/logout", (req, res) => {
  const { redirectUri } = getClaveUnicaConfig(req);
  const baseUrl = "https://accounts.claveunica.gob.cl/api/v1/accounts/app/logout/";
  // Use the origin part of the redirect URI for logout redirection
  const redirect = redirectUri.split("/api/auth/claveunica/callback")[0] + "/";
  res.redirect(`${baseUrl}?redirect=${encodeURIComponent(redirect)}`);
});

// ClaveÚnica Mock/Simulation login (Dev / Staging only)
app.post("/api/auth/claveunica/mock", async (req, res) => {
  const { env } = getClaveUnicaConfig(req);
  if (env === "prod") {
    return res.status(403).json({ error: "El acceso simulado no está permitido en producción." });
  }

  const { run, name } = req.body;
  if (!run || !name) {
    return res.status(400).json({ error: "Falta el RUN o el Nombre." });
  }

  try {
    const adminApp = getAdmin();
    if (!adminApp) {
      return res.status(500).json({ error: "Firebase Admin no está configurado." });
    }

    // Standardize RUN to unique Firebase uid format (e.g., cu_12345678)
    const cleanRun = run.replace(/[^0-9kK]/g, '').toLowerCase();
    const uid = `cu_${cleanRun}`;

    // Ensure the simulated user exists in Firebase Auth
    try {
      await adminApp.auth().getUser(uid);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        await adminApp.auth().createUser({
          uid,
          displayName: name,
        });
      }
    }

    // Generate custom token for passwordless sign-in
    const customToken = await adminApp.auth().createCustomToken(uid);
    res.json({ customToken });
  } catch (error: any) {
    console.error("Mock Auth Error:", error.message);
    res.status(500).json({ error: "No se pudo generar el token de simulación." });
  }
});

// Start ClaveÚnica Auth
app.get("/api/auth/claveunica", (req, res) => {
  const { clientId, redirectUri, env } = getClaveUnicaConfig(req);
  
  console.log(`[ClaveÚnica OIDC] Iniciando autorización en canal: ${env.toUpperCase()}`);
  console.log(`[ClaveÚnica OIDC] Client ID: ${clientId}`);
  console.log(`[ClaveÚnica OIDC] Redirect URI: ${redirectUri}`);
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "ClaveÚnica configuration missing on server" });
  }

  const state = Math.random().toString(36).substring(7);
  // Store state in cookie for verification
  res.cookie("cu_state", state, { httpOnly: true, secure: true, sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid run name",
    state: state,
  });

  res.redirect(`${CU_AUTH_URL}?${params.toString()}`);
});

// ClaveÚnica Diagnostics
app.get("/api/auth/claveunica/diagnostics", (req, res) => {
  try {
    const { clientId, redirectUri, env } = getClaveUnicaConfig(req);
    const host = req.get("host") || "";
    
    let redirectHost = "";
    try {
      redirectHost = new URL(redirectUri).host;
    } catch (e) {
      redirectHost = redirectUri;
    }

    const isHostMismatch = !host.includes(redirectHost) && !redirectHost.includes(host);

    res.json({
      clientId,
      redirectUri,
      env,
      currentHost: host,
      isHostMismatch,
      instruction: isHostMismatch 
        ? `ADVERTENCIA: Estás accediendo desde '${host}' pero tu Redirect URI de ClaveÚnica está apuntando a '${redirectHost}'. ClaveÚnica rechazará la solicitud por política de seguridad (mismatch de redirect_uri). Asegúrate de registrar '${host}' en el portal de ClaveÚnica, o bien define CLAVEUNICA_REDIRECT_URI en tus variables de entorno para forzarlo.`
        : `Correcto: Tu host de acceso actual '${host}' es compatible con el Redirect URI '${redirectHost}'.`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ClaveÚnica Callback
app.get("/api/auth/claveunica/callback", async (req, res) => {
  const { code, state } = req.query;
  const savedState = req.cookies.cu_state;

  if (!code || !state || state !== savedState) {
    return res.status(400).send("Invalid code or state");
  }

  const { clientId, clientSecret, redirectUri } = getClaveUnicaConfig(req);

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).send("ClaveÚnica configuration missing on server");
  }

  try {
    // 1. Exchange code for token
    const tokenResponse = await axios.post(CU_TOKEN_URL, new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code: code as string,
    }).toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const { access_token } = tokenResponse.data;

    // 2. Get user info
    const userInfoResponse = await axios.post(CU_USERINFO_URL, {}, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const userInfo = userInfoResponse.data;
    // ClaveÚnica user info usually includes:
    // rol (RUN), name { first, middle, last, maiden }

    const run = userInfo.run; // This is the unique ID (National ID)
    const fullName = `${userInfo.name.nombres} ${userInfo.name.apellidos.join(' ')}`;

    // 3. Create Firebase Custom Token
    const adminApp = getAdmin();
    if (!adminApp) {
      // If Firebase Admin is not configured, we can still redirect with info, 
      // but we can't sign them in automatically via custom token.
      // For now, let's assume it's configured or we fallback.
      throw new Error("Firebase Admin not configured");
    }

    // UID must be unique. Using run as UID.
    const uid = `cu_${run}`;
    
    // Check if user exists or update their name
    try {
      await adminApp.auth().getUser(uid);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        await adminApp.auth().createUser({
          uid,
          displayName: fullName,
        });
      }
    }

    const customToken = await adminApp.auth().createCustomToken(uid);

    // Serve a simple page that postMessages the custom token to the parent window
    // if opened in a popup (which allows bypassing iframe/X-Frame-Options constraints),
    // and falls back to traditional redirection if accessed in the main window.
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autenticando...</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background-color: #050a18;
              color: white;
              margin: 0;
            }
            .container {
              text-align: center;
              padding: 2.5rem;
              border-radius: 1.5rem;
              background-color: #0b152d;
              border: 1px solid rgba(255,255,255,0.08);
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
              max-width: 320px;
            }
            .spinner {
              border: 3px solid rgba(59, 130, 246, 0.1);
              width: 40px;
              height: 40px;
              border-radius: 50%;
              border-left-color: #3b82f6;
              animation: spin 0.8s linear infinite;
              margin: 0 auto 1.5rem;
            }
            h3 {
              margin: 0 0 0.5rem;
              font-size: 1.25rem;
              font-weight: 700;
            }
            p {
              margin: 0;
              color: #94a3b8;
              font-size: 0.875rem;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h3>¡Autenticado!</h3>
            <p>Conectando de forma segura con el Hospital de Curepto...</p>
          </div>
          <script>
            // Check if we are inside a popup
            if (window.opener && window.opener !== window) {
              try {
                // Send custom token to parent to sign in
                window.opener.postMessage({ 
                  type: 'CLAVEUNICA_AUTH_SUCCESS', 
                  customToken: '${customToken}' 
                }, '*');
                
                // Keep window open for a tiny moment so the user sees completion, then close
                setTimeout(() => {
                  window.close();
                }, 800);
              } catch (e) {
                console.error("Error postMessage to opener:", e);
                window.location.href = "/?customToken=${customToken}";
              }
            } else {
              // Direct navigation fallback (e.g. if opened in direct tab)
              window.location.href = "/?customToken=${customToken}";
            }
          </script>
        </body>
      </html>
    `);

  } catch (error: any) {
    console.error("ClaveÚnica Auth Error:", error.response?.data || error.message);
    res.status(500).send("Authentication failed");
  }
});

// Handle root callback for ClaveÚnica (if root was used as Redirect URI)
app.get("/", (req, res, next) => {
  const { code, state } = req.query;
  if (code && state) {
    return res.redirect(`/api/auth/claveunica/callback?code=${code}&state=${state}`);
  }
  next();
});

// Vite Middleware & Static Files
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);
  // Detect if we are in production by check of NODE_ENV or running the compiled .cjs bundle
  const isProduction = process.env.NODE_ENV === "production" || (typeof __filename !== "undefined" && !__filename.endsWith("server.ts"));

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware loaded successfully.");
    } catch (e) {
      console.warn("Vite is not available or failed to load. Falling back to serving static dist directory...", e);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get(/.*/, (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.error("Critical: dist folder does not exist and Vite cannot be loaded.");
      }
    }
  } else {
    if (hasDist) {
      app.use(express.static(distPath));
      app.get(/.*/, (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log(`Serving static files from: ${distPath}`);
    } else {
      console.error("Critical Warning: Production build directory 'dist' was not found!");
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
