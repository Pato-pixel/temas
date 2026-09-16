import { useState, useEffect, useCallback, useRef } from "react";

const CATEGORY_COLORS = {
  "Teoría": "#3F6B64",
  "Práctica": "#9C3B3B",
  "Examen": "#7A5C2E",
  "Tarea": "#4A5B7A",
  "Otro": "#6B6459",
};

function colorFor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS["Otro"];
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
  );
}

async function api(path, { method = "GET", body, token, isForm } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de red");
  return data;
}

const EMPTY_FORM = { title: "", category: "Teoría", description: "", imageUrl: "" };
const TOKEN_KEY = "temas-profesor-token";

export default function App() {
  const [topics, setTopics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [hasPassword, setHasPassword] = useState(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [gateError, setGateError] = useState("");

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [changePwError, setChangePwError] = useState("");
  const [changePwSuccess, setChangePwSuccess] = useState(false);

  const isProfessor = !!token;

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/api/topics");
      setTopics(data);
    } catch (e) {
      setError("No se pudieron cargar los temas. ¿Está corriendo el backend?");
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
    api("/api/auth/status")
      .then((d) => setHasPassword(d.hasPassword))
      .catch(() => setHasPassword(null));
  }, [loadTopics]);

  const openGate = () => {
    setPwInput("");
    setPwConfirm("");
    setGateError("");
    setGateOpen(true);
  };

  const submitGate = async () => {
    setGateError("");
    try {
      if (!hasPassword) {
        if (pwInput.length < 6) return setGateError("La contraseña debe tener al menos 6 caracteres.");
        if (pwInput !== pwConfirm) return setGateError("Las dos contraseñas no coinciden.");
        const data = await api("/api/auth/setup", { method: "POST", body: { password: pwInput } });
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setHasPassword(true);
        setGateOpen(false);
      } else {
        const data = await api("/api/auth/login", { method: "POST", body: { password: pwInput } });
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setGateOpen(false);
      }
    } catch (e) {
      setGateError(e.message);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    cancel();
  };

  const openChangePw = () => {
    setNewPw("");
    setNewPwConfirm("");
    setChangePwError("");
    setChangePwSuccess(false);
    setChangePwOpen(true);
  };

  const submitChangePassword = async () => {
    setChangePwError("");
    if (newPw.length < 6) return setChangePwError("La contraseña nueva debe tener al menos 6 caracteres.");
    if (newPw !== newPwConfirm) return setChangePwError("Las dos contraseñas no coinciden.");
    try {
      await api("/api/auth/change-password", { method: "POST", body: { newPassword: newPw }, token });
      setChangePwSuccess(true);
      setNewPw("");
      setNewPwConfirm("");
    } catch (e) {
      if (e.message === "Sesión inválida o vencida") return logout();
      setChangePwError(e.message);
    }
  };

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAdding(true);
  };

  const startEdit = (t) => {
    setForm({ title: t.title, category: t.category, description: t.description, imageUrl: t.imageUrl || "" });
    setEditingId(t.id);
    setAdding(false);
  };

  const cancel = () => {
    setAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    if (!form.title.trim() || !token) return;
    setSaving(true);
    setError("");
    try {
      if (adding) {
        const entry = await api("/api/topics", { method: "POST", body: form, token });
        setTopics((prev) => [entry, ...(prev || [])]);
      } else if (editingId) {
        const updated = await api(`/api/topics/${editingId}`, { method: "PUT", body: form, token });
        setTopics((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      }
      cancel();
    } catch (e) {
      if (e.message === "Sesión inválida o vencida") logout();
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!token) return;
    if (!window.confirm("¿Borrar este tema? No se puede deshacer.")) return;
    setError("");
    try {
      await api(`/api/topics/${id}`, { method: "DELETE", token });
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  const isFormOpen = adding || !!editingId;

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .tp-btn { cursor: pointer; border: none; background: none; font-family: inherit; }
        .tp-btn:disabled { cursor: default; opacity: 0.6; }
        .tp-btn:focus-visible, .tp-input:focus-visible, textarea:focus-visible, select:focus-visible {
          outline: 2px solid #9C3B3B; outline-offset: 2px;
        }
        .tp-entry { transition: background-color 0.15s ease; }
        .tp-entry:hover { background-color: #F7F3EA; }
        .tp-actions { opacity: 0; transition: opacity 0.15s ease; }
        .tp-entry:hover .tp-actions, .tp-entry:focus-within .tp-actions { opacity: 1; }
        @media (max-width: 560px) { .tp-actions { opacity: 1; } }
        textarea { resize: vertical; }
        .tp-thumb { cursor: zoom-in; }
        body { background: #EDE8DE; }
      `}</style>

      <div style={styles.sheet}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <div>
              <p style={styles.eyebrow}>Cuaderno de clase</p>
              <h1 style={styles.h1}>Temas del profesor</h1>
            </div>
            {isProfessor ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="tp-btn" style={styles.profBadge} onClick={openChangePw}>
                  Cambiar contraseña
                </button>
                <button className="tp-btn" style={styles.profBadgeActive} onClick={logout}>
                  Modo profesor · Salir
                </button>
              </div>
            ) : (
              <button className="tp-btn" style={styles.profBadge} onClick={openGate}>
                Entrar como profesor
              </button>
            )}
          </div>
          <p style={styles.sub}>
            {isProfessor
              ? "Puedes agregar, editar o borrar temas. Los alumnos solo pueden verlos."
              : "Aquí verás los temas que publique el profesor, con imágenes cuando las incluya."}
          </p>
        </header>

        {gateOpen && (
          <div style={styles.gateBox}>
            <p style={styles.gateTitle}>
              {hasPassword ? "Ingresa la contraseña del profesor" : "Crea la contraseña del profesor"}
            </p>
            {!hasPassword && (
              <p style={styles.muted}>
                Todavía no existe. Se guarda de forma segura (con hash) en el servidor, no en el navegador.
              </p>
            )}
            <input
              className="tp-input"
              type="password"
              style={styles.gateInput}
              placeholder="Contraseña"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              autoFocus
            />
            {!hasPassword && (
              <input
                className="tp-input"
                type="password"
                style={styles.gateInput}
                placeholder="Confirma la contraseña"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
              />
            )}
            {gateError && <p style={styles.gateError}>{gateError}</p>}
            <div style={styles.formActions}>
              <button className="tp-btn" style={styles.saveBtn} onClick={submitGate}>
                {hasPassword ? "Entrar" : "Guardar y entrar"}
              </button>
              <button className="tp-btn" style={styles.cancelBtn} onClick={() => setGateOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {changePwOpen && (
          <div style={styles.gateBox}>
            <p style={styles.gateTitle}>Cambiar contraseña del profesor</p>
            {changePwSuccess ? (
              <>
                <p style={styles.muted}>Listo, la contraseña quedó actualizada.</p>
                <div style={styles.formActions}>
                  <button className="tp-btn" style={styles.cancelBtn} onClick={() => setChangePwOpen(false)}>
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <input
                  className="tp-input"
                  type="password"
                  style={styles.gateInput}
                  placeholder="Nueva contraseña"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoFocus
                />
                <input
                  className="tp-input"
                  type="password"
                  style={styles.gateInput}
                  placeholder="Confirma la nueva contraseña"
                  value={newPwConfirm}
                  onChange={(e) => setNewPwConfirm(e.target.value)}
                />
                {changePwError && <p style={styles.gateError}>{changePwError}</p>}
                <div style={styles.formActions}>
                  <button className="tp-btn" style={styles.saveBtn} onClick={submitChangePassword}>
                    Guardar nueva contraseña
                  </button>
                  <button className="tp-btn" style={styles.cancelBtn} onClick={() => setChangePwOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.list}>
          {loading && <p style={styles.muted}>Cargando temas…</p>}

          {!loading && topics && topics.length === 0 && !isFormOpen && (
            <div style={styles.empty}>
              <p style={styles.emptyTitle}>Todavía no hay temas.</p>
              <p style={styles.muted}>
                {isProfessor ? "Agrega el primero para empezar el cuaderno de la clase." : "El profesor aún no ha publicado nada."}
              </p>
            </div>
          )}

          {!loading &&
            topics &&
            topics.map((t) => (
              <div key={t.id} style={styles.entry} className="tp-entry">
                <div style={{ ...styles.tab, backgroundColor: colorFor(t.category) }} />
                {editingId === t.id ? (
                  <EditForm form={form} setForm={setForm} onSave={save} onCancel={cancel} saving={saving} token={token} setError={setError} />
                ) : (
                  <div style={styles.entryBody}>
                    <div style={styles.entryTop}>
                      <h2 style={styles.entryTitle}>{t.title}</h2>
                      <span style={{ ...styles.catLabel, color: colorFor(t.category) }}>{t.category}</span>
                    </div>
                    {t.description && <p style={styles.entryDesc}>{t.description}</p>}
                    {t.imageUrl && (
                      <img
                        src={t.imageUrl}
                        alt={t.title}
                        className="tp-thumb"
                        style={styles.thumb}
                        onClick={() => setLightbox(t.imageUrl)}
                      />
                    )}
                    <div style={styles.entryFooter}>
                      <span style={styles.meta}>
                        {t.updatedBy} · {formatDate(t.updatedAt)}
                      </span>
                      {isProfessor && (
                        <span className="tp-actions" style={styles.actions}>
                          <button className="tp-btn" style={styles.linkBtn} onClick={() => startEdit(t)}>
                            Editar
                          </button>
                          <button className="tp-btn" style={{ ...styles.linkBtn, color: "#9C3B3B" }} onClick={() => remove(t.id)}>
                            Borrar
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

          {adding && (
            <div style={styles.entry}>
              <div style={{ ...styles.tab, backgroundColor: colorFor(form.category) }} />
              <EditForm form={form} setForm={setForm} onSave={save} onCancel={cancel} saving={saving} isNew token={token} setError={setError} />
            </div>
          )}
        </div>

        {isProfessor && !isFormOpen && (
          <button className="tp-btn" style={styles.addLine} onClick={startAdd}>
            + Agregar tema
          </button>
        )}
      </div>

      {lightbox && (
        <div style={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={styles.lightboxImg} />
        </div>
      )}
    </div>
  );
}

function EditForm({ form, setForm, onSave, onCancel, saving, isNew, token, setError }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      const data = await api("/api/upload", { method: "POST", body, token, isForm: true });
      setForm((f) => ({ ...f, imageUrl: data.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={styles.entryBody}>
      <input
        className="tp-input"
        style={styles.titleInput}
        placeholder="Título del tema"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        autoFocus
        maxLength={120}
      />
      <select style={styles.select} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
        {Object.keys(CATEGORY_COLORS).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        style={styles.textarea}
        placeholder="Descripción, notas o instrucciones (opcional)"
        rows={3}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        maxLength={2000}
      />

      <div style={styles.imageRow}>
        <input
          className="tp-input"
          style={styles.urlInput}
          placeholder="Pega un enlace de imagen (opcional)"
          value={form.imageUrl && form.imageUrl.startsWith("/uploads/") ? "" : form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
        />
        <label style={styles.uploadBtn}>
          {uploading ? "Subiendo…" : "Subir imagen"}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} disabled={uploading} />
        </label>
      </div>
      {form.imageUrl && (
        <div style={styles.previewWrap}>
          <img src={form.imageUrl} alt="Vista previa" style={styles.previewImg} />
          <button className="tp-btn" style={styles.removeImgBtn} onClick={() => setForm({ ...form, imageUrl: "" })}>
            Quitar imagen
          </button>
        </div>
      )}

      <div style={styles.formActions}>
        <button className="tp-btn" style={styles.saveBtn} onClick={onSave} disabled={saving || uploading || !form.title.trim()}>
          {saving ? "Guardando…" : isNew ? "Agregar tema" : "Guardar cambios"}
        </button>
        <button className="tp-btn" style={styles.cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#EDE8DE", fontFamily: "'Inter', sans-serif", color: "#2B2620", padding: "32px 16px 64px" },
  sheet: { maxWidth: 720, margin: "0 auto" },
  header: { marginBottom: 20 },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  eyebrow: { margin: 0, fontSize: 13, color: "#7A5C2E", fontWeight: 600 },
  h1: { fontFamily: "'Source Serif 4', serif", fontWeight: 700, fontSize: 34, margin: "4px 0 0", letterSpacing: "-0.01em" },
  sub: { margin: "10px 0 0", fontSize: 15, lineHeight: 1.5, color: "#5B5347", maxWidth: 480 },
  profBadge: { fontSize: 13, fontWeight: 600, color: "#5B5347", border: "1px solid #C9C2B4", borderRadius: 4, padding: "7px 12px", whiteSpace: "nowrap" },
  profBadgeActive: { fontSize: 13, fontWeight: 600, color: "#fff", background: "#3F6B64", borderRadius: 4, padding: "7px 12px", whiteSpace: "nowrap" },
  gateBox: { background: "#F7F3EA", border: "1px solid #D8CFBE", borderRadius: 6, padding: "16px 18px", marginBottom: 20 },
  gateTitle: { fontFamily: "'Source Serif 4', serif", fontSize: 17, fontWeight: 600, margin: "0 0 6px" },
  gateInput: { display: "block", width: "100%", maxWidth: 260, fontFamily: "inherit", fontSize: 14, padding: "7px 10px", border: "1px solid #C9C2B4", borderRadius: 4, marginTop: 8, background: "#fff" },
  gateError: { color: "#9C3B3B", fontSize: 13, margin: "8px 0 0" },
  errorBox: { background: "#F5E3E3", color: "#7A2E2E", padding: "10px 14px", borderRadius: 4, fontSize: 14, marginBottom: 16 },
  list: { display: "flex", flexDirection: "column" },
  muted: { color: "#8A8172", fontSize: 14 },
  empty: { padding: "24px 0" },
  emptyTitle: { fontFamily: "'Source Serif 4', serif", fontSize: 18, margin: "0 0 4px" },
  entry: { display: "flex", borderBottom: "1px solid #D8CFBE", padding: "18px 12px 18px 0", gap: 14 },
  tab: { width: 4, borderRadius: 2, flexShrink: 0 },
  entryBody: { flex: 1, minWidth: 0 },
  entryTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  entryTitle: { fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 20, margin: 0 },
  catLabel: { fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" },
  entryDesc: { margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.55, color: "#4A4436" },
  thumb: { display: "block", marginTop: 12, maxWidth: "100%", maxHeight: 280, borderRadius: 4, border: "1px solid #D8CFBE", objectFit: "cover" },
  entryFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 8 },
  meta: { fontSize: 12.5, color: "#8A8172" },
  actions: { display: "flex", gap: 14 },
  linkBtn: { fontSize: 13, fontWeight: 600, color: "#3F6B64", padding: 0 },
  addLine: { marginTop: 20, fontFamily: "'Source Serif 4', serif", fontSize: 16, fontWeight: 600, color: "#9C3B3B", padding: "10px 0" },
  titleInput: { width: "100%", fontFamily: "'Source Serif 4', serif", fontWeight: 600, fontSize: 19, padding: "6px 0", border: "none", borderBottom: "1px solid #C9C2B4", background: "transparent", marginBottom: 10 },
  select: { fontFamily: "inherit", fontSize: 13.5, padding: "5px 8px", border: "1px solid #C9C2B4", borderRadius: 4, background: "#F7F3EA", marginBottom: 10 },
  textarea: { width: "100%", fontFamily: "inherit", fontSize: 14.5, lineHeight: 1.5, padding: "8px 10px", border: "1px solid #C9C2B4", borderRadius: 4, background: "#F7F3EA", color: "#2B2620" },
  imageRow: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  urlInput: { flex: 1, minWidth: 180, fontFamily: "inherit", fontSize: 13.5, padding: "7px 10px", border: "1px solid #C9C2B4", borderRadius: 4, background: "#F7F3EA" },
  uploadBtn: { fontSize: 13, fontWeight: 600, color: "#5B5347", border: "1px solid #C9C2B4", borderRadius: 4, padding: "7px 12px", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" },
  previewWrap: { marginTop: 10, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  previewImg: { maxWidth: 160, maxHeight: 100, borderRadius: 4, border: "1px solid #D8CFBE", objectFit: "cover" },
  removeImgBtn: { fontSize: 13, fontWeight: 600, color: "#9C3B3B" },
  formActions: { display: "flex", gap: 12, marginTop: 12 },
  saveBtn: { fontSize: 14, fontWeight: 600, color: "#fff", background: "#9C3B3B", padding: "8px 16px", borderRadius: 4 },
  cancelBtn: { fontSize: 14, fontWeight: 600, color: "#5B5347", padding: "8px 16px" },
  lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(30, 26, 20, 0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out", zIndex: 50 },
  lightboxImg: { maxWidth: "100%", maxHeight: "100%", borderRadius: 4 },
};
