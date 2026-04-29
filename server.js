const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || "labadmin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const adminSessions = new Map();

const dbPool = mysql.createPool({
  host: process.env.DB_HOST || "srv2213.hstgr.io",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "u201150341_spyrolab",
  password: process.env.DB_PASS || "Asd@088711",
  database: process.env.DB_NAME || "u201150341_lab_portal",
  waitForConnections: true,
  connectionLimit: 10
});

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
      if (data.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, meta] of adminSessions.entries()) {
    if (meta.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function createAdminSession(username) {
  cleanExpiredSessions();
  const token = crypto.randomBytes(24).toString("hex");
  adminSessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1].trim();
  }
  return "";
}

function requireAdmin(req) {
  const token = getAuthToken(req);
  if (!token) {
    return null;
  }
  cleanExpiredSessions();
  const session = adminSessions.get(token);
  if (!session) {
    return null;
  }
  return { token, username: session.username };
}

function serveStatic(req, res) {
  const onlyPath = req.url.split("?")[0];
  const unsafePath = onlyPath === "/" ? "/index.html" : onlyPath;
  const safePath = path.normalize(unsafePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(__dirname, "frontend", safePath);

  if (!filePath.startsWith(path.join(__dirname, "frontend"))) {
    sendJson(res, 403, { ok: false, message: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(res, 404, { ok: false, message: "Not found" });
        return;
      }
      sendJson(res, 500, { ok: false, message: "Server error" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
}

async function getTests() {
  const [rows] = await dbPool.query(
    `SELECT id, name, category, fasting_required, price_inr
     FROM tests
     WHERE is_active = 1
     ORDER BY display_order ASC, id DESC`
  );
  return rows;
}

async function getPackages() {
  const [rows] = await dbPool.query(
    `SELECT id, name, tests_count, ideal_for, report_time, original_price_inr, offer_price_inr
     FROM packages
     WHERE is_active = 1
     ORDER BY display_order ASC, id DESC`
  );
  return rows;
}

async function getAdminPackages() {
  const [rows] = await dbPool.query(
    `SELECT id, name, tests_count, ideal_for, report_time, original_price_inr, offer_price_inr, is_active, display_order
     FROM packages
     ORDER BY display_order ASC, id DESC`
  );
  return rows;
}

async function getAdminTests() {
  const [rows] = await dbPool.query(
    `SELECT id, name, category, fasting_required, price_inr, is_active, display_order
     FROM tests
     ORDER BY display_order ASC, id DESC`
  );
  return rows;
}

async function getServices() {
  const [rows] = await dbPool.query(
    `SELECT id, title, description, tag
     FROM services
     WHERE is_active = 1
     ORDER BY display_order ASC, id DESC`
  );
  return rows;
}

async function createServiceRequest(payload) {
  const sql = `INSERT INTO service_requests
    (service_id, patient_name, phone, city, message, preferred_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'new')`;
  const values = [
    payload.service_id,
    payload.patient_name.trim(),
    payload.phone.trim(),
    payload.city ? payload.city.trim() : null,
    payload.message ? payload.message.trim() : null,
    payload.preferred_date || null
  ];
  const [result] = await dbPool.execute(sql, values);
  return result.insertId;
}

async function createBooking(payload) {
  const sql = `INSERT INTO bookings
    (patient_name, phone, email, city, address, collection_date, collection_slot, selected_tests, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;
  const values = [
    payload.patient_name.trim(),
    payload.phone.trim(),
    payload.email.trim(),
    payload.city.trim(),
    payload.address.trim(),
    payload.collection_date,
    payload.collection_slot.trim(),
    payload.selected_tests ? payload.selected_tests.trim() : null
  ];
  const [result] = await dbPool.execute(sql, values);
  return result.insertId;
}

async function getBookings() {
  const [rows] = await dbPool.query(
    `SELECT id, patient_name, phone, email, city, address, collection_date, collection_slot, selected_tests, status, created_at
     FROM bookings
     ORDER BY id DESC
     LIMIT 100`
  );
  return rows;
}

async function getAdminBookings(filters) {
  const sortable = {
    collection_date: "collection_date",
    created_at: "created_at",
    patient_name: "patient_name",
    city: "city",
    status: "status"
  };

  const sortBy = sortable[filters.sort_by] || "collection_date";
  const sortDir = String(filters.sort_dir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const where = [];
  const params = [];

  if (filters.from_date) {
    where.push("collection_date >= ?");
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    where.push("collection_date <= ?");
    params.push(filters.to_date);
  }
  if (filters.city) {
    where.push("city LIKE ?");
    params.push(`%${filters.city}%`);
  }
  if (filters.status) {
    where.push("status = ?");
    params.push(filters.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT id, patient_name, phone, email, city, address, collection_date, collection_slot, selected_tests, status, created_at
    FROM bookings
    ${whereSql}
    ORDER BY ${sortBy} ${sortDir}, id DESC
    LIMIT 250`;

  const [rows] = await dbPool.query(sql, params);
  return rows;
}

async function createPackage(payload) {
  const sql = `INSERT INTO packages
    (name, tests_count, ideal_for, report_time, original_price_inr, offer_price_inr, display_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = [
    payload.name.trim(),
    Number(payload.tests_count),
    payload.ideal_for.trim(),
    payload.report_time.trim(),
    Number(payload.original_price_inr),
    Number(payload.offer_price_inr),
    Number(payload.display_order || 100),
    Number(payload.is_active) ? 1 : 0
  ];
  const [result] = await dbPool.execute(sql, values);
  return result.insertId;
}

async function updatePackage(id, payload) {
  const sql = `UPDATE packages
    SET name = ?, tests_count = ?, ideal_for = ?, report_time = ?, original_price_inr = ?, offer_price_inr = ?, display_order = ?, is_active = ?
    WHERE id = ?`;
  const values = [
    payload.name.trim(),
    Number(payload.tests_count),
    payload.ideal_for.trim(),
    payload.report_time.trim(),
    Number(payload.original_price_inr),
    Number(payload.offer_price_inr),
    Number(payload.display_order || 100),
    Number(payload.is_active) ? 1 : 0,
    Number(id)
  ];
  const [result] = await dbPool.execute(sql, values);
  return result.affectedRows;
}

async function createTest(payload) {
  const sql = `INSERT INTO tests
    (name, category, fasting_required, price_inr, display_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?)`;
  const values = [
    payload.name.trim(),
    payload.category.trim(),
    Number(payload.fasting_required) ? 1 : 0,
    Number(payload.price_inr),
    Number(payload.display_order || 100),
    Number(payload.is_active) ? 1 : 0
  ];
  const [result] = await dbPool.execute(sql, values);
  return result.insertId;
}

async function updateTest(id, payload) {
  const sql = `UPDATE tests
    SET name = ?, category = ?, fasting_required = ?, price_inr = ?, display_order = ?, is_active = ?
    WHERE id = ?`;
  const values = [
    payload.name.trim(),
    payload.category.trim(),
    Number(payload.fasting_required) ? 1 : 0,
    Number(payload.price_inr),
    Number(payload.display_order || 100),
    Number(payload.is_active) ? 1 : 0,
    Number(id)
  ];
  const [result] = await dbPool.execute(sql, values);
  return result.affectedRows;
}

async function updateTestActiveFlag(id, isActive) {
  const [result] = await dbPool.execute("UPDATE tests SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, id]);
  return result.affectedRows;
}

async function updatePackageActiveFlag(id, isActive) {
  const [result] = await dbPool.execute("UPDATE packages SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, id]);
  return result.affectedRows;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const pathname = requestUrl.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "GET" && pathname === "/api/health") {
      try {
        await dbPool.query("SELECT 1");
        sendJson(res, 200, { ok: true, service: "node-backend", database: "connected" });
      } catch (error) {
        sendJson(res, 503, { ok: false, service: "node-backend", database: "disconnected", error: error.message });
      }
      return;
    }

    if (req.method === "GET" && pathname === "/api/tests") {
      const tests = await getTests();
      sendJson(res, 200, { ok: true, tests });
      return;
    }

    if (req.method === "GET" && pathname === "/api/packages") {
      const packages = await getPackages();
      sendJson(res, 200, { ok: true, packages });
      return;
    }

    if (req.method === "GET" && pathname === "/api/services") {
      const services = await getServices();
      sendJson(res, 200, { ok: true, services });
      return;
    }

    if (req.method === "POST" && pathname === "/api/bookings") {
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");

      const required = ["patient_name", "phone", "email", "city", "address", "collection_date", "collection_slot"];
      const missing = required.filter((key) => !parsed[key] || String(parsed[key]).trim() === "");
      if (missing.length) {
        sendJson(res, 400, { ok: false, message: `Missing required fields: ${missing.join(", ")}` });
        return;
      }

      const bookingId = await createBooking(parsed);
      sendJson(res, 201, {
        ok: true,
        message: "Home collection booking created",
        booking_id: bookingId
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/service-requests") {
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");

      const required = ["service_id", "patient_name", "phone"];
      const missing = required.filter((key) => !parsed[key] || String(parsed[key]).trim() === "");
      if (missing.length) {
        sendJson(res, 400, { ok: false, message: `Missing required fields: ${missing.join(", ")}` });
        return;
      }

      const requestId = await createServiceRequest(parsed);
      sendJson(res, 201, {
        ok: true,
        message: "Service request submitted",
        request_id: requestId
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/bookings") {
      const bookings = await getBookings();
      sendJson(res, 200, { ok: true, bookings });
      return;
    }

    if (req.method === "POST" && pathname === "/api/admin/login") {
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      const username = String(parsed.username || "").trim();
      const password = String(parsed.password || "");

      if (!username || !password) {
        sendJson(res, 400, { ok: false, message: "Username and password are required." });
        return;
      }

      if (username !== ADMIN_USER || password !== ADMIN_PASS) {
        sendJson(res, 401, { ok: false, message: "Invalid login credentials." });
        return;
      }

      const token = createAdminSession(username);
      sendJson(res, 200, { ok: true, token, username, expires_in_ms: SESSION_TTL_MS });
      return;
    }

    if (req.method === "POST" && pathname === "/api/admin/logout") {
      const token = getAuthToken(req);
      if (token) {
        adminSessions.delete(token);
      }
      sendJson(res, 200, { ok: true, message: "Logged out." });
      return;
    }

    if (req.method === "GET" && pathname === "/api/admin/bookings") {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }

      const filters = {
        sort_by: requestUrl.searchParams.get("sort_by") || "collection_date",
        sort_dir: requestUrl.searchParams.get("sort_dir") || "asc",
        from_date: requestUrl.searchParams.get("from_date") || "",
        to_date: requestUrl.searchParams.get("to_date") || "",
        city: requestUrl.searchParams.get("city") || "",
        status: requestUrl.searchParams.get("status") || ""
      };
      const bookings = await getAdminBookings(filters);
      sendJson(res, 200, { ok: true, bookings, filters });
      return;
    }

    if (req.method === "GET" && pathname === "/api/admin/packages") {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }
      const rows = await getAdminPackages();
      sendJson(res, 200, { ok: true, packages: rows });
      return;
    }

    if (req.method === "POST" && pathname === "/api/admin/packages") {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }

      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      const required = ["name", "tests_count", "ideal_for", "report_time", "original_price_inr", "offer_price_inr"];
      const missing = required.filter((key) => parsed[key] === undefined || String(parsed[key]).trim() === "");
      if (missing.length) {
        sendJson(res, 400, { ok: false, message: `Missing required fields: ${missing.join(", ")}` });
        return;
      }

      const testsCount = Number(parsed.tests_count);
      const originalPrice = Number(parsed.original_price_inr);
      const offerPrice = Number(parsed.offer_price_inr);
      if (
        Number.isNaN(testsCount) ||
        Number.isNaN(originalPrice) ||
        Number.isNaN(offerPrice) ||
        testsCount <= 0 ||
        originalPrice <= 0 ||
        offerPrice <= 0
      ) {
        sendJson(res, 400, { ok: false, message: "Numeric fields must be valid positive numbers." });
        return;
      }

      const packageId = await createPackage(parsed);
      sendJson(res, 201, { ok: true, message: "Package created successfully.", package_id: packageId });
      return;
    }

    const adminPackageEditMatch = pathname.match(/^\/api\/admin\/packages\/(\d+)$/);
    if (req.method === "PUT" && adminPackageEditMatch) {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      const required = ["name", "tests_count", "ideal_for", "report_time", "original_price_inr", "offer_price_inr"];
      const missing = required.filter((key) => parsed[key] === undefined || String(parsed[key]).trim() === "");
      if (missing.length) {
        sendJson(res, 400, { ok: false, message: `Missing required fields: ${missing.join(", ")}` });
        return;
      }
      const testsCount = Number(parsed.tests_count);
      const originalPrice = Number(parsed.original_price_inr);
      const offerPrice = Number(parsed.offer_price_inr);
      if (
        Number.isNaN(testsCount) ||
        Number.isNaN(originalPrice) ||
        Number.isNaN(offerPrice) ||
        testsCount <= 0 ||
        originalPrice <= 0 ||
        offerPrice <= 0
      ) {
        sendJson(res, 400, { ok: false, message: "Numeric fields must be valid positive numbers." });
        return;
      }
      const affected = await updatePackage(Number(adminPackageEditMatch[1]), parsed);
      if (!affected) {
        sendJson(res, 404, { ok: false, message: "Package not found." });
        return;
      }
      sendJson(res, 200, { ok: true, message: "Package updated successfully." });
      return;
    }

    if (req.method === "GET" && pathname === "/api/admin/tests") {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }
      const rows = await getAdminTests();
      sendJson(res, 200, { ok: true, tests: rows });
      return;
    }

    if (req.method === "POST" && pathname === "/api/admin/tests") {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }

      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      const required = ["name", "category", "price_inr"];
      const missing = required.filter((key) => parsed[key] === undefined || String(parsed[key]).trim() === "");
      if (missing.length) {
        sendJson(res, 400, { ok: false, message: `Missing required fields: ${missing.join(", ")}` });
        return;
      }
      const price = Number(parsed.price_inr);
      if (Number.isNaN(price) || price <= 0) {
        sendJson(res, 400, { ok: false, message: "Price must be a valid positive number." });
        return;
      }

      const testId = await createTest(parsed);
      sendJson(res, 201, { ok: true, message: "Test created successfully.", test_id: testId });
      return;
    }

    const adminTestEditMatch = pathname.match(/^\/api\/admin\/tests\/(\d+)$/);
    if (req.method === "PUT" && adminTestEditMatch) {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      const required = ["name", "category", "price_inr"];
      const missing = required.filter((key) => parsed[key] === undefined || String(parsed[key]).trim() === "");
      if (missing.length) {
        sendJson(res, 400, { ok: false, message: `Missing required fields: ${missing.join(", ")}` });
        return;
      }
      const price = Number(parsed.price_inr);
      if (Number.isNaN(price) || price <= 0) {
        sendJson(res, 400, { ok: false, message: "Price must be a valid positive number." });
        return;
      }
      const affected = await updateTest(Number(adminTestEditMatch[1]), parsed);
      if (!affected) {
        sendJson(res, 404, { ok: false, message: "Test not found." });
        return;
      }
      sendJson(res, 200, { ok: true, message: "Test updated successfully." });
      return;
    }

    const testStatusMatch = pathname.match(/^\/api\/admin\/tests\/(\d+)\/status$/);
    if (req.method === "PATCH" && testStatusMatch) {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      if (parsed.is_active === undefined) {
        sendJson(res, 400, { ok: false, message: "is_active is required." });
        return;
      }
      const affected = await updateTestActiveFlag(Number(testStatusMatch[1]), Number(parsed.is_active) ? 1 : 0);
      if (!affected) {
        sendJson(res, 404, { ok: false, message: "Test not found." });
        return;
      }
      sendJson(res, 200, { ok: true, message: "Test status updated." });
      return;
    }

    const packageStatusMatch = pathname.match(/^\/api\/admin\/packages\/(\d+)\/status$/);
    if (req.method === "PATCH" && packageStatusMatch) {
      const admin = requireAdmin(req);
      if (!admin) {
        sendJson(res, 401, { ok: false, message: "Unauthorized admin access." });
        return;
      }
      const body = await readBody(req);
      const parsed = JSON.parse(body || "{}");
      if (parsed.is_active === undefined) {
        sendJson(res, 400, { ok: false, message: "is_active is required." });
        return;
      }
      const affected = await updatePackageActiveFlag(Number(packageStatusMatch[1]), Number(parsed.is_active) ? 1 : 0);
      if (!affected) {
        sendJson(res, 404, { ok: false, message: "Package not found." });
        return;
      }
      sendJson(res, 200, { ok: true, message: "Package status updated." });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: "Unexpected server error", error: error.message });
  }
});

// server.listen(PORT, () => {
//   process.stdout.write(`Node backend running at http://127.0.0.1:${PORT}\n`);
// });

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
