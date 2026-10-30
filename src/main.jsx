import React, { useState, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  RotateCw,
  Layers3,
  MousePointer2,
  Move,
  X,
  Check,
  Box,
  CircleHelp,
  Search,
  Gauge,
  Cylinder,
  Cog,
  Wind,
  Droplets,
  Component,
  Pause,
  Menu,
  Crosshair,
  Keyboard,
} from "lucide-react";
import Viewer from "./Viewer";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./style.css";

const parts = [
  {
    id: "intake",
    name: "Admissão",
    icon: Wind,
    index: "01",
    material: "Alumínio & fibra de carbono",
    detail:
      "É aqui que tudo começa. O coletor distribui o ar entre os oito cilindros, preparando a mistura que se transforma em movimento.",
    fact: "O primeiro passo da potência",
    type: "SISTEMA DE ADMISSÃO",
  },
  {
    id: "heads",
    name: "Cabeçotes",
    icon: Component,
    index: "02",
    material: "Liga de alumínio",
    detail:
      "Comandos, válvulas e molas trabalham em sincronia para controlar a entrada de ar e a saída dos gases em cada cilindro.",
    fact: "Precisão em cada ciclo",
    type: "COMANDO DE VÁLVULAS",
  },
  {
    id: "pistons",
    name: "Pistões e bielas",
    icon: Cylinder,
    index: "03",
    material: "Alumínio forjado & aço",
    detail:
      "Os pistões recebem a força da combustão. As bielas levam esse movimento ao virabrequim, milhares de vezes por minuto.",
    fact: "Da combustão ao movimento",
    type: "CONJUNTO MÓVEL",
  },
  {
    id: "block",
    name: "Bloco do motor",
    icon: Box,
    index: "04",
    material: "Liga de alumínio fundido",
    detail:
      "A estrutura que conecta tudo. Duas bancadas de quatro cilindros formam o V e abrigam os canais de óleo e arrefecimento.",
    fact: "O coração de toda a estrutura",
    type: "ESTRUTURA PRINCIPAL",
  },
  {
    id: "crankshaft",
    name: "Virabrequim",
    icon: Cog,
    index: "05",
    material: "Aço forjado",
    detail:
      "Transforma o movimento linear dos pistões em rotação. Seus contrapesos mantêm o conjunto equilibrado em alta velocidade.",
    fact: "A força ganha direção",
    type: "TRANSMISSÃO DE FORÇA",
  },
  {
    id: "turbos",
    name: "Turbocompressores",
    icon: Gauge,
    index: "06",
    material: "Aço & liga de alumínio",
    detail:
      "A energia dos gases de escape aciona as turbinas, que comprimem o ar da admissão para extrair mais potência de cada ciclo.",
    fact: "Mais ar. Mais possibilidades.",
    type: "SOBREALIMENTAÇÃO",
  },
  {
    id: "oilpan",
    name: "Cárter",
    icon: Droplets,
    index: "07",
    material: "Alumínio fundido",
    detail:
      "Na base do motor, o cárter armazena o óleo que lubrifica e protege as peças móveis, ajudando a dissipar o calor.",
    fact: "Proteção que mantém tudo fluindo",
    type: "SISTEMA DE LUBRIFICAÇÃO",
  },
];

function Logo({ light = false }) {
  return (
    <a
      className={`brand ${light ? "light" : ""}`}
      href="#"
      aria-label="Intera — início"
    >
      <svg viewBox="0 0 32 36" fill="none">
        <path
          d="m16 2 13 7.5v16L16 33 3 25.5v-16L16 2Z"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="m3 9.5 13 8 13-8M16 18v15M9.5 6l13 8v15"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        intera<span className="brand-period">.</span>
      </span>
    </a>
  );
}

