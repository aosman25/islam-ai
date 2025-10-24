import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Determine if running in Docker
const IS_DOCKER = process.env.DOCKER_ENV === "true";

// Service URLs - use container names in Docker, localhost otherwise
const SERVICES = {
  gateway: IS_DOCKER ? "http://gateway:8000" : "http://localhost:8100",
  ask: IS_DOCKER ? "http://ask-service:2000" : "http://localhost:2000",
  search: IS_DOCKER ? "http://search-service:3000" : "http://localhost:3000",
  embed: IS_DOCKER ? "http://embed-service:4000" : "http://localhost:4000",
  queryOptimizer: IS_DOCKER
    ? "http://query-optimizer:5000"
    : "http://localhost:5000",
};

console.log("🚀 Starting Internal Service Proxy Server");
console.log(`📍 Environment: ${IS_DOCKER ? "Docker" : "Local"}`);
console.log("🔗 Service URLs:");
Object.entries(SERVICES).forEach(([name, url]) => {
  console.log(`   - ${name}: ${url}`);
});

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Proxy configuration
const proxyOptions = {
  changeOrigin: true,
  logLevel: "info",
  onError: (err, req, res) => {
    console.error("Proxy Error:", err.message);
    res.status(502).json({
      error: "Bad Gateway",
      message: err.message,
      service: req.baseUrl,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log successful proxy responses
    console.log(`✓ ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
  },
};

// Setup proxies for each service
app.use(
  "/api/gateway",
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.gateway,
    pathRewrite: { "^/api/gateway": "" },
  })
);

app.use(
  "/api/ask",
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.ask,
    pathRewrite: { "^/api/ask": "" },
  })
);

app.use(
  "/api/search",
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.search,
    pathRewrite: { "^/api/search": "" },
  })
);

app.use(
  "/api/embed",
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.embed,
    pathRewrite: { "^/api/embed": "" },
  })
);

app.use(
  "/api/query-optimizer",
  createProxyMiddleware({
    ...proxyOptions,
    target: SERVICES.queryOptimizer,
    pathRewrite: { "^/api/query-optimizer": "" },
  })
);

// Serve static files in production
if (IS_DOCKER) {
  const distPath = join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  // Handle client-side routing
  app.get("*", (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Proxy server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api/*`);
  if (IS_DOCKER) {
    console.log(`🌐 Static files served from dist/`);
  }
});
