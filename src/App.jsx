import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

const COLORS = ["#2563eb", "#0f172a", "#38bdf8", "#64748b", "#0ea5e9"];

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState("lancamento");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroConfig, setErroConfig] = useState("");
  const [fotoInputKey, setFotoInputKey] = useState(Date.now());

  const [form, setForm] = useState({
    material: "Quadro de topo",
    cliente: "",
    data: "",
    quantidade: "",
    foto: null,
  });

  const [filtros, setFiltros] = useState({
    dataInicial: "",
    dataFinal: "",
    cliente: "",
    material: "Todos",
  });

  async function carregarDados() {
    if (!supabase) {
      setErroConfig(
        "Supabase não configurado. Verifique o arquivo .env e reinicie o npm run dev."
      );
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase
      .from("recebimentos")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      alert("Erro ao carregar dados: " + error.message);
    } else {
      setDados(data || []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function salvar(e) {
    e.preventDefault();

    if (!supabase) {
      alert("Supabase não configurado.");
      return;
    }

    if (!form.cliente || !form.data || !form.quantidade) {
      alert("Preencha cliente, data e quantidade.");
      return;
    }

    setSalvando(true);

    let fotoUrl = null;

    try {
      if (form.foto) {
        const extensao = form.foto.name?.split(".").pop() || "jpg";
        const nomeArquivo = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${extensao}`;

        const { error: uploadError } = await supabase.storage
          .from("recebimentos")
          .upload(nomeArquivo, form.foto, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          alert("Erro ao subir foto: " + uploadError.message);
          setSalvando(false);
          return;
        }

        const { data: fotoData } = supabase.storage
          .from("recebimentos")
          .getPublicUrl(nomeArquivo);

        fotoUrl = fotoData.publicUrl;
      }

      const { error } = await supabase.from("recebimentos").insert([
        {
          material: form.material,
          cliente: form.cliente,
          data: form.data,
          quantidade: Number(form.quantidade),
          foto_url: fotoUrl,
        },
      ]);

      if (error) {
        alert("Erro ao salvar: " + error.message);
        setSalvando(false);
        return;
      }

      setForm({
        material: "Quadro de topo",
        cliente: "",
        data: "",
        quantidade: "",
        foto: null,
      });

      setFotoInputKey(Date.now());
      await carregarDados();
      setAbaAtiva("registros");
      alert("Recebimento salvo com sucesso.");
    } finally {
      setSalvando(false);
    }
  }

  function exportarExcel() {
    const dadosFormatados = dadosFiltrados.map((item) => ({
      Material: item.material,
      Cliente: item.cliente,
      Data: item.data,
      Quantidade: item.quantidade || "",
      "Foto URL": item.foto_url || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recebimentos");
    XLSX.writeFile(wb, "recebimentos.xlsx");
  }

  const clientesUnicos = useMemo(() => {
    return [...new Set(dados.map((item) => item.cliente).filter(Boolean))].sort();
  }, [dados]);

  const dadosFiltrados = useMemo(() => {
    return dados.filter((item) => {
      const passouDataInicial = filtros.dataInicial
        ? item.data >= filtros.dataInicial
        : true;

      const passouDataFinal = filtros.dataFinal
        ? item.data <= filtros.dataFinal
        : true;

      const passouCliente = filtros.cliente
        ? item.cliente?.toLowerCase().includes(filtros.cliente.toLowerCase())
        : true;

      const passouMaterial =
        filtros.material === "Todos"
          ? true
          : item.material === filtros.material;

      return (
        passouDataInicial &&
        passouDataFinal &&
        passouCliente &&
        passouMaterial
      );
    });
  }, [dados, filtros]);

  const indicadores = useMemo(() => {
    const totalRegistros = dadosFiltrados.length;
    const totalQuantidade = dadosFiltrados.reduce(
      (acc, item) => acc + (Number(item.quantidade) || 0),
      0
    );
    const totalClientes = new Set(
      dadosFiltrados.map((item) => item.cliente)
    ).size;

    const quadroTopo = dadosFiltrados
      .filter((item) => item.material === "Quadro de topo")
      .reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

    const palletPlastico = dadosFiltrados
      .filter((item) => item.material === "Pallet de plástico")
      .reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);

    return {
      totalRegistros,
      totalQuantidade,
      totalClientes,
      quadroTopo,
      palletPlastico,
    };
  }, [dadosFiltrados]);

  const graficoMateriais = useMemo(() => {
    return [
      {
        nome: "Quadro de topo",
        quantidade: dadosFiltrados
          .filter((item) => item.material === "Quadro de topo")
          .reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0),
      },
      {
        nome: "Pallet de plástico",
        quantidade: dadosFiltrados
          .filter((item) => item.material === "Pallet de plástico")
          .reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0),
      },
    ];
  }, [dadosFiltrados]);

  const graficoClientes = useMemo(() => {
    const mapa = {};

    dadosFiltrados.forEach((item) => {
      const cliente = item.cliente || "Sem cliente";
      mapa[cliente] = (mapa[cliente] || 0) + (Number(item.quantidade) || 0);
    });

    return Object.entries(mapa)
      .map(([cliente, quantidade]) => ({ cliente, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [dadosFiltrados]);

  const graficoPorData = useMemo(() => {
    const mapa = {};

    dadosFiltrados.forEach((item) => {
      const data = item.data || "Sem data";
      mapa[data] = (mapa[data] || 0) + (Number(item.quantidade) || 0);
    });

    return Object.entries(mapa)
      .map(([data, quantidade]) => ({ data, quantidade }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [dadosFiltrados]);

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; }
        input, select, button, textarea {
          font: inherit;
        }
        input::placeholder {
          color: #94a3b8;
          opacity: 1;
        }
        input, select {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        input[type="date"] {
          color: #0f172a !important;
        }
        @media (max-width: 768px) {
          .app-header {
            padding: 18px;
          }
          .app-header-left {
            flex-direction: column;
            align-items: flex-start;
          }
          .app-logo-box {
            width: 84px !important;
            height: 84px !important;
            border-radius: 18px !important;
          }
          .app-title {
            font-size: 28px !important;
            line-height: 1.08 !important;
          }
          .app-subtitle {
            font-size: 14px !important;
            line-height: 1.45 !important;
          }
          .app-export {
            width: 100%;
            justify-content: center;
          }
          .app-tabs {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px !important;
          }
          .app-tab-btn {
            width: 100%;
            text-align: center;
            padding: 12px 8px !important;
            font-size: 14px !important;
          }
          .app-card {
            padding: 18px !important;
            border-radius: 22px !important;
          }
          .app-section-title {
            font-size: 22px !important;
            text-align: center;
          }
          .app-form-grid,
          .app-filters-grid,
          .app-kpi-grid,
          .app-chart-grid {
            grid-template-columns: 1fr !important;
          }
          .app-label {
            font-size: 14px !important;
          }
          .app-input,
          .app-file-input {
            min-height: 52px;
            padding: 14px 16px !important;
            font-size: 16px !important;
            border-radius: 16px !important;
          }
          .app-save-btn {
            width: 100%;
            justify-content: center;
          }
          .app-preview {
            width: 100% !important;
            max-width: 260px;
            height: 220px !important;
          }
          .app-chart-box {
            height: 260px !important;
          }
          .app-kpi-value {
            font-size: 30px !important;
          }
        }
      `}</style>

      <div style={styles.container}>
        <header className="app-header" style={styles.header}>
          <div className="app-header-left" style={styles.headerLeft}>
            <div className="app-logo-box" style={styles.logoBox}>
              <img src="/ball-logo.png" alt="Logo Ball" style={styles.logo} />
            </div>

            <div>
              <h1 className="app-title" style={styles.title}>
                Recebimento de Material de Embalagem
              </h1>
              <p className="app-subtitle" style={styles.subtitle}>
                Controle de entrada de quadro de topo e pallet de plástico
              </p>
            </div>
          </div>

          <button
            className="app-export"
            onClick={exportarExcel}
            style={styles.exportButton}
          >
            Exportar Excel
          </button>
        </header>

        {erroConfig && <div style={styles.errorBox}>{erroConfig}</div>}

        <div className="app-tabs" style={styles.tabs}>
          <button
            className="app-tab-btn"
            onClick={() => setAbaAtiva("lancamento")}
            style={abaAtiva === "lancamento" ? styles.tabActive : styles.tab}
          >
            Lançamento
          </button>
          <button
            className="app-tab-btn"
            onClick={() => setAbaAtiva("registros")}
            style={abaAtiva === "registros" ? styles.tabActive : styles.tab}
          >
            Registros
          </button>
          <button
            className="app-tab-btn"
            onClick={() => setAbaAtiva("dashboard")}
            style={abaAtiva === "dashboard" ? styles.tabActive : styles.tab}
          >
            Dashboard
          </button>
        </div>

        {abaAtiva === "lancamento" && (
          <div className="app-card" style={styles.card}>
            <h2 className="app-section-title" style={styles.sectionTitle}>
              Novo recebimento
            </h2>

            <form className="app-form-grid" onSubmit={salvar} style={styles.formGrid}>
              <div>
                <label className="app-label" style={styles.label}>Material</label>
                <select
                  value={form.material}
                  onChange={(e) => setForm({ ...form, material: e.target.value })}
                  style={styles.input}
                  className="app-input"
                >
                  <option>Quadro de topo</option>
                  <option>Pallet de plástico</option>
                </select>
              </div>

              <div>
                <label className="app-label" style={styles.label}>Cliente</label>
                <input
                  placeholder="Digite o cliente"
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                  style={styles.input}
                  className="app-input"
                />
              </div>

              <div>
                <label className="app-label" style={styles.label}>Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  style={styles.input}
                  className="app-input"
                />
              </div>

              <div>
                <label className="app-label" style={styles.label}>Quantidade</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Quantidade"
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                  style={styles.input}
                  className="app-input"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="app-label" style={styles.label}>Foto do recebimento</label>
                <input
                  key={fotoInputKey}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) =>
                    setForm({ ...form, foto: e.target.files?.[0] || null })
                  }
                  style={styles.fileInput}
                  className="app-file-input"
                />
                <div style={styles.helperText}>
                  No celular, esse campo tende a abrir a câmera.
                </div>
              </div>

              {form.foto && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="app-label" style={styles.label}>Pré-visualização</label>
                  <img
                    src={URL.createObjectURL(form.foto)}
                    alt="Prévia"
                    style={styles.previewImage}
                    className="app-preview"
                  />
                </div>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  type="submit"
                  disabled={salvando}
                  style={styles.saveButton}
                  className="app-save-btn"
                >
                  {salvando ? "Salvando..." : "Salvar recebimento"}
                </button>
              </div>
            </form>
          </div>
        )}

        {abaAtiva === "registros" && (
          <div className="app-card" style={styles.card}>
            <h2 className="app-section-title" style={styles.sectionTitle}>Registros</h2>

            {carregando ? (
              <p>Carregando dados...</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Material</th>
                      <th style={styles.th}>Cliente</th>
                      <th style={styles.th}>Data</th>
                      <th style={styles.th}>Quantidade</th>
                      <th style={styles.th}>Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={styles.tdCenter}>
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : (
                      dados.map((d) => (
                        <tr key={d.id}>
                          <td style={styles.td}>{d.material}</td>
                          <td style={styles.td}>{d.cliente}</td>
                          <td style={styles.td}>{d.data}</td>
                          <td style={styles.td}>{d.quantidade || ""}</td>
                          <td style={styles.td}>
                            {d.foto_url ? (
                              <a href={d.foto_url} target="_blank" rel="noreferrer">
                                <img
                                  src={d.foto_url}
                                  alt="Foto do recebimento"
                                  style={styles.tableImage}
                                />
                              </a>
                            ) : (
                              "Sem foto"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {abaAtiva === "dashboard" && (
          <>
            <div className="app-card" style={styles.card}>
              <h2 className="app-section-title" style={styles.sectionTitle}>
                Filtros do dashboard
              </h2>

              <div className="app-filters-grid" style={styles.filtersGrid}>
                <div>
                  <label className="app-label" style={styles.label}>Data inicial</label>
                  <input
                    type="date"
                    value={filtros.dataInicial}
                    onChange={(e) =>
                      setFiltros({ ...filtros, dataInicial: e.target.value })
                    }
                    style={styles.input}
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="app-label" style={styles.label}>Data final</label>
                  <input
                    type="date"
                    value={filtros.dataFinal}
                    onChange={(e) =>
                      setFiltros({ ...filtros, dataFinal: e.target.value })
                    }
                    style={styles.input}
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="app-label" style={styles.label}>Cliente</label>
                  <input
                    list="clientes-list"
                    placeholder="Filtrar cliente"
                    value={filtros.cliente}
                    onChange={(e) =>
                      setFiltros({ ...filtros, cliente: e.target.value })
                    }
                    style={styles.input}
                    className="app-input"
                  />
                  <datalist id="clientes-list">
                    {clientesUnicos.map((cliente) => (
                      <option key={cliente} value={cliente} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="app-label" style={styles.label}>Material</label>
                  <select
                    value={filtros.material}
                    onChange={(e) =>
                      setFiltros({ ...filtros, material: e.target.value })
                    }
                    style={styles.input}
                    className="app-input"
                  >
                    <option>Todos</option>
                    <option>Quadro de topo</option>
                    <option>Pallet de plástico</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="app-kpi-grid" style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Total de registros</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.totalRegistros}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Quantidade total</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.totalQuantidade}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Clientes únicos</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.totalClientes}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Quadro de topo</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.quadroTopo}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Pallet de plástico</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.palletPlastico}
                </div>
              </div>
            </div>

            <div className="app-chart-grid" style={styles.chartGrid}>
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Quantidade por material</h3>
                <div className="app-chart-box" style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoMateriais}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="quantidade" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Distribuição por material</h3>
                <div className="app-chart-box" style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graficoMateriais}
                        dataKey="quantidade"
                        nameKey="nome"
                        outerRadius={100}
                        label
                      >
                        {graficoMateriais.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Clientes</h3>
                <div className="app-chart-box" style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoClientes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cliente" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="quantidade" fill="#0f172a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Evolução por data</h3>
                <div className="app-chart-box" style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graficoPorData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="data" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="quantidade"
                        stroke="#2563eb"
                        strokeWidth={3}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #eef4ff 0%, #f8fbff 45%, #f2f5f9 100%)",
    padding: "14px",
    fontFamily: "Inter, Arial, sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: "1300px",
    margin: "0 auto",
  },
  header: {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    border: "1px solid #dbe7ff",
    borderRadius: "24px",
    padding: "22px 24px",
    boxShadow: "0 18px 40px rgba(37,99,235,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },
  logoBox: {
    width: "110px",
    height: "110px",
    borderRadius: "22px",
    background: "#0f172a",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 10px 30px rgba(15,23,42,0.20)",
    padding: "16px",
    flexShrink: 0,
  },
  logo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  title: {
    margin: 0,
    fontSize: "38px",
    fontWeight: 800,
    lineHeight: 1.08,
    color: "#0f172a",
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "#475569",
    fontSize: "15px",
  },
  exportButton: {
    background: "linear-gradient(135deg, #2563eb, #0f172a)",
    color: "#fff",
    border: "none",
    borderRadius: "16px",
    padding: "14px 20px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37,99,235,0.20)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: "14px 16px",
    borderRadius: "14px",
    marginBottom: "16px",
    fontWeight: 600,
  },
  tabs: {
    display: "flex",
    gap: "10px",
    marginBottom: "18px",
    flexWrap: "wrap",
  },
  tab: {
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #dbe7ff",
    borderRadius: "16px",
    padding: "13px 18px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(15,23,42,0.04)",
  },
  tabActive: {
    background: "linear-gradient(135deg, #2563eb, #0f172a)",
    color: "#fff",
    border: "1px solid #2563eb",
    borderRadius: "16px",
    padding: "13px 18px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37,99,235,0.22)",
  },
  card: {
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(10px)",
    border: "1px solid #dbe7ff",
    borderRadius: "24px",
    padding: "22px",
    boxShadow: "0 18px 40px rgba(37,99,235,0.06)",
    marginBottom: "18px",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "24px",
    fontWeight: 800,
    color: "#0f172a",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: 700,
    color: "#334155",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1.5px solid #cbd5e1",
    background: "#ffffff",
    outline: "none",
    fontSize: "16px",
    boxSizing: "border-box",
    minHeight: "52px",
    appearance: "none",
  },
  fileInput: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1.5px solid #cbd5e1",
    background: "#ffffff",
    boxSizing: "border-box",
    minHeight: "52px",
  },
  helperText: {
    marginTop: "8px",
    fontSize: "13px",
    color: "#64748b",
  },
  previewImage: {
    width: "220px",
    height: "220px",
    objectFit: "cover",
    borderRadius: "18px",
    border: "1px solid #cbd5e1",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
  },
  saveButton: {
    background: "linear-gradient(135deg, #2563eb, #0f172a)",
    color: "#fff",
    border: "none",
    borderRadius: "16px",
    padding: "15px 20px",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(37,99,235,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#fff",
    borderRadius: "18px",
    overflow: "hidden",
  },
  th: {
    background: "#eaf1ff",
    color: "#0f172a",
    textAlign: "left",
    padding: "14px",
    fontSize: "14px",
    fontWeight: 800,
    borderBottom: "1px solid #dbe7ff",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #eef2f7",
    color: "#334155",
    fontSize: "14px",
  },
  tdCenter: {
    padding: "18px",
    textAlign: "center",
    color: "#64748b",
  },
  tableImage: {
    width: "72px",
    height: "72px",
    objectFit: "cover",
    borderRadius: "14px",
    boxShadow: "0 8px 18px rgba(15,23,42,0.10)",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "18px",
  },
  kpiCard: {
    background: "linear-gradient(180deg, #ffffff, #f8fbff)",
    border: "1px solid #dbe7ff",
    borderRadius: "22px",
    padding: "20px",
    boxShadow: "0 16px 30px rgba(37,99,235,0.07)",
  },
  kpiLabel: {
    color: "#64748b",
    fontSize: "14px",
    marginBottom: "10px",
    fontWeight: 700,
  },
  kpiValue: {
    color: "#0f172a",
    fontSize: "34px",
    fontWeight: 800,
    lineHeight: 1,
  },
  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: "20px",
  },
  chartCard: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #dbe7ff",
    borderRadius: "24px",
    padding: "20px",
    boxShadow: "0 18px 36px rgba(37,99,235,0.06)",
  },
  chartTitle: {
    marginTop: 0,
    marginBottom: "16px",
    fontSize: "18px",
    fontWeight: 800,
    color: "#0f172a",
  },
  chartBox: {
    width: "100%",
    height: "300px",
  },
};