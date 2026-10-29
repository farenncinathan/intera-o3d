import './style.css';
import { EngineViewer } from './engine.js';
import { categories, categoryById } from './data.js';
import { icon } from './icons.js';
import { CYCLES, FIRING_ORDER, TAU, cycleAt, cylinderAngle } from './mechanics.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { selected: null, running: !reducedMotion, rpm: 900, explosion: 0, transparent: false, labels: false, isolated: false, angle: 0, panel: 'overview', cylinder: 1, search: '', mobileView: 'model' };
let engine, lastFrame = performance.now(), lastUi = 0, toastTimeout;

$('#app').innerHTML = `
  <header class="app-header">
    <a class="brand" href="./" aria-label="Intera O3D, início">${icon('logo')}<span>INTERA<span class="brand-divider"></span><b>O3D</b></span></a>
    <div class="header-section"><span class="active-dot"></span> LABORATÓRIO INTERATIVO</div>
    <div class="header-actions"><span class="version">VERSÃO 1.1 · ENCAIXES REVISADOS</span><button class="text-button" id="help-button">${icon('help')}<span>Como explorar</span></button></div>
  </header>
  <main class="workspace" data-mobile-view="model">
    <aside class="sidebar" aria-label="Componentes do motor">
      <div class="sidebar-head"><span class="eyebrow">EXPLORE O CONJUNTO</span><div class="sidebar-title"><h2>Componentes</h2><span class="count-badge" id="total-parts">90</span></div>
        <label class="search-box">${icon('search')}<input id="component-search" type="search" placeholder="Buscar uma peça…" aria-label="Buscar componentes" autocomplete="off" /></label>
      </div>
      <div class="component-list" id="component-list"></div>
      <div class="sidebar-bottom">${icon('info')}<p>Selecione na lista ou diretamente no motor.</p></div>
    </aside>
    <section class="stage" aria-label="Visualização interativa do motor">
      <div class="stage-heading"><div class="breadcrumb">LABORATÓRIO <span>/</span> MOTORES <span>/</span> <b>V12</b></div>
        <h1>Por dentro da<span>potência.</span></h1><p>Uma máquina. Cada peça. Tudo conectado.</p>
      </div>
      <div class="stage-badge"><span class="live-light"></span> MOTOR V12 <span class="badge-divider"></span> BITURBO</div>
      <div id="viewer" class="viewer"><div class="loading" role="status"><span></span>Preparando seu motor…</div></div>
      <div id="model-labels" class="model-labels"></div>
      <div class="viewer-toolbar" role="toolbar" aria-label="Opções de visualização">
        <button id="explode-toggle" aria-pressed="false" title="Alternar vista explodida">${icon('layers')}<span>Vista explodida</span></button>
        <span class="toolbar-divider"></span><button id="transparent-toggle" aria-pressed="false" title="Tornar bloco e carcaças transparentes">${icon('eye')}<span>Transparência</span></button>
        <button id="labels-toggle" aria-pressed="false" title="Mostrar nomes das peças">${icon('label')}<span class="extra-label">Etiquetas</span></button>
        <span class="toolbar-divider"></span><button id="reset-view" class="icon-button" aria-label="Restaurar câmera e visualização" title="Restaurar visualização (R)">${icon('reset')}</button>
        <button id="fullscreen" class="icon-button" aria-label="Alternar tela cheia" title="Tela cheia">${icon('expand')}</button>
      </div>
      <div class="selected-hint" id="selected-hint" hidden></div>
      <div class="orbit-hint">${icon('rotate')}<span>ARRASTE PARA GIRAR</span><span class="hint-dot">·</span>${icon('mouse')}<span>SCROLL PARA APROXIMAR</span></div>
      <div class="stage-controls">
        <div class="explosion-control"><div><label for="explosion-range">SEPARAÇÃO DAS PEÇAS <span id="assembly-mode">· MONTADO</span></label><output for="explosion-range" id="explosion-value">0<span>%</span></output></div><div class="range-row"><span>Montado</span><input id="explosion-range" type="range" min="0" max="100" value="0" aria-label="Separação das peças" aria-valuetext="0%, motor montado" /><span>Explodido</span></div></div>
        <div class="simulation-control">
          <button id="play-toggle" class="play-button" aria-label="Pausar animação" aria-pressed="true">${icon('pause')}</button>
          <div class="simulation-copy"><span id="simulation-label">Motor em movimento</span><small>VELOCIDADE DIDÁTICA · 24× MAIS LENTA</small></div>
          <div class="rpm-control"><div><label for="rpm-range">ROTAÇÃO</label><output id="rpm-value" for="rpm-range">900 <small>rpm</small></output></div><input type="range" id="rpm-range" min="600" max="6000" step="100" value="900" aria-label="Rotação do motor em RPM" /></div>
          <button id="cycle-open" class="cycle-open" title="Entender os quatro tempos">${icon('rotate')}<span>Ver o ciclo</span>${icon('arrow')}</button>
        </div>
      </div>
    </section>
    <aside class="inspector" aria-label="Informações sobre a peça selecionada"><div id="inspector-content"></div></aside>
  </main>
  <nav class="mobile-nav" aria-label="Navegação do laboratório"><button data-mobile="parts">${icon('layers')}Componentes</button><button data-mobile="model" class="active">${icon('block')}Motor 3D</button><button data-mobile="info">${icon('info')}Descobrir</button></nav>
  <footer class="app-footer"><span><i class="status-dot"></i><span id="footer-status">MODELO INTERATIVO</span></span><span>V12 · 60° · 4 TEMPOS</span><span class="footer-note">MODELO DIDÁTICO, INSPIRADO NA REFERÊNCIA</span><span>FEITO PARA EXPLORAR ${icon('arrow')}</span></footer>
  <div id="hover-tooltip" class="hover-tooltip" hidden></div><div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="guide-dialog" class="guide-dialog"><div class="dialog-top"><span class="eyebrow">SEU GUIA DE EXPLORAÇÃO</span><button id="close-guide" class="icon-button" aria-label="Fechar guia">${icon('close')}</button></div><h2>A curiosidade<br />é o ponto de partida.</h2><p>Explore o motor no seu ritmo. Todas as peças visíveis são selecionáveis.</p>
    <div class="guide-grid"><div>${icon('rotate')}<h3>Encontre seu ângulo</h3><p>Arraste com o mouse ou com um dedo para girar. Use o scroll ou o gesto de pinça para aproximar.</p></div><div>${icon('piston')}<h3>Escolha uma peça</h3><p>Clique no modelo ou na lista. Dê dois cliques para focar. Use “Isolar peça” para observar os detalhes.</p></div><div>${icon('layers')}<h3>Veja por dentro</h3><p>Em 0%, o motor está montado. A vista explodida separa os encaixes intencionalmente para estudo. Use a transparência para ver por dentro mantendo o conjunto montado.</p></div><div>${icon('play')}<h3>Conecte os movimentos</h3><p>Controle a rotação ou abra “Ver o ciclo”. Cada etapa mostra a função dos pistões e das válvulas.</p></div></div>
    <div class="keyboard-hints"><span><kbd>Espaço</kbd> Reproduzir / pausar</span><span><kbd>R</kbd> Restaurar vista</span><span><kbd>Esc</kbd> Limpar seleção</span></div>
    <p class="model-disclaimer">Modelo procedural ilustrativo, sem vínculo com fabricantes. Geometria, proporções e distribuição simplificadas. Não é um simulador de desempenho nem um manual de manutenção. Áudio, lubrificação, arrefecimento e fluidodinâmica não são simulados.</p>
    <button class="primary-button" id="guide-done">Vamos explorar ${icon('arrow')}</button>
  </dialog>
`;

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 2600); }
function setMobileView(view) {
  state.mobileView = view; $('.workspace').dataset.mobileView = view;
  $$('[data-mobile]').forEach(b => { b.classList.toggle('active', b.dataset.mobile === view); b.setAttribute('aria-current', b.dataset.mobile === view ? 'page' : 'false'); });
  requestAnimationFrame(() => engine?.resize());
}
function renderComponents() {
  const query = state.search.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalize = value => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let html = '', matches = 0;
  categories.forEach((c, i) => {
    const parts = engine.parts.filter(p => p.category === c.id);
    const categoryMatches = normalize(c.name).includes(query);
    const filtered = categoryMatches ? parts : parts.filter(p => normalize(p.name).includes(query));
    if (query && !filtered.length) return;
    matches++;
    const active = state.selected && engine.partsById.get(state.selected)?.category === c.id;
    html += `<button class="component-row ${active ? 'active' : ''}" data-category="${c.id}" aria-pressed="${Boolean(active)}"><span class="component-icon">${icon(c.icon)}</span><span class="component-name">${c.name}</span><span class="component-count">${parts.length}</span>${icon('chevron', 'component-chevron')}</button>`;
    if (query) html += `<div class="search-results">${filtered.map(p => `<button data-part="${p.id}" class="search-result ${state.selected === p.id ? 'active' : ''}">${p.name}${icon('arrow')}</button>`).join('')}</div>`;
  });
  $('#component-list').innerHTML = matches ? html : `<div class="search-empty">${icon('search')}<h3>Nenhuma peça encontrada</h3><p>Tente “pistão”, “turbo” ou “válvula”.</p><button class="text-button" data-clear-search>Limpar busca</button></div>`;
}
function renderInspector() {
  const selected = state.selected ? engine.partsById.get(state.selected) : null;
  let html = '';
  if (state.panel === 'cycle') {
    const a = cylinderAngle(state.angle, state.cylinder), phase = cycleAt(a);
    html = `<div class="inspector-heading"><span class="eyebrow">DOIS GIROS. QUATRO TEMPOS.</span><button class="icon-button" data-exit-cycle aria-label="Fechar explicação do ciclo">${icon('close')}</button></div><h2 class="inspector-title">A energia<br />em sequência.</h2><p class="inspector-intro">Siga um cilindro e descubra o que acontece em cada etapa.</p>
      <label class="field-label" for="cycle-cylinder">CILINDRO EM OBSERVAÇÃO</label><select id="cycle-cylinder">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.cylinder === i + 1 ? 'selected' : ''}>Cilindro ${String(i + 1).padStart(2, '0')} · bancada ${i < 6 ? 'A' : 'B'}</option>`).join('')}</select>
      <div class="cycle-dial"><div class="cycle-dial-ring"><span id="cycle-degrees">${Math.floor(a / Math.PI * 180)}<small>°</small></span><span class="dial-small">DE 720°</span></div><div><span class="eyebrow">ETAPA ATUAL</span><h3 id="current-phase" style="color:${CYCLES[phase].color}">${CYCLES[phase].name}</h3><span id="phase-short">${CYCLES[phase].short}</span></div></div>
      <div class="cycle-timeline">${CYCLES.map((c, i) => `<button data-phase="${i}" class="phase-card ${phase === i ? 'active' : ''}" style="--phase-color:${c.color}" aria-label="Observar etapa de ${c.name.toLowerCase()}"><span class="phase-number">0${i + 1}</span><span><b>${c.name}</b><small>${i * 180}° – ${(i + 1) * 180}°</small></span>${icon('arrow')}</button>`).join('')}</div>
      <div class="phase-explanation"><span class="eyebrow">O QUE ACONTECE</span><p id="phase-description">${CYCLES[phase].description}</p><div id="phase-valves">${CYCLES[phase].valves}</div></div>
      <label class="field-label" for="cycle-scrub">PERCORRER O CICLO MANUALMENTE</label><input type="range" id="cycle-scrub" min="0" max="719" step="1" value="${Math.floor(a / Math.PI * 180)}" aria-label="Ângulo do ciclo em graus" /><div class="range-ticks"><span>0°</span><span>360°</span><span>720°</span></div>
      <p class="educational-note">${icon('info')}O motor é exibido com as carcaças transparentes. As cores representam os tempos do cilindro selecionado.</p>`;
  } else if (selected) {
    const c = categoryById[selected.category], siblings = engine.parts.filter(p => p.category === selected.category), index = siblings.findIndex(p => p.id === selected.id);
    const moving = ['pistons', 'rods', 'cams', 'crank', 'valves', 'turbo', 'timing'].includes(selected.category);
    html = `<div class="inspector-heading"><span class="eyebrow">PEÇA EM FOCO</span><button class="icon-button" data-clear-selection aria-label="Limpar seleção">${icon('close')}</button></div>
      <div class="part-visual"><span class="part-visual-grid"></span>${icon(c.icon)}<span class="part-visual-label">${String(categories.indexOf(c) + 1).padStart(2, '0')} / 13</span><span class="part-visual-status"><i></i> ${moving ? 'MECANISMO MÓVEL' : 'ESTRUTURA FIXA'}</span></div>
      <div class="part-type">${c.name}</div><h2 class="part-title">${selected.name}</h2><p class="part-tag">${c.tag}</p>
      <div class="part-selector"><button data-prev-part class="icon-button" aria-label="Peça anterior" ${siblings.length === 1 ? 'disabled' : ''}>${icon('chevron', 'reverse')}</button><select id="part-select" aria-label="Escolher peça deste sistema">${siblings.map(p => `<option value="${p.id}" ${p.id === selected.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select><button data-next-part class="icon-button" aria-label="Próxima peça" ${siblings.length === 1 ? 'disabled' : ''}>${icon('chevron')}</button></div><span class="part-position">${index + 1} DE ${siblings.length} NESTE SISTEMA</span>
      <p class="part-description">${c.description}</p><div class="part-facts">${c.facts.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div>
      <div class="section-label">${icon('rotate')} COMO FUNCIONA</div><p class="operation-copy">${c.operation}</p>
      <div class="part-actions"><button class="primary-button" data-focus>${icon('focus')}Focar peça</button><button class="secondary-button ${state.isolated ? 'active' : ''}" data-isolate aria-pressed="${state.isolated}">${icon('eye')}${state.isolated ? 'Ver conjunto' : 'Isolar peça'}</button></div>
      ${selected.cylinder ? `<button class="inline-cycle" data-view-cylinder="${selected.cylinder}">Ver o ciclo do cilindro ${String(selected.cylinder).padStart(2, '0')}${icon('arrow')}</button>` : ''}
      <div class="related"><span class="eyebrow">TUDO ESTÁ CONECTADO</span>${c.related.map(id => `<button data-category="${id}">${icon(categoryById[id].icon)}${categoryById[id].name}${icon('arrow')}</button>`).join('')}</div>`;
  } else {
    html = `<span class="eyebrow">CONHEÇA A MÁQUINA</span><h2 class="inspector-title">Cada peça<br />tem um papel.</h2><p class="inspector-intro">Uma experiência para entender o que acontece entre a primeira faísca e a próxima volta.</p>
      <div class="engine-specs"><div><b>12</b><span>CILINDROS</span></div><div><b>60<span>°</span></b><span>ÂNGULO EM V</span></div><div><b>48</b><span>VÁLVULAS</span></div></div>
      <button class="discovery-card" data-part="pistao-1"><span class="discovery-top"><span class="eyebrow">UM BOM PONTO DE PARTIDA</span>${icon('arrow')}</span><span class="discovery-illustration">${icon('piston')}</span><strong>Pequeno movimento.<br />Uma grande força.</strong><span>Conheça o pistão ${icon('arrow')}</span></button>
      <div class="section-label cycle-section-title">UM CICLO. QUATRO TEMPOS.</div><div class="overview-phases">${CYCLES.map((c, i) => `<button data-start-phase="${i}"><span style="color:${c.color}">0${i + 1}</span><span>${c.name}</span>${icon('arrow')}</button>`).join('')}</div>
      <button class="primary-button overview-cycle" data-open-cycle>Entender o ciclo completo${icon('arrow')}</button><div class="inspector-footnote">${icon('info')}Explore livremente. Nenhum conhecimento de mecânica é necessário.</div>`;
  }
  $('#inspector-content').innerHTML = html;
}
function selectPart(id, { keepPanel = false } = {}) {
  state.selected = id;
  if (!keepPanel) state.panel = id ? 'part' : 'overview';
  if (!id && state.isolated) { state.isolated = false; engine.setIsolated(false); }
  engine.setSelection(id);
  if (state.isolated && id) engine.focus(id);
  renderComponents(); renderInspector();
  const p = engine.partsById.get(id);
  $('#selected-hint').hidden = !p;
  $('#selected-hint').innerHTML = p ? `<span class="selection-dot"></span><span>${p.name}</span><button data-show-info>Ver detalhes${icon('arrow')}</button>` : '';
}
function updateControls() {
  $('#play-toggle').innerHTML = icon(state.running ? 'pause' : 'play');
  $('#play-toggle').setAttribute('aria-label', state.running ? 'Pausar animação' : 'Reproduzir animação');
  $('#play-toggle').setAttribute('aria-pressed', String(state.running));
  $('#simulation-label').textContent = state.running ? 'Motor em movimento' : 'Animação pausada';
  $('.simulation-control').classList.toggle('paused', !state.running);
  $('#rpm-value').innerHTML = `${state.rpm.toLocaleString('pt-BR')} <small>rpm</small>`;
  $('#explosion-value').innerHTML = `${state.explosion}<span>%</span>`;
  $('#explosion-range').value = state.explosion;
  $('#assembly-mode').textContent = state.explosion === 0 ? '· MONTADO' : '· DESMONTAGEM';
  $('#explosion-range').setAttribute('aria-valuetext', `${state.explosion}%, ${state.explosion === 0 ? 'motor montado' : 'vista explodida, encaixes separados para estudo'}`);
  $('#explode-toggle').setAttribute('aria-pressed', String(state.explosion > 0));
  $('#transparent-toggle').setAttribute('aria-pressed', String(state.transparent));
  $('#labels-toggle').setAttribute('aria-pressed', String(state.labels));
  engine.setExplosion(state.explosion / 100); engine.labelsVisible = state.labels;
}
function openCycle(cylinder = 1, phase = null) {
  state.cylinder = Number(cylinder); state.panel = 'cycle'; state.transparent = true; state.isolated = false; state.explosion = 0;
  engine.setIsolated(false); engine.setTransparent(true);
  selectPart(`pistao-${state.cylinder}`, { keepPanel: true });
  if (phase !== null) { state.angle = (Number(phase) + 0.5) * Math.PI + FIRING_ORDER.indexOf(state.cylinder) * Math.PI / 3; state.running = false; }
  engine.reset(); updateControls(); renderInspector();
  if (window.innerWidth <= 1000) setMobileView('info');
}
function resetView() {
  state.explosion = 0; state.transparent = false; state.labels = false; state.isolated = false; state.panel = 'overview';
  engine.setTransparent(false); engine.setIsolated(false); selectPart(null); engine.reset(); updateControls(); toast('Visualização restaurada');
}
function updateCycleUI() {
  if (state.panel !== 'cycle') return;
  const a = cylinderAngle(state.angle, state.cylinder), phase = cycleAt(a), data = CYCLES[phase], degrees = Math.floor(a / Math.PI * 180);
  $('#cycle-degrees').innerHTML = `${degrees}<small>°</small>`;
  $('#current-phase').textContent = data.name; $('#current-phase').style.color = data.color; $('#phase-short').textContent = data.short;
  $('#phase-description').textContent = data.description; $('#phase-valves').textContent = data.valves;
  $$('.phase-card').forEach((card, i) => { card.classList.toggle('active', i === phase); card.setAttribute('aria-pressed', String(i === phase)); });
  if (document.activeElement !== $('#cycle-scrub')) $('#cycle-scrub').value = degrees;
}
function bindEvents() {
  $('#component-search').addEventListener('input', event => { state.search = event.target.value; renderComponents(); });
  $('#explosion-range').addEventListener('input', event => { state.explosion = Number(event.target.value); updateControls(); });
  $('#rpm-range').addEventListener('input', event => { state.rpm = Number(event.target.value); updateControls(); });
  $('#play-toggle').addEventListener('click', () => { state.running = !state.running; updateControls(); });
  $('#explode-toggle').addEventListener('click', () => { state.explosion = state.explosion > 0 ? 0 : 70; updateControls(); });
  $('#transparent-toggle').addEventListener('click', () => { state.transparent = !state.transparent; engine.setTransparent(state.transparent); updateControls(); });
  $('#labels-toggle').addEventListener('click', () => { state.labels = !state.labels; updateControls(); });
  $('#reset-view').addEventListener('click', resetView);
  $('#cycle-open').addEventListener('click', () => openCycle(engine.partsById.get(state.selected)?.cylinder || 1));
  $('#fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('Use a opção de tela cheia do seu navegador.'); }
    catch { toast('A tela cheia não está disponível neste navegador.'); }
  });
  document.addEventListener('fullscreenchange', () => { $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Sair da tela cheia' : 'Alternar tela cheia'); });
  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.category) {
      const part = engine.parts.find(p => p.category === button.dataset.category); if (part) selectPart(part.id);
      if (window.innerWidth <= 1000) setMobileView('model');
    }
    if (button.dataset.part) { selectPart(button.dataset.part); if (window.innerWidth <= 1000) setMobileView('model'); }
    if (button.hasAttribute('data-clear-search')) { state.search = ''; $('#component-search').value = ''; renderComponents(); $('#component-search').focus(); }
    if (button.hasAttribute('data-clear-selection')) selectPart(null);
    if (button.hasAttribute('data-focus') && state.selected) engine.focus(state.selected);
    if (button.hasAttribute('data-isolate') && state.selected) { state.isolated = !state.isolated; engine.setIsolated(state.isolated); if (!state.isolated) engine.reset(); renderInspector(); }
    if (button.hasAttribute('data-prev-part') || button.hasAttribute('data-next-part')) {
      const part = engine.partsById.get(state.selected), peers = engine.parts.filter(p => p.category === part.category), index = peers.indexOf(part), offset = button.hasAttribute('data-next-part') ? 1 : -1;
      selectPart(peers[(index + offset + peers.length) % peers.length].id);
    }
    if (button.hasAttribute('data-open-cycle')) openCycle();
    if (button.hasAttribute('data-start-phase')) openCycle(1, button.dataset.startPhase);
    if (button.hasAttribute('data-view-cylinder')) openCycle(button.dataset.viewCylinder);
    if (button.hasAttribute('data-phase')) { state.angle = (Number(button.dataset.phase) + 0.5) * Math.PI + FIRING_ORDER.indexOf(state.cylinder) * Math.PI / 3; state.running = false; updateControls(); updateCycleUI(); }
    if (button.hasAttribute('data-exit-cycle')) { state.panel = 'part'; renderInspector(); }
    if (button.dataset.mobile) setMobileView(button.dataset.mobile);
    if (button.hasAttribute('data-show-info')) { setMobileView('info'); $('.inspector').scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'part-select') selectPart(event.target.value);
    if (event.target.id === 'cycle-cylinder') { state.cylinder = Number(event.target.value); selectPart(`pistao-${state.cylinder}`, { keepPanel: true }); }
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'cycle-scrub') { state.angle = Number(event.target.value) * Math.PI / 180 + FIRING_ORDER.indexOf(state.cylinder) * Math.PI / 3; state.running = false; updateControls(); updateCycleUI(); }
  });
  const dialog = $('#guide-dialog');
  $('#help-button').addEventListener('click', () => dialog.showModal());
  $('#close-guide').addEventListener('click', () => dialog.close()); $('#guide-done').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  document.addEventListener('keydown', event => {
    if (dialog.open || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, select, textarea, button, a')) return;
    if (event.code === 'Space') { event.preventDefault(); state.running = !state.running; updateControls(); }
    if (event.key.toLowerCase() === 'r') resetView();
    if (event.key === 'Escape') selectPart(null);
    if (event.key.toLowerCase() === 'f' && state.selected) engine.focus(state.selected);
  });
}