function Modal({ type, close, explore }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const prev = document.activeElement;
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = [
          ...document.querySelectorAll(".modal button, .modal input, .modal a"),
        ].filter((x) => !x.disabled);
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    document.querySelector(".modal-close")?.focus();
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [close]);
  const library = [
    {
      title: "Motor V8 biturbo",
      sub: "Mecânica automotiva",
      icon: Cylinder,
      live: true,
    },
    { title: "Motor elétrico", sub: "Mobilidade elétrica", icon: Cog },
    {
      title: "Turbina aeronáutica",
      sub: "Engenharia aeroespacial",
      icon: Wind,
    },
  ].filter((x) =>
    `${x.title} ${x.sub}`.toLowerCase().includes(query.toLowerCase()),
  );
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className={`modal modal-${type}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button
          className="modal-close icon-button"
          onClick={close}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>
        <span className="eyebrow">
          <span />{" "}
          {type === "library"
            ? "SUA PRÓXIMA DESCOBERTA"
            : type === "about"
              ? "PRAZER, SOMOS A INTERA"
              : "UM NOVO JEITO DE APRENDER"}
        </span>
        <h2 id="modal-title">
          {type === "library"
            ? "Um mundo por dentro."
            : type === "about"
              ? "A curiosidade move tudo."
              : "Explore do seu jeito."}
        </h2>
        {type === "library" ? (
          <>
            <p>Escolha um modelo e descubra a engenharia além da superfície.</p>
            <div className="search-field">
              <Search size={18} />
              <input
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar na biblioteca"
                aria-label="Buscar modelos"
              />
            </div>
            <div className="model-library">
              {library.map((m) => (
                <button
                  key={m.title}
                  disabled={!m.live}
                  onClick={explore}
                  className="library-model"
                >
                  <div className={`model-thumbnail ${m.live ? "red" : ""}`}>
                    <m.icon size={40} strokeWidth={1.3} />
                    <span className="tiny-grid" />
                  </div>
                  <div>
                    <small>{m.sub}</small>
                    <h3>{m.title}</h3>
                    <span className={m.live ? "model-available" : "model-soon"}>
                      {m.live ? "Explorar modelo" : "Em breve"}
                      {m.live && <ArrowUpRight size={15} />}
                    </span>
                  </div>
                </button>
              ))}
              {!library.length && (
                <p className="no-results">
                  Nenhum modelo encontrado. Tente “motor”.
                </p>
              )}
            </div>
          </>
        ) : type === "about" ? (
          <>
            <p>
              Existe um universo de ideias dentro das coisas que nos movem. A
              Intera aproxima você desse universo.
            </p>
            <div className="about-quote">
              Veja além da superfície.
              <br />
              <span>Entenda cada conexão.</span>
            </div>
            <p>
              Criamos experiências interativas para transformar mecanismos
              complexos em descobertas simples. Gire, desmonte e explore — a
              próxima pergunta é sua.
            </p>
            <div className="accuracy-note">
              <CircleHelp size={19} />
              <span>
                Este modelo 3D é uma representação didática de um motor V8
                biturbo. Proporções e especificações são ilustrativas.
              </span>
            </div>
            <button className="primary-button" onClick={explore}>
              Vamos explorar <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <p>Não é preciso entender de motores. Só ter curiosidade.</p>
            <div className="how-steps">
              <article>
                <div>
                  <Move size={22} />
                </div>
                <span>01</span>
                <h3>Mude a perspectiva</h3>
                <p>
                  Arraste para girar o motor. Use o scroll ou os botões + e −
                  para chegar mais perto.
                </p>
              </article>
              <article>
                <div>
                  <Layers3 size={22} />
                </div>
                <span>02</span>
                <h3>Separe para entender</h3>
                <p>
                  Mova o controle “Vista explodida” e veja como cada parte se
                  conecta ao conjunto.
                </p>
              </article>
              <article>
                <div>
                  <MousePointer2 size={22} />
                </div>
                <span>03</span>
                <h3>Descubra cada peça</h3>
                <p>
                  Clique no modelo ou na lista de componentes para conhecer sua
                  função e seu material.
                </p>
              </article>
            </div>
            <div className="keyboard-note">
              <Keyboard size={17} /> Dica: ative a rotação automática para
              observar todos os ângulos.
            </div>
            <button className="primary-button" onClick={close}>
              Entendi, vamos lá <ArrowRight size={17} />
            </button>
          </>
        )}
      </section>
    </div>,
    document.fullscreenElement || document.body,
  );
}

function App() {
  const [explosion, setExplosion] = useState(85);
  const [selected, setSelected] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [modal, setModal] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [componentsOpen, setComponentsOpen] = useState(
    () => window.matchMedia("(min-width: 601px)").matches,
  );
  const pick = useCallback((id) => {
    setSelected(id);
    if (window.matchMedia('(max-width: 600px)').matches) setComponentsOpen(false);
  }, []);
  const close = useCallback(() => setModal(null), []);
  const part = parts.find((p) => p.id === selected);
  const reset = () => {
    setExplosion(85);
    setSelected(null);
    setAutoRotate(false);
    setResetKey((x) => x + 1);
  };
  const explore = () => {
    setModal(null);
    setMobileMenu(false);
    reset();
    document.getElementById("explorar")?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="brand-wrap">
            <Logo />
            <span className="brand-divider" />
            <span className="brand-tagline">Veja além da superfície.</span>
          </div>
          <nav
            className={mobileMenu ? "nav open" : "nav"}
            aria-label="Navegação principal"
          >
            <button className="nav-link active" onClick={explore}>
              Explorar <span />
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setModal("library");
                setMobileMenu(false);
              }}
            >
              Biblioteca <span className="nav-count">01</span>
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setModal("help");
                setMobileMenu(false);
              }}
            >
              Como funciona
            </button>
          </nav>
          <button className="about-link" onClick={() => setModal("about")}>
            Sobre a Intera <ArrowUpRight size={16} />
          </button>
          <button
            className="mobile-menu icon-button"
            aria-label="Abrir menu"
            aria-expanded={mobileMenu}
            onClick={() => setMobileMenu((v) => !v)}
          >
            {mobileMenu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      <main id="explorar">
        <div className="breadcrumb">
          <span>Biblioteca</span>
          <ChevronRight size={13} />
          <span>Mecânica automotiva</span>
          <ChevronRight size={13} />
          <strong>Motor V8 biturbo</strong>
          <div className="availability">
            <span /> MODELO INTERATIVO
          </div>
        </div>
        <div className="workspace">
          <aside className="intro">
            <div className="eyebrow">
              <span /> A CURIOSIDADE GANHA FORMA
            </div>
            <h1>
              A engenharia,
              <br />
              por{" "}
              <span className="heading-last">
                dentro
                <svg viewBox="0 0 160 8" preserveAspectRatio="none">
                  <path
                    d="M2 6Q76-2 158 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
              <span className="red-dot">.</span>
            </h1>
            <p className="intro-description">
              Grandes ideias são feitas de pequenos detalhes. Explore cada um
              deles.
            </p>
            <div className="engine-summary">
              <div className="category">
                <span className="category-icon">
                  <Cog size={14} />
                </span>{" "}
                MECÂNICA AUTOMOTIVA
              </div>
              <h2>
                Motor V8 <span>biturbo.</span>
              </h2>
              <p>
                Uma sinfonia de precisão.
                <br />
                Agora, ao alcance da sua curiosidade.
              </p>
              <div className="spec-grid">
                <div>
                  <span>ARQUITETURA</span>
                  <strong>
                    8 cilindros <small>em V</small>
                  </strong>
                </div>
                <div>
                  <span>CILINDRADA</span>
                  <strong>
                    4.0 <small>litros</small>
                  </strong>
                </div>
                <div>
                  <span>ASPIRAÇÃO</span>
                  <strong>Biturbo</strong>
                </div>
                <div>
                  <span>COMPONENTES</span>
                  <strong>
                    7 <small>conjuntos</small>
                  </strong>
                </div>
              </div>
              <div className="illustrative">
                <span /> Representação didática
              </div>
            </div>
            <button
              className="discover-link"
              onClick={() => {
                setComponentsOpen(true);
                setSelected("intake");
              }}
            >
              Comece pela admissão <ArrowRight size={17} />
            </button>
            <div className="collection-index">
              <span>
                01 <i>/ 01</i>
              </span>
              <div>
                <span />
              </div>
              <span>EM EXPLORAÇÃO</span>
            </div>
          </aside>
          <section
            className="explorer"
            aria-label="Explorador interativo do motor V8"
          >
            <div className="viewer-area">
              <Viewer
                explosion={explosion}
                selected={selected}
                onSelect={pick}
                autoRotate={autoRotate}
                resetKey={resetKey}
                onHelp={() => setModal("help")}
              />
              <aside
                className={`components-panel ${componentsOpen ? "" : "collapsed"}`}
              >
                <button
                  className="components-title"
                  onClick={() => setComponentsOpen((v) => !v)}
                  aria-expanded={componentsOpen}
                >
                  <span>
                    <Layers3 size={16} /> Componentes <small>07</small>
                  </span>
                  <ChevronDown size={15} />
                </button>
                {componentsOpen && (
                  <>
                    <div className="component-list">
                      {parts.map((p) => (
                        <button
                          className={`component ${selected === p.id ? "selected" : ""}`}
                          key={p.id}
                          onClick={() =>
                            selected === p.id ? setSelected(null) : pick(p.id)
                          }
                          aria-pressed={selected === p.id}
                        >
                          <span className="component-index">{p.index}</span>
                          <span className="part-icon">
                            <p.icon size={16} strokeWidth={1.5} />
                          </span>
                          <span>{p.name}</span>
                          <span className="component-indicator">
                            {selected === p.id ? (
                              <Check size={13} />
                            ) : (
                              <ChevronRight size={13} />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="component-footer">
                      <MousePointer2 size={13} /> Clique em uma peça para
                      descobrir
                    </div>
                  </>
                )}
              </aside>
              {part ? (
                <div className="part-detail" key={part.id}>
                  <div className="detail-top">
                    <span className="eyebrow">
                      {part.index} <i /> {part.type}
                    </span>
                    <button
                      aria-label="Fechar detalhes da peça"
                      onClick={() => setSelected(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <h3>{part.name}</h3>
                  <p>{part.detail}</p>
                  <div className="detail-material">
                    <span>MATERIAL</span>
                    {part.material}
                  </div>
                </div>
              ) : (
                <div className="interaction-hint">
                  <span className="hint-cursor">
                    <MousePointer2 size={15} />
                  </span>
                  <div>
                    Não fique só olhando.<span>Arraste, gire e descubra.</span>
                  </div>
                  <Move size={15} />
                </div>
              )}
            </div>
            <div className="viewer-controls">
              <div className="explode-title">
                <Layers3 size={19} />
                <div>
                  <strong>Vista explodida</strong>
                  <span>Separe as peças. Conecte as ideias.</span>
                </div>
              </div>
              <div className="slider-block">
                <div className="slider-labels">
                  <button onClick={() => setExplosion(0)}>Montado</button>
                  <span>
                    {explosion}
                    <small>%</small>
                  </span>
                  <button onClick={() => setExplosion(100)}>Explodido</button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={explosion}
                  onChange={(e) => setExplosion(Number(e.target.value))}
                  style={{ "--progress": `${explosion}%` }}
                  aria-label="Nível de explosão do motor"
                />
              </div>
              <span className="controls-divider" />
              <button
                className={`rotate-button ${autoRotate ? "rotating" : ""}`}
                onClick={() => setAutoRotate((v) => !v)}
                aria-pressed={autoRotate}
                title={
                  autoRotate
                    ? "Pausar rotação automática"
                    : "Ativar rotação automática"
                }
              >
                {autoRotate ? <Pause size={16} /> : <RotateCw size={18} />}
                <span>
                  {autoRotate ? "Pausar rotação" : "Rotação automática"}
                </span>
              </button>
            </div>
          </section>
        </div>
        <section
          className="learning-strip"
          aria-label="Recursos da experiência"
        >
          <div className="strip-heading">
            <span className="eyebrow">MUDE O OLHAR.</span>
            <h2>
              O conhecimento vem
              <br />
              de todos os ângulos.
            </h2>
          </div>
          <button
            onClick={() => {
              setAutoRotate((v) => !v);
              setResetKey((x) => x + 1);
            }}
          >
            <div className="feature-icon">
              <RotateCw size={23} strokeWidth={1.4} />
              <span>360°</span>
            </div>
            <div>
              <h3>Uma nova perspectiva</h3>
              <p>Gire livremente. Vá além do óbvio.</p>
            </div>
            <ArrowUpRight size={16} />
          </button>
          <button onClick={() => setExplosion((v) => (v === 100 ? 0 : 100))}>
            <div className="feature-icon">
              <Layers3 size={29} strokeWidth={1.3} />
            </div>
            <div>
              <h3>Cada parte importa</h3>
              <p>Desmonte o complexo. Entenda o todo.</p>
            </div>
            <ArrowUpRight size={16} />
          </button>
          <button
            onClick={() => {
              setComponentsOpen(true);
              pick("pistons");
            }}
          >
            <div className="feature-icon">
              <Crosshair size={29} strokeWidth={1.3} />
            </div>
            <div>
              <h3>Um detalhe, uma descoberta</h3>
              <p>Selecione uma peça. Encontre respostas.</p>
            </div>
            <ArrowUpRight size={16} />
          </button>
        </section>
      </main>
      <footer>
        <Logo />
        <span>Para mentes que não param de explorar.</span>
        <div>
          ENGENHARIA FEITA DESCOBERTA <svg className="footer-spark" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M4.9 19.1 19.1 4.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
      </footer>
      {modal && <Modal type={modal} close={close} explore={explore} />}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
