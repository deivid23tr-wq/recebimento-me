import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const CLIENTES_FIXOS = [
  "INSP. FINAL",
  "AB PIRAÍ",
  "AB JUATUBA (AB MINAS)",
  "AB SETE LAGOAS (AB N MINAS)",
  "AB MACACU",
  "AB RIO (NOVA RIO)",
  "CC ITABIRITO (SPAL IND.)",
  "CC RJ (ANDINA / JPA)",
  "HNK ITU",
  "NEW AGE",
  "CC MARÍLIA",
  "INAB TOLEDO",
  "POTY",
  "CC DUQUE DE CAXIAS",
  "BALL JACAREÍ",
  "BALL EXTREMA",
  "BALL ÁGUAS CLARAS",
  "BALL FRUTAL",
  "BALL POUSO ALEGRE",
  "BALL RECIFE",
  "BALL BRASÍLIA",
  "AB AGUDOS",
  "AB ANÁPOLIS",
  "AB CERPA",
  "AB COLORADO",
  "AB GUARULHOS",
  "AB JACAREÍ",
  "AB JAGUARIÚNA",
  "AB LAGES",
  "AB PONTA GROSSA",
  "AB RIBEIRÃO",
  "CC CAMPO GRANDE",
  "CC DIXER",
  "CC MS",
  "CC RIBEIRÃO",
  "CC SANTA MARIA",
  "CC CVI",
  "CC VARZEA",
  "CERVAM",
  "HNK JACAREÍ",
  "NOVA MALTA",
];

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState("lancamento");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroConfig, setErroConfig] = useState("");
  const [fotoInputKey, setFotoInputKey] = useState(Date.now());

  // CORREÇÃO 3: ref para controlar a object URL da pré-visualização e poder revogá-la
  const previewUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [form, setForm] = useState({
    material: "Quadro de topo",
    cliente: "",
    data: "",
    quantidadeRecebida: "",
    quantidadeQuebrada: "",
    observacaoAvaria: "",
    foto: null,
  });

  const [filtros, setFiltros] = useState({
    dataInicial: "",
    dataFinal: "",
    cliente: "",
    material: "Todos",
  });

  // CORREÇÃO 1: useCallback para estabilizar a referência e evitar re-execuções desnecessárias do useEffect
  const carregarDados = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // CORREÇÃO 3: helper para atualizar a foto e gerenciar o ciclo de vida da object URL
  function atualizarFoto(arquivo) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (arquivo) {
      const url = URL.createObjectURL(arquivo);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
    setForm((prev) => ({ ...prev, foto: arquivo || null }));
  }

  // CORREÇÃO 3: revogar a URL ao desmontar o componente
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const quantidadeBoaAtual = useMemo(() => {
    const recebida = Number(form.quantidadeRecebida) || 0;
    const quebrada = Number(form.quantidadeQuebrada) || 0;
    const boa = recebida - quebrada;
    return boa >= 0 ? boa : 0;
  }, [form.quantidadeRecebida, form.quantidadeQuebrada]);

  async function salvar(e) {
    e.preventDefault();

    if (!supabase) {
      alert("Supabase não configurado.");
      return;
    }

    const recebida = Number(form.quantidadeRecebida);
    const quebrada = Number(form.quantidadeQuebrada || 0);

    if (!form.cliente || !form.data || !form.quantidadeRecebida) {
      alert("Preencha cliente, data e quantidade recebida.");
      return;
    }

    if (recebida <= 0) {
      alert("A quantidade recebida deve ser maior que zero.");
      return;
    }

    if (quebrada < 0) {
      alert("A quantidade quebrada não pode ser negativa.");
      return;
    }

    if (quebrada > recebida) {
      alert("A quantidade quebrada não pode ser maior que a recebida.");
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
          quantidade_recebida: recebida,
          quantidade_quebrada: quebrada,
          observacao_avaria: form.observacaoAvaria || null,
          foto_url: fotoUrl,
        },
      ]);

      if (error) {
        alert("Erro ao salvar: " + error.message);
        setSalvando(false);
        return;
      }

      // CORREÇÃO 3: limpar a object URL ao resetar o formulário
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewUrl(null);

      setForm({
        material: "Quadro de topo",
        cliente: "",
        data: "",
        quantidadeRecebida: "",
        quantidadeQuebrada: "",
        observacaoAvaria: "",
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

  const dadosFiltrados = useMemo(() => {
    return dados.filter((item) => {
      const passouDataInicial = filtros.dataInicial
        ? item.data >= filtros.dataInicial
        : true;

      const passouDataFinal = filtros.dataFinal
        ? item.data <= filtros.dataFinal
        : true;

      const passouCliente = filtros.cliente
        ? item.cliente === filtros.cliente
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

  // CORREÇÃO 5: aviso claro sobre o que será exportado
  function exportarExcel() {
    const totalFiltrado = dadosFiltrados.length;
    const totalGeral = dados.length;
    const msg =
      totalFiltrado < totalGeral
        ? `Exportando ${totalFiltrado} registro(s) filtrado(s) de ${totalGeral} no total. Deseja continuar?`
        : `Exportando todos os ${totalGeral} registro(s). Deseja continuar?`;

    if (!window.confirm(msg)) return;

    const dadosFormatados = dadosFiltrados.map((item) => {
      const recebida = Number(item.quantidade_recebida) || 0;
      const quebrada = Number(item.quantidade_quebrada) || 0;
      const boa = recebida - quebrada;

      return {
        Material: item.material,
        Cliente: item.cliente,
        Data: item.data,
        "Qtd Recebida": recebida,
        "Qtd Quebrada": quebrada,
        "Qtd Boa": boa,
        "Observação Avaria": item.observacao_avaria || "",
        "Foto URL": item.foto_url || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recebimentos");
    XLSX.writeFile(wb, "recebimentos.xlsx");
  }

  const clientesUnicos = useMemo(() => {
    return [...new Set(dados.map((item) => item.cliente).filter(Boolean))].sort();
  }, [dados]);

  const indicadores = useMemo(() => {
    const totalRegistros = dadosFiltrados.length;

    const totalRecebido = dadosFiltrados.reduce(
      (acc, item) => acc + (Number(item.quantidade_recebida) || 0),
      0
    );

    const totalQuebrado = dadosFiltrados.reduce(
      (acc, item) => acc + (Number(item.quantidade_quebrada) || 0),
      0
    );

    const totalBom = totalRecebido - totalQuebrado;

    const totalClientes = new Set(
      dadosFiltrados.map((item) => item.cliente)
    ).size;

    const percentualQuebra =
      totalRecebido > 0 ? ((totalQuebrado / totalRecebido) * 100).toFixed(1) : "0.0";

    return {
      totalRegistros,
      totalRecebido,
      totalQuebrado,
      totalBom,
      totalClientes,
      percentualQuebra,
    };
  }, [dadosFiltrados]);

  const graficoMateriais = useMemo(() => {
    return [
      {
        nome: "Quadro de topo",
        recebida: dadosFiltrados
          .filter((item) => item.material === "Quadro de topo")
          .reduce((acc, item) => acc + (Number(item.quantidade_recebida) || 0), 0),
        quebrada: dadosFiltrados
          .filter((item) => item.material === "Quadro de topo")
          .reduce((acc, item) => acc + (Number(item.quantidade_quebrada) || 0), 0),
      },
      {
        nome: "Pallet de plástico",
        recebida: dadosFiltrados
          .filter((item) => item.material === "Pallet de plástico")
          .reduce((acc, item) => acc + (Number(item.quantidade_recebida) || 0), 0),
        quebrada: dadosFiltrados
          .filter((item) => item.material === "Pallet de plástico")
          .reduce((acc, item) => acc + (Number(item.quantidade_quebrada) || 0), 0),
      },
    ];
  }, [dadosFiltrados]);

  const graficoClientes = useMemo(() => {
    const mapa = {};

    dadosFiltrados.forEach((item) => {
      const cliente = item.cliente || "Sem cliente";
      if (!mapa[cliente]) {
        mapa[cliente] = { cliente, recebida: 0, quebrada: 0 };
      }
      mapa[cliente].recebida += Number(item.quantidade_recebida) || 0;
      mapa[cliente].quebrada += Number(item.quantidade_quebrada) || 0;
    });

    return Object.values(mapa)
      .sort((a, b) => b.recebida - a.recebida)
      .slice(0, 8);
  }, [dadosFiltrados]);

  const graficoPorData = useMemo(() => {
    const mapa = {};

    dadosFiltrados.forEach((item) => {
      const data = item.data || "Sem data";
      if (!mapa[data]) {
        mapa[data] = { data, recebida: 0, quebrada: 0 };
      }
      mapa[data].recebida += Number(item.quantidade_recebida) || 0;
      mapa[data].quebrada += Number(item.quantidade_quebrada) || 0;
    });

    return Object.values(mapa).sort((a, b) => a.data.localeCompare(b.data));
  }, [dadosFiltrados]);

  const graficoQuebraPie = useMemo(() => {
    return [
      { nome: "Boa", valor: indicadores.totalBom },
      { nome: "Quebrada", valor: indicadores.totalQuebrado },
    ];
  }, [indicadores]);

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; }
        input, select, button, textarea { font: inherit; }
        input::placeholder, textarea::placeholder {
          color: #94a3b8;
          opacity: 1;
        }
        input, select, textarea {
          color: #0f172a !important;
          -webkit-text-fill-color: #0f172a !important;
        }
        @media (max-width: 768px) {
          .app-header { padding: 18px; }
          .app-header-left { flex-direction: column; align-items: flex-start; }
          .app-logo-box { width: 84px !important; height: 84px !important; border-radius: 18px !important; }
          .app-title { font-size: 28px !important; line-height: 1.08 !important; }
          .app-subtitle { font-size: 14px !important; line-height: 1.45 !important; }
          .app-export { width: 100%; justify-content: center; }
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
          .app-card { padding: 18px !important; border-radius: 22px !important; }
          .app-section-title { font-size: 22px !important; text-align: center; }
          .app-form-grid, .app-filters-grid, .app-kpi-grid, .app-chart-grid {
            grid-template-columns: 1fr !important;
          }
          .app-input, .app-file-input, .app-textarea {
            min-height: 52px;
            padding: 14px 16px !important;
            font-size: 16px !important;
            border-radius: 16px !important;
          }
          .app-textarea { min-height: 100px !important; }
          .app-save-btn { width: 100%; justify-content: center; }
          .app-preview { width: 100% !important; max-width: 260px; height: 220px !important; }
          .app-chart-box { height: 260px !important; }
          .app-kpi-value { font-size: 30px !important; }
        }
      `}</style>

      <div style={styles.container}>
        <header className="app-header" style={styles.header}>
          <div className="app-header-left" style={styles.headerLeft}>
            <div className="app-logo-box" style={styles.logoBox}>
              <img src="/logo.png" alt="Logo Ball" style={styles.logo} />
            </div>

            <div>
              <h1 className="app-title" style={styles.title}>
                Recebimento de Material de Embalagem
              </h1>
              <p className="app-subtitle" style={styles.subtitle}>
                Controle de entrada, quebra e saldo bom por recebimento
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
                <label style={styles.label}>Material</label>
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
                <label style={styles.label}>Cliente</label>
                <select
                  value={form.cliente}
                  onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                  style={styles.input}
                  className="app-input"
                >
                  <option value="">Selecione o cliente</option>
                  {CLIENTES_FIXOS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  style={styles.input}
                  className="app-input"
                />
              </div>

              <div>
                <label style={styles.label}>Quantidade recebida</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Qtd recebida"
                  value={form.quantidadeRecebida}
                  onChange={(e) =>
                    setForm({ ...form, quantidadeRecebida: e.target.value })
                  }
                  style={styles.input}
                  className="app-input"
                />
              </div>

              <div>
                <label style={styles.label}>Quantidade quebrada</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Qtd quebrada"
                  value={form.quantidadeQuebrada}
                  onChange={(e) =>
                    setForm({ ...form, quantidadeQuebrada: e.target.value })
                  }
                  style={styles.input}
                  className="app-input"
                />
              </div>

              <div>
                <label style={styles.label}>Quantidade boa</label>
                <input
                  value={quantidadeBoaAtual}
                  readOnly
                  style={{ ...styles.input, background: "#f8fafc", fontWeight: 700 }}
                  className="app-input"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Observação da avaria</label>
                <textarea
                  placeholder="Ex.: 10 unidades com canto quebrado"
                  value={form.observacaoAvaria}
                  onChange={(e) =>
                    setForm({ ...form, observacaoAvaria: e.target.value })
                  }
                  style={styles.textarea}
                  className="app-textarea"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Foto do recebimento</label>
                <input
                  key={fotoInputKey}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => atualizarFoto(e.target.files?.[0])}
                  style={styles.fileInput}
                  className="app-file-input"
                />
                <div style={styles.helperText}>
                  No celular, esse campo tende a abrir a câmera.
                </div>
              </div>

              {/* CORREÇÃO 3: usa previewUrl gerenciado em estado em vez de criar object URL inline */}
              {previewUrl && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>Pré-visualização</label>
                  <img
                    src={previewUrl}
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
            <h2 className="app-section-title" style={styles.sectionTitle}>
              Registros
            </h2>

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
                      <th style={styles.th}>Recebida</th>
                      <th style={styles.th}>Quebrada</th>
                      <th style={styles.th}>Boa</th>
                      <th style={styles.th}>Observação</th>
                      <th style={styles.th}>Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* CORREÇÃO 2: usa dadosFiltrados em vez de dados brutos */}
                    {dadosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={styles.tdCenter}>
                          Nenhum registro encontrado.
                        </td>
                      </tr>
                    ) : (
                      dadosFiltrados.map((d) => {
                        const recebida = Number(d.quantidade_recebida) || 0;
                        const quebrada = Number(d.quantidade_quebrada) || 0;
                        const boa = recebida - quebrada;

                        return (
                          <tr key={d.id}>
                            <td style={styles.td}>{d.material}</td>
                            <td style={styles.td}>{d.cliente}</td>
                            <td style={styles.td}>{d.data}</td>
                            <td style={styles.td}>{recebida}</td>
                            <td style={styles.td}>{quebrada}</td>
                            <td style={styles.td}>{boa}</td>
                            <td style={styles.td}>{d.observacao_avaria || "-"}</td>
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
                        );
                      })
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
                  <label style={styles.label}>Data inicial</label>
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
                  <label style={styles.label}>Data final</label>
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
                  <label style={styles.label}>Cliente</label>
                  <select
                    value={filtros.cliente}
                    onChange={(e) =>
                      setFiltros({ ...filtros, cliente: e.target.value })
                    }
                    style={styles.input}
                    className="app-input"
                  >
                    <option value="">Todos os clientes</option>
                    {CLIENTES_FIXOS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Material</label>
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
                <div style={styles.kpiLabel}>Total recebido</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.totalRecebido}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Total quebrado</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.totalQuebrado}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Total bom</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.totalBom}
                </div>
              </div>

              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>% de quebra</div>
                <div className="app-kpi-value" style={styles.kpiValue}>
                  {indicadores.percentualQuebra}%
                </div>
              </div>
            </div>

            <div className="app-chart-grid" style={styles.chartGrid}>
              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Recebido x quebrado por material</h3>
                <div className="app-chart-box" style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graficoMateriais}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="recebida" fill="#2563eb" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="quebrada" fill="#ef4444" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.chartCard}>
                <h3 style={styles.chartTitle}>Bom x Quebrado</h3>
                <div className="app-chart-box" style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graficoQuebraPie}
                        dataKey="valor"
                        nameKey="nome"
                        outerRadius={100}
                        label
                      >
                        {graficoQuebraPie.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "#22c55e" : "#ef4444"}
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
                      <Bar dataKey="recebida" fill="#0f172a" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="quebrada" fill="#ef4444" radius={[8, 8, 0, 0]} />
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
                        dataKey="recebida"
                        stroke="#2563eb"
                        strokeWidth={3}
                      />
                      <Line
                        type="monotone"
                        dataKey="quebrada"
                        stroke="#ef4444"
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
  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1.5px solid #cbd5e1",
    background: "#ffffff",
    outline: "none",
    fontSize: "16px",
    boxSizing: "border-box",
    resize: "vertical",
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
    verticalAlign: "top",
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