try {
  engine = new EngineViewer($('#viewer'), $('#model-labels'), {
    select: id => selectPart(id),
    hover: (id, x, y) => {
      const tooltip = $('#hover-tooltip'); tooltip.hidden = !id;
      if (id) { tooltip.textContent = engine.partsById.get(id).name; tooltip.style.left = `${Math.min(x + 16, window.innerWidth - 245)}px`; tooltip.style.top = `${Math.min(y + 16, window.innerHeight - 60)}px`; }
    },
  });
  $('#total-parts').textContent = engine.parts.length;
  renderComponents(); renderInspector(); bindEvents(); updateControls();
  $('#viewer .loading').remove(); $('#viewer').dataset.ready = 'true';
  if (import.meta.env.DEV) window.__INTERA__ = { state, engine };
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastFrame) / 1000, 0.25); lastFrame = now;
    if (document.hidden) return;
    if (state.running) state.angle = (state.angle + dt * (state.rpm / 60) * TAU / 24) % (TAU * 2);
    const observed = state.panel === 'cycle' ? state.cylinder : null;
    engine.render(dt, state.angle, observed);
    if (now - lastUi > 80) { updateCycleUI(); lastUi = now; }
  }
  requestAnimationFrame(frame);
} catch (error) {
  console.error('Não foi possível iniciar o visualizador 3D:', error);
  $('#viewer').innerHTML = `<div class="viewer-error">${icon('info')}<h2>Precisamos de WebGL para explorar.</h2><p>Use uma versão atual do Chrome, Edge, Firefox ou Safari e ative a aceleração de hardware nas configurações do navegador.</p><button class="primary-button" onclick="location.reload()">Tentar novamente ${icon('reset')}</button></div>`;
  $('#footer-status').textContent = 'VISUALIZAÇÃO 3D INDISPONÍVEL';
}
