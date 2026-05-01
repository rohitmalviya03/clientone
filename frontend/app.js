const { useEffect, useMemo, useState } = React;

function App() {
  const isAdminPage = window.location.pathname.toLowerCase().endsWith("/lab-login.html");
  const [tests, setTests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [services, setServices] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [form, setForm] = useState({
    patient_name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    collection_date: "",
    collection_slot: "07:00 - 09:00",
    selected_tests: "Complete Blood Count (CBC)"
  });

  const [adminToken, setAdminToken] = useState(localStorage.getItem("lab_admin_token") || "");
  const [adminUser, setAdminUser] = useState(localStorage.getItem("lab_admin_user") || "");
  const [adminTab, setAdminTab] = useState("activity");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [adminStatus, setAdminStatus] = useState({ type: "", message: "" });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminTests, setAdminTests] = useState([]);
  const [adminPackages, setAdminPackages] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [bookingFilters, setBookingFilters] = useState({
    sort_by: "collection_date",
    sort_dir: "asc",
    from_date: "",
    to_date: "",
    city: "",
    status: ""
  });
  const [addingPackage, setAddingPackage] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [packageForm, setPackageForm] = useState({
    name: "",
    tests_count: "",
    ideal_for: "",
    report_time: "24 hours",
    original_price_inr: "",
    offer_price_inr: "",
    display_order: "100",
    is_active: true
  });
  const [addingTest, setAddingTest] = useState(false);
  const [editingTestId, setEditingTestId] = useState(null);
  const [testForm, setTestForm] = useState({
    name: "",
    category: "",
    fasting_required: false,
    price_inr: "",
    display_order: "100",
    is_active: true
  });

  async function loadPublicData() {
    setLoadingTests(true);
    setLoadingPackages(true);
    setLoadingServices(true);

    fetch("/api/tests")
      .then((r) => r.json())
      .then((data) => setTests(data.tests || []))
      .catch(() => setTests([]))
      .finally(() => setLoadingTests(false));

    fetch("/api/packages")
      .then((r) => r.json())
      .then((data) => setPackages(data.packages || []))
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));

    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => setServices(data.services || []))
      .catch(() => setServices([]))
      .finally(() => setLoadingServices(false));
  }

  useEffect(() => {
    loadPublicData();
  }, []);

  async function loadAdminBookings(nextFilters = bookingFilters) {
    if (!adminToken) {
      return;
    }
    setBookingLoading(true);
    setAdminStatus({ type: "", message: "" });
    try {
      const params = new URLSearchParams(nextFilters);
      const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to fetch booking activity.");
      }
      setAdminBookings(data.bookings || []);
    } catch (error) {
      setAdminStatus({ type: "err", message: error.message || "Could not load admin activity." });
    } finally {
      setBookingLoading(false);
    }
  }

  async function loadAdminCatalog() {
    if (!adminToken) {
      return;
    }
    setCatalogLoading(true);
    try {
      const [testsRes, packagesRes] = await Promise.all([
        fetch("/api/admin/tests", { headers: { Authorization: `Bearer ${adminToken}` } }),
        fetch("/api/admin/packages", { headers: { Authorization: `Bearer ${adminToken}` } })
      ]);
      const testsData = await testsRes.json();
      const packagesData = await packagesRes.json();
      if (!testsRes.ok || !testsData.ok) {
        throw new Error(testsData.message || "Failed to fetch tests.");
      }
      if (!packagesRes.ok || !packagesData.ok) {
        throw new Error(packagesData.message || "Failed to fetch packages.");
      }
      setAdminTests(testsData.tests || []);
      setAdminPackages(packagesData.packages || []);
    } catch (error) {
      setAdminStatus({ type: "err", message: error.message || "Could not load catalog data." });
    } finally {
      setCatalogLoading(false);
    }
  }

  useEffect(() => {
    if (adminToken) {
      loadAdminBookings();
      loadAdminCatalog();
    }
  }, [adminToken]);

  const visibleTests = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return tests;
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes(keyword) ||
        String(t.category || "").toLowerCase().includes(keyword)
    );
  }, [tests, query]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submitBooking(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Could not submit booking");
      }
      setStatus({
        type: "ok",
        message: `Booking confirmed. Request ID: ${data.booking_id}. Our phlebotomist will call shortly.`
      });
      setForm({
        patient_name: "",
        phone: "",
        email: "",
        city: "",
        address: "",
        collection_date: "",
        collection_slot: "07:00 - 09:00",
        selected_tests: form.selected_tests
      });
    } catch (error) {
      setStatus({
        type: "err",
        message: error.message || "Something went wrong while creating booking."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdminLogin(e) {
    e.preventDefault();
    setAdminStatus({ type: "", message: "" });
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Login failed.");
      }
      setAdminToken(data.token);
      setAdminUser(data.username);
      localStorage.setItem("lab_admin_token", data.token);
      localStorage.setItem("lab_admin_user", data.username);
      setLoginForm({ username: "", password: "" });
      setAdminStatus({ type: "ok", message: "Lab admin login successful." });
    } catch (error) {
      setAdminStatus({ type: "err", message: error.message || "Login failed." });
    }
  }

  async function logoutAdmin() {
    if (adminToken) {
      try {
        await fetch("/api/admin/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` }
        });
      } catch (_error) {
      }
    }
    setAdminToken("");
    setAdminUser("");
    setAdminBookings([]);
    localStorage.removeItem("lab_admin_token");
    localStorage.removeItem("lab_admin_user");
    setAdminStatus({ type: "", message: "" });
  }

  function updateBookingFilter(key, value) {
    setBookingFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function applyBookingFilters(e) {
    e.preventDefault();
    await loadAdminBookings(bookingFilters);
  }

  async function submitPackageFromAdmin(e) {
    e.preventDefault();
    if (!adminToken) {
      setAdminStatus({ type: "err", message: "Please login as lab admin first." });
      return;
    }
    setAddingPackage(true);
    setAdminStatus({ type: "", message: "" });
    try {
      const isEdit = Boolean(editingPackageId);
      const res = await fetch(isEdit ? `/api/admin/packages/${editingPackageId}` : "/api/admin/packages", {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(packageForm)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to add package.");
      }
      setAdminStatus({
        type: "ok",
        message: isEdit ? "Package updated successfully." : `Package added successfully. ID: ${data.package_id}`
      });
      setPackageForm({
        name: "",
        tests_count: "",
        ideal_for: "",
        report_time: "24 hours",
        original_price_inr: "",
        offer_price_inr: "",
        display_order: "100",
        is_active: true
      });
      setEditingPackageId(null);
      await Promise.all([loadPublicData(), loadAdminCatalog()]);
    } catch (error) {
      setAdminStatus({ type: "err", message: error.message || "Failed to add package." });
    } finally {
      setAddingPackage(false);
    }
  }

  async function submitTestFromAdmin(e) {
    e.preventDefault();
    if (!adminToken) {
      setAdminStatus({ type: "err", message: "Please login as lab admin first." });
      return;
    }
    setAddingTest(true);
    setAdminStatus({ type: "", message: "" });
    try {
      const isEdit = Boolean(editingTestId);
      const res = await fetch(isEdit ? `/api/admin/tests/${editingTestId}` : "/api/admin/tests", {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(testForm)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to add test.");
      }
      setAdminStatus({
        type: "ok",
        message: isEdit ? "Test updated successfully." : `Test added successfully. ID: ${data.test_id}`
      });
      setTestForm({
        name: "",
        category: "",
        fasting_required: false,
        price_inr: "",
        display_order: "100",
        is_active: true
      });
      setEditingTestId(null);
      await Promise.all([loadPublicData(), loadAdminCatalog()]);
    } catch (error) {
      setAdminStatus({ type: "err", message: error.message || "Failed to add test." });
    } finally {
      setAddingTest(false);
    }
  }

  async function toggleCatalogStatus(type, id, isActive) {
    if (!adminToken) {
      setAdminStatus({ type: "err", message: "Please login as lab admin first." });
      return;
    }
    setAdminStatus({ type: "", message: "" });
    try {
      const base = type === "test" ? "tests" : "packages";
      const res = await fetch(`/api/admin/${base}/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ is_active: isActive ? 1 : 0 })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Status update failed.");
      }
      setAdminStatus({ type: "ok", message: `${type === "test" ? "Test" : "Package"} status updated.` });
      await Promise.all([loadPublicData(), loadAdminCatalog()]);
    } catch (error) {
      setAdminStatus({ type: "err", message: error.message || "Status update failed." });
    }
  }

  function startEditPackage(item) {
    setAdminTab("packages");
    setEditingPackageId(item.id);
    setPackageForm({
      name: item.name || "",
      tests_count: String(item.tests_count || ""),
      ideal_for: item.ideal_for || "",
      report_time: item.report_time || "",
      original_price_inr: String(item.original_price_inr || ""),
      offer_price_inr: String(item.offer_price_inr || ""),
      display_order: String(item.display_order || 100),
      is_active: Boolean(Number(item.is_active))
    });
  }

  function startEditTest(item) {
    setAdminTab("tests");
    setEditingTestId(item.id);
    setTestForm({
      name: item.name || "",
      category: item.category || "",
      fasting_required: Boolean(Number(item.fasting_required)),
      price_inr: String(item.price_inr || ""),
      display_order: String(item.display_order || 100),
      is_active: Boolean(Number(item.is_active))
    });
  }

  return (
    <>
      <div className="topbar">
        <div className="container">
          <span>Trusted Diagnostic Network | NABL Standards | 24x7 Support</span>
          <span>Call: +91 90000 12345</span>
        </div>
      </div>

      <header className="navbar">
        <div className="container nav-wrap">
          <div className="brand">Spyro Diagnostics</div>
          <nav className="nav-links">
            {isAdminPage ? (
              <a href="/">Back To Website</a>
            ) : (
              <>
                <a href="#packages">Packages</a>
                <a href="#tests">Tests</a>
                <a href="#process">How It Works</a>
                <a href="#trust">Why Us</a>
              </>
            )}
          </nav>
          <div className="nav-actions">
            {isAdminPage ? null : (
              <>
                <button className="btn btn-alt" type="button" onClick={() => (window.location.href = "/lab-login.html")}>
                  Lab Login
                </button>
<button className="btn btn-alt" onClick={() => window.location.href = "#contact"}>
  Find Centre
</button>                <button className="btn btn-primary" onClick={() => window.location.href = "#booking"}>
                  Book Home Collection
                </button>

              </>
            )}
          </div>
        </div>
      </header>

      {isAdminPage && (
      <section className="section" id="admin">
        <div className="container">
          <div className="admin-shell">
            <div className="admin-head">
              <h2>Lab Admin Portal</h2>
              {adminToken ? (
                <div className="admin-user-row">
                  <span>Logged in as {adminUser}</span>
                  <button className="btn btn-alt" type="button" onClick={logoutAdmin}>
                    Logout
                  </button>
                </div>
              ) : null}
            </div>

            <div className="admin-tabs">
              <button
                type="button"
                className={`admin-tab ${adminTab === "activity" ? "active" : ""}`}
                onClick={() => setAdminTab("activity")}
              >
                Patient Activity
              </button>
              // <button
              //   type="button"
              //   className={`admin-tab ${adminTab === "packages" ? "active" : ""}`}
              //   onClick={() => setAdminTab("packages")}
              // >
              //   Add Package
              // </button>x
              // <button
              //   type="button"
              //   className={`admin-tab ${adminTab === "tests" ? "active" : ""}`}
              //   onClick={() => setAdminTab("tests")}
              // >
              //   Add Test
              // </button>
              // <button
              //   type="button"
              //   className={`admin-tab ${adminTab === "status" ? "active" : ""}`}
              //   onClick={() => setAdminTab("status")}
              // >
              //   Active / Inactive
              // </button>
            </div>

            {!adminToken ? (
              <form className="admin-login" onSubmit={submitAdminLogin}>
                <div className="form-grid">
                  <div className="field">
                    <label>Lab Username</label>
                    <input
                      value={loginForm.username}
                      onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Password</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">
                  Login
                </button>
                <p className="admin-note">Default: labadmin / admin123 (change via env vars).</p>
              </form>
            ) : null}

            {adminToken && adminTab === "activity" ? (
              <div className="admin-panel">
                <form className="admin-filter-grid" onSubmit={applyBookingFilters}>
                  <div className="field">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={bookingFilters.from_date}
                      onChange={(e) => updateBookingFilter("from_date", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={bookingFilters.to_date}
                      onChange={(e) => updateBookingFilter("to_date", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>City</label>
                    <input
                      value={bookingFilters.city}
                      onChange={(e) => updateBookingFilter("city", e.target.value)}
                      placeholder="Hisar"
                    />
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={bookingFilters.status}
                      onChange={(e) => updateBookingFilter("status", e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Sort By</label>
                    <select
                      value={bookingFilters.sort_by}
                      onChange={(e) => updateBookingFilter("sort_by", e.target.value)}
                    >
                      <option value="collection_date">Collection Date</option>
                      <option value="created_at">Created At</option>
                      <option value="patient_name">Patient Name</option>
                      <option value="city">City</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Direction</label>
                    <select
                      value={bookingFilters.sort_dir}
                      onChange={(e) => updateBookingFilter("sort_dir", e.target.value)}
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" type="submit">
                    Apply Filters
                  </button>
                </form>

                <div className="table-wrap">
                  {bookingLoading ? (
                    <p>Loading patient activity...</p>
                  ) : adminBookings.length ? (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Patient</th>
                          <th>Phone</th>
                          <th>City</th>
                          <th>Slot</th>
                          <th>Tests</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminBookings.map((row) => (
                          <tr key={row.id}>
                            <td>{row.collection_date}</td>
                            <td>{row.patient_name}</td>
                            <td>{row.phone}</td>
                            <td>{row.city}</td>
                            <td>{row.collection_slot}</td>
                            <td>{row.selected_tests || "-"}</td>
                            <td>{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No patient activity found for selected filters.</p>
                  )}
                </div>
              </div>
            ) : null}

            {adminToken && adminTab === "packages" ? (
              <form className="admin-panel" onSubmit={submitPackageFromAdmin}>
                <div className="form-grid">
                  <div className="field">
                    <label>Package Name</label>
                    <input
                      value={packageForm.name}
                      onChange={(e) => setPackageForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Tests Count</label>
                    <input
                      type="number"
                      min="1"
                      value={packageForm.tests_count}
                      onChange={(e) => setPackageForm((p) => ({ ...p, tests_count: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Report Time</label>
                    <input
                      value={packageForm.report_time}
                      onChange={(e) => setPackageForm((p) => ({ ...p, report_time: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Display Order</label>
                    <input
                      type="number"
                      min="1"
                      value={packageForm.display_order}
                      onChange={(e) => setPackageForm((p) => ({ ...p, display_order: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Original Price (INR)</label>
                    <input
                      type="number"
                      min="1"
                      value={packageForm.original_price_inr}
                      onChange={(e) => setPackageForm((p) => ({ ...p, original_price_inr: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Offer Price (INR)</label>
                    <input
                      type="number"
                      min="1"
                      value={packageForm.offer_price_inr}
                      onChange={(e) => setPackageForm((p) => ({ ...p, offer_price_inr: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="field checkbox-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={packageForm.is_active}
                      onChange={(e) => setPackageForm((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    Active Package
                  </label>
                </div>
                <div className="field">
                  <label>Ideal For</label>
                  <textarea
                    value={packageForm.ideal_for}
                    onChange={(e) => setPackageForm((p) => ({ ...p, ideal_for: e.target.value }))}
                    required
                  />
                </div>
                <button className="btn btn-primary" type="submit" disabled={addingPackage}>
                  {addingPackage ? (editingPackageId ? "Updating Package..." : "Adding Package...") : (editingPackageId ? "Update Package" : "Add Package")}
                </button>
                {editingPackageId ? (
                  <button
                    className="btn btn-alt"
                    type="button"
                    onClick={() => {
                      setEditingPackageId(null);
                      setPackageForm({
                        name: "",
                        tests_count: "",
                        ideal_for: "",
                        report_time: "24 hours",
                        original_price_inr: "",
                        offer_price_inr: "",
                        display_order: "100",
                        is_active: true
                      });
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}

                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Package</th>
                        <th>Tests</th>
                        <th>Offer Price</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminPackages.map((item) => (
                        <tr key={`pkg-edit-${item.id}`}>
                          <td>{item.name}</td>
                          <td>{item.tests_count}</td>
                          <td>INR {item.offer_price_inr}</td>
                          <td>{Number(item.is_active) ? "Active" : "Inactive"}</td>
                          <td>
                            <button type="button" className="btn btn-alt" onClick={() => startEditPackage(item)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </form>
            ) : null}

            {adminToken && adminTab === "tests" ? (
              <form className="admin-panel" onSubmit={submitTestFromAdmin}>
                <div className="form-grid">
                  <div className="field">
                    <label>Test Name</label>
                    <input
                      value={testForm.name}
                      onChange={(e) => setTestForm((p) => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <input
                      value={testForm.category}
                      onChange={(e) => setTestForm((p) => ({ ...p, category: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Price (INR)</label>
                    <input
                      type="number"
                      min="1"
                      value={testForm.price_inr}
                      onChange={(e) => setTestForm((p) => ({ ...p, price_inr: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Display Order</label>
                    <input
                      type="number"
                      min="1"
                      value={testForm.display_order}
                      onChange={(e) => setTestForm((p) => ({ ...p, display_order: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field checkbox-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={testForm.fasting_required}
                        onChange={(e) => setTestForm((p) => ({ ...p, fasting_required: e.target.checked }))}
                      />
                      Fasting Required
                    </label>
                  </div>
                  <div className="field checkbox-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={testForm.is_active}
                        onChange={(e) => setTestForm((p) => ({ ...p, is_active: e.target.checked }))}
                      />
                      Active Test
                    </label>
                  </div>
                </div>
                <button className="btn btn-primary" type="submit" disabled={addingTest}>
                  {addingTest ? (editingTestId ? "Updating Test..." : "Adding Test...") : (editingTestId ? "Update Test" : "Add Test")}
                </button>
                {editingTestId ? (
                  <button
                    className="btn btn-alt"
                    type="button"
                    onClick={() => {
                      setEditingTestId(null);
                      setTestForm({
                        name: "",
                        category: "",
                        fasting_required: false,
                        price_inr: "",
                        display_order: "100",
                        is_active: true
                      });
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}

                <div className="table-wrap" style={{ marginTop: "14px" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Fasting</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminTests.map((item) => (
                        <tr key={`test-edit-${item.id}`}>
                          <td>{item.name}</td>
                          <td>{item.category}</td>
                          <td>INR {item.price_inr}</td>
                          <td>{Number(item.fasting_required) ? "Required" : "No"}</td>
                          <td>{Number(item.is_active) ? "Active" : "Inactive"}</td>
                          <td>
                            <button type="button" className="btn btn-alt" onClick={() => startEditTest(item)}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </form>
            ) : null}

            {adminToken && adminTab === "status" ? (
              <div className="admin-panel">
                {catalogLoading ? (
                  <p>Loading tests and packages...</p>
                ) : (
                  <div className="status-manage-grid">
                    <div className="status-card">
                      <h3>Tests Status</h3>
                      {adminTests.map((item) => (
                        <div className="status-row" key={`test-${item.id}`}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.category}</span>
                          </div>
                          <button
                            type="button"
                            className={`btn ${Number(item.is_active) ? "btn-primary" : "btn-alt"}`}
                            onClick={() => toggleCatalogStatus("test", item.id, !Number(item.is_active))}
                          >
                            {Number(item.is_active) ? "Active" : "Inactive"}
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="status-card">
                      <h3>Packages Status</h3>
                      {adminPackages.map((item) => (
                        <div className="status-row" key={`package-${item.id}`}>
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.tests_count} tests</span>
                          </div>
                          <button
                            type="button"
                            className={`btn ${Number(item.is_active) ? "btn-primary" : "btn-alt"}`}
                            onClick={() => toggleCatalogStatus("package", item.id, !Number(item.is_active))}
                          >
                            {Number(item.is_active) ? "Active" : "Inactive"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {adminStatus.message ? (
              <div className={`status ${adminStatus.type === "ok" ? "ok" : "err"}`}>{adminStatus.message}</div>
            ) : null}
          </div>
        </div>
      </section>
      )}

      {!isAdminPage && (
      <>

      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-card">
            <span className="hero-label">At-home diagnostics, done right</span>
            <h1>Home Sample Collection In 60 Minutes</h1>
            <p>
              Premium lab-grade diagnostics at your doorstep with trained phlebotomists, barcode
              sample tracking, and secure digital reports.
            </p>
            <div className="hero-badges">
              <span>4,000+ tests</span>
              <span>Same-day slot availability</span>
              <span>WhatsApp + Email reports</span>
            </div>
            <div className="hero-cta">
              <button className="btn btn-light">Explore Packages</button>
              <button className="btn btn-outline-light">Upload Prescription</button>
            </div>
          </div>

          <form className="quick-book" onSubmit={submitBooking} id="booking">
            <div className="book-head">
              <h3>Book Home Collection</h3>
              
              <span>Fast scheduling in under 2 mins</span>
            </div>

 
            <div className="form-grid">
              <div className="field">
                <label>Patient Name</label>
                <input
                  value={form.patient_name}
                  onChange={(e) => updateField("patient_name", e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="10-digit mobile"
                  required
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="name@email.com"
                  required
                />
              </div>
              <div className="field">
                <label>City</label>
                <input
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Delhi, Gurgaon, Noida..."
                  required
                />
              </div>
            </div>

            <div className="field">
              <label>Address</label>
              <textarea
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="House number, street, landmark"
                required
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Preferred Date</label>
                <input
                  type="date"
                  value={form.collection_date}
                  onChange={(e) => updateField("collection_date", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Time Slot</label>
                <select
                  value={form.collection_slot}
                  onChange={(e) => updateField("collection_slot", e.target.value)}
                  required
                >
                  <option>07:00 - 09:00</option>
                  <option>09:00 - 11:00</option>
                  <option>11:00 - 13:00</option>
                  <option>16:00 - 18:00</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Test / Package</label>
              <input
                value={form.selected_tests}
                onChange={(e) => updateField("selected_tests", e.target.value)}
                placeholder="CBC, Thyroid, Full Body Package..."
              />
            </div>

            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Confirm Collection"}
            </button>

            {status.message ? (
              <div className={`status ${status.type === "ok" ? "ok" : "err"}`}>{status.message}</div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="section" id="packages">
        <div className="container">
          <h2>Health Test Packages</h2>
          {loadingPackages ? (
            <p>Loading packages...</p>
          ) : packages.length ? (
            <div className="package-grid">
              {packages.map((pkg) => {
                const discount = Math.max(0, Number(pkg.original_price_inr) - Number(pkg.offer_price_inr));
                return (
                  <article className="package-card" key={pkg.id}>
                    <div className="package-top">
                      <span className="package-badge">{pkg.tests_count} Tests</span>
                      <span className="package-time">{pkg.report_time}</span>
                    </div>
                    <h4>{pkg.name}</h4>
                    <p>{pkg.ideal_for}</p>
                    <div className="package-price">
                      <strong>INR {pkg.offer_price_inr}</strong>
                      <del>INR {pkg.original_price_inr}</del>
                    </div>
                    <div className="package-save">Save INR {discount}</div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p>No packages available right now.</p>
          )}
        </div>
      </section>

      <section className="section" id="trust">
       
        <div className="container">
            <h2>Why Choose us..</h2>
          {loadingServices ? (
            <p>Loading services...</p>
          ) : services.length ? (
            <div className="feature-grid">
              {services.map((service) => (
                <article className="feature" key={service.id}>
                  <span className="feature-tag">{service.tag}</span>
                  <h4>{service.title}</h4>
                  <p>{service.description}</p>
                </article>
              ))}
            </div>
          ) : (
            <p>No services available right now.</p>
          )}
        </div>
      </section>

      <section className="section" id="tests">
        <div className="container">
          <div className="section-head">
            <h2>Popular Lab Tests</h2>
            <div className="search-field field">
              <label>Search Test</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="CBC, Thyroid, Vitamin..."
              />
            </div>
          </div>
          {loadingTests ? (
            <p>Loading test menu...</p>
          ) : (
            <div className="test-grid">
              {visibleTests.map((test) => (
                <article className="test-card" key={test.id}>
                  <div className="pill">{test.category || "General"}</div>
                  <h4>{test.name}</h4>
                  <div className="test-meta">
                    <span>{Number(test.fasting_required) ? "Fasting required" : "No fasting"}</span>
                  </div>
                  <div className="price">INR {test.price_inr}</div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="process">
        <div className="container">
          <h2>How Home Collection Works</h2>
          <div className="process-grid">
            <article className="process-step">
              <strong>01</strong>
              <h4>Book Test</h4>
              <p>Select test, preferred date, and slot in a minute.</p>
            </article>
            <article className="process-step">
              <strong>02</strong>
              <h4>Sample Pickup</h4>
              <p>Certified professional visits your address for collection.</p>
            </article>
            <article className="process-step">
              <strong>03</strong>
              <h4>Lab Processing</h4>
              <p>Automated analyzers run multi-level quality checks.</p>
            </article>
            <article className="process-step">
              <strong>04</strong>
              <h4>Digital Reports</h4>
              <p>Get secure reports on phone and email with doctor-ready format.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Why Patients Trust Us</h2>
          <div className="stat-grid">
            <div className="stat">
              <strong>10M+</strong>
              <span>Patients served</span>
            </div>
            <div className="stat">
              <strong>5,000+</strong>
              <span>Tests and panels</span>
            </div>
            <div className="stat">
              <strong>2,500+</strong>
              <span>Daily home collections</span>
            </div>
            <div className="stat">
              <strong>99.3%</strong>
              <span>On-time report delivery</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="container location-grid">
          <div className="location-card">
            <h2>Visit Our Collection Point</h2>
            <p className="location-line">
              Near Sweak Subha Hospital, Rishi Nagar Bus Stand, Hisar, Haryana 125001
            </p>
            <p className="location-sub">Home sample collection and booking assistance available here.</p>
          </div>
          <div className="map-wrap">
            <iframe
              title="Spyro Diagnostics Location"
              src="https://www.google.com/maps?q=Near%20Sweak%20Subha%20Hospital%20Rishi%20Nagar%20bus%20stand%20hisar%20Haryana%20125001&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-row">
          <span>Spyro Diagnostics</span>
          <span>Patient-first diagnostics and home sample collection</span>
        </div>
      </footer>
      </>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
