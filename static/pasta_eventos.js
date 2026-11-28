(() => {
  'use strict';

  const STORAGE_KEY = 'gps_nautico_pasta_eventos_v1';
  const FILE_KEY = 'gps_nautico_ficheiro_ativo_v1';
  const DEFAULT_GPX_NAME = 'pesqueiros.gpx';

  const TIPOS_MARCA = {
    geral: {
      chave: 'geral',
      icone: '📍',
      nome: 'Marca Atual',
      cor: '#2563eb',
      borda: '#93c5fd',
    },
    rocha: {
      chave: 'rocha',
      icone: '🪨',
      nome: 'Rocha',
      cor: '#57534e',
      borda: '#d6d3d1',
    },
    lula: {
      chave: 'lula',
      icone: '🦑',
      nome: 'Lula',
      cor: '#db2777',
      borda: '#f9a8d4',
    },
    peguilho: {
      chave: 'peguilho',
      icone: '🪝',
      nome: 'Peguilho',
      cor: '#d97706',
      borda: '#fcd34d',
    },
  };

  let eventos = [];
  let ficheiroAtivo = DEFAULT_GPX_NAME;
  let fileHandle = null;
  let tipoSelecionado = 'geral';
  let painelAberto = false;
  let modoCliqueMapa = false;
  let camadaEventos = null;
  let limiteVisivel = 80;
  let pontoOpcoesAtivoId = null;
  let tipoOpcoesSelecionado = 'geral';

  function obterMapa() {
    if (window.mapaGpsNautico && typeof window.mapaGpsNautico.on === 'function') {
      return window.mapaGpsNautico;
    }
    return null;
  }

  function escaparHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escaparXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function formatarDataHoraPonto(data = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()} ${pad(data.getHours())}:${pad(data.getMinutes())}`;
  }

  function normalizarTipoCategoria(tipoBruto, symBruto, descBruto) {
    const texto = `${tipoBruto || ''} ${symBruto || ''} ${descBruto || ''}`.toLowerCase();
    if (texto.includes('rocha') || texto.includes('pedra')) return 'rocha';
    if (texto.includes('lula') || texto.includes('choco')) return 'lula';
    if (texto.includes('peguilho') || texto.includes('preso') || texto.includes('enrosco')) return 'peguilho';
    return 'geral';
  }

  function ehPontoManual(p) {
    if (!p) return false;
    if (p.manual === true || p.origem === 'Manual') return true;
    const idStr = String(p.id || '');
    return idStr.startsWith('ev-') || idStr.startsWith('ev_') || idStr.startsWith('mob_') || idStr.startsWith('sync_');
  }

  function chaveUnicaCoord(p) {
    if (!p) return '';
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return `${lat.toFixed(5)}|${lon.toFixed(5)}`;
  }

  function deduplicarEventos(lista) {
    const vistos = new Set();
    const res = [];
    for (const item of lista) {
      const chave = chaveUnicaCoord(item);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);
      res.push(item);
    }
    return res;
  }

  function guardarLocal() {
    try {
      const apenasManuais = deduplicarEventos(eventos.filter(ehPontoManual));
      eventos = apenasManuais;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apenasManuais));
      localStorage.setItem(FILE_KEY, ficheiroAtivo || DEFAULT_GPX_NAME);
    } catch (_) {}
    if (window.BackupNautico && typeof window.BackupNautico.agendarSilencioso === 'function') {
      window.BackupNautico.agendarSilencioso();
    }
  }

  function carregarLocal() {
    try {
      const f = localStorage.getItem(FILE_KEY);
      if (f && f.trim()) ficheiroAtivo = f.trim();
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (!bruto) return [];
      const dados = JSON.parse(bruto);
      if (!Array.isArray(dados)) return [];
      const limpos = deduplicarEventos(dados.filter(ehPontoManual));
      if (limpos.length !== dados.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(limpos));
        } catch (_) {}
      }
      return limpos;
    } catch (_) {
      return [];
    }
  }

  function atualizarRotuloFicheiro() {
    const el = document.getElementById('pastaEventosFicheiroAtivo');
    if (el) {
      el.textContent = `📄 Ficheiro: ${ficheiroAtivo || DEFAULT_GPX_NAME}`;
      el.title = ficheiroAtivo || DEFAULT_GPX_NAME;
    }
  }

  function garantirCamada() {
    const m = obterMapa();
    if (!m || typeof L === 'undefined') return null;
    if (!camadaEventos) {
      camadaEventos = L.layerGroup().addTo(m);
    } else if (!m.hasLayer(camadaEventos)) {
      camadaEventos.addTo(m);
    }
    return camadaEventos;
  }

  function obterListaUnificada() {
    const lista = [];
    const chavesVistas = new Set();

    const adicionarSeUnico = (item) => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const chave = `${lat.toFixed(5)}|${lon.toFixed(5)}`;
      if (chavesVistas.has(chave)) return;
      chavesVistas.add(chave);
      const nome = String(item.nome || 'Ponto').trim();
      lista.push({ ...item, nome, lat, lon });
    };

    for (const ev of eventos) {
      adicionarSeUnico(ev);
    }

    const estGps = window.__vigilanteEstadoGps;
    if (estGps && Array.isArray(estGps.waypoints)) {
      for (const w of estGps.waypoints) {
        adicionarSeUnico(w);
      }
    }

    return lista;
  }

  function obterProximoNumeroSequencial() {
    return obterListaUnificada().length + 1;
  }

  function formatarNomeComNumero(numeroSeq, nomeManual, nomePadrao) {
    const limpo = String(nomeManual || '').trim();
    if (limpo) {
      return /^\d+\s*-/.test(limpo) ? limpo : `${numeroSeq} - ${limpo}`;
    }
    return `${numeroSeq} - ${nomePadrao}`;
  }

  function criarIconeLeaflet(tipo, simboloCustom, corCustom) {
    const info = TIPOS_MARCA[tipo] || TIPOS_MARCA.geral;
    const icone = simboloCustom || info.icone;
    const cor = corCustom || info.cor;
    return L.divIcon({
      className: 'pasta-evento-pin',
      html: `<div style="width:32px;height:32px;border-radius:50%;background:${cor};border:2px solid ${info.borda};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.45);color:#fff;">${icone}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }

  function renderizarMapa() {
    const camada = garantirCamada();
    if (!camada) return;
    camada.clearLayers();

    for (const ev of eventos) {
      if (!ehPontoManual(ev)) continue;
      const lat = Number(ev.lat);
      const lon = Number(ev.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const marker = L.marker([lat, lon], { icon: criarIconeLeaflet(ev.tipo, ev.simbolo, ev.cor) });
      marker.on('click', () => {
        window.abrirOpcoesPonto(ev.id);
      });
      camada.addLayer(marker);
    }
  }

  function renderizarLista() {
    const listaEl = document.getElementById('pastaEventosLista');
    const contadorEl = document.getElementById('pastaEventosContador');
    const btnPasta = document.getElementById('btnPastaEventos');
    const listaUnificada = obterListaUnificada();
    const totalUnificado = listaUnificada.length;
    if (contadorEl) contadorEl.textContent = String(totalUnificado);
    if (btnPasta) btnPasta.textContent = `📂 Pasta de Eventos (${totalUnificado})`;
    atualizarRotuloFicheiro();
    if (!listaEl) return;

    if (totalUnificado === 0) {
      listaEl.innerHTML = '<div style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">Ainda não há pontos gravados na Pasta de Eventos.</div>';
      return;
    }

    const visiveis = listaUnificada.slice(0, limiteVisivel);
    const restante = totalUnificado - visiveis.length;

    listaEl.innerHTML = visiveis
      .map((ev) => {
        const info = TIPOS_MARCA[ev.tipo] || TIPOS_MARCA.geral;
        const lat = Number(ev.lat).toFixed(5);
        const lon = Number(ev.lon).toFixed(5);
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#0f172a;border:1px solid #334155;border-left:4px solid ${ev.cor || info.cor};border-radius:8px;">
            <div onclick="window.centrarEventoGpsNautico('${escaparHtml(ev.id)}')" style="flex:1;min-width:0;cursor:pointer;" title="Clica para centrar na carta náutica">
              <div style="font-weight:700;font-size:13px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${ev.simbolo || info.icone} ${escaparHtml(ev.nome)}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                <span style="color:${info.borda};font-weight:600;">${escaparHtml(info.nome)}</span> · ${lat}, ${lon}
              </div>
              ${ev.nota ? `<div style="font-size:10.5px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">${escaparHtml(ev.nota)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button type="button" onclick="window.navegarEventoGpsNautico('${escaparHtml(ev.id)}')" style="padding:5px 8px;border:none;border-radius:6px;background:#0284c7;color:#fff;font-size:11px;font-weight:700;cursor:pointer;" title="Navegar para este ponto">
                🧭 Ir
              </button>
              <button type="button" class="btn-opcoes-evento" onclick="window.abrirOpcoesPonto('${escaparHtml(ev.id)}')" style="padding:5px 8px;border:1px solid #475569;border-radius:6px;background:#1e293b;color:#f8fafc;font-size:11px;font-weight:700;cursor:pointer;" title="Opções do ponto">
                ⚙️
              </button>
            </div>
          </div>
        `;
      })
      .join('') + (restante > 0
        ? `<button type="button" onclick="window.mostrarMaisEventosGpsNautico()" style="padding:8px;border:1px solid #334155;border-radius:8px;background:#1e293b;color:#93c5fd;font-size:12px;font-weight:700;cursor:pointer;">Mostrar mais (${restante} restantes)</button>`
        : '');
  }

  window.mostrarMaisEventosGpsNautico = function mostrarMaisEventosGpsNautico() {
    limiteVisivel += 100;
    renderizarLista();
  };

  function renderizarTudo() {
    renderizarMapa();
    renderizarLista();
  }

  window.atualizarContadorPastaEventos = function atualizarContadorPastaEventos() {
    renderizarLista();
  };

  function obterCoordenadasAtuais() {
    const posGps = window.__vigilanteEstadoGps && window.__vigilanteEstadoGps.posicao;
    if (posGps && Number.isFinite(posGps.lat) && Number.isFinite(posGps.lon)) {
      return { lat: posGps.lat, lon: posGps.lon };
    }
    const m = obterMapa();
    if (m) {
      const c = m.getCenter();
      return { lat: c.lat, lon: c.lng };
    }
    return { lat: 37.101, lon: -8.674 };
  }

  function formatarCoordGrausMin(valor, isLat) {
    const num = Number(valor);
    if (!Number.isFinite(num)) return '--';
    const dir = isLat ? (num >= 0 ? 'N' : 'S') : (num >= 0 ? 'E' : 'W');
    const abs = Math.abs(num);
    let graus = Math.floor(abs);
    let minsNum = (abs - graus) * 60;
    if (minsNum >= 59.9995) {
      graus += 1;
      minsNum = 0;
    }
    const mins = minsNum.toFixed(3).padStart(6, '0');
    const gPad = isLat ? String(graus).padStart(2, '0') : String(graus).padStart(3, '0');
    return `${gPad}° ${mins}' ${dir}`;
  }

  function parseCoordenadaNautica(texto, isLat) {
    if (texto === null || texto === undefined) return NaN;
    let s = String(texto).trim().toUpperCase();
    if (!s) return NaN;
    s = s.replace(/,/g, '.');

    let sinal = 1;
    const temNegativo = s.startsWith('-') || /\b[SWO]\b|[SWO]$/.test(s);
    const temPositivo = /\b[NE]\b|[NE]$/.test(s);
    if (temNegativo && !temPositivo) sinal = -1;

    const nums = s.replace(/[-+]/g, ' ').match(/\d+(?:\.\d+)?/g);
    if (!nums || nums.length === 0) return NaN;

    let resultado = NaN;
    if (nums.length === 1) {
      resultado = Number(nums[0]);
    } else if (nums.length === 2) {
      const graus = Number(nums[0]);
      const mins = Number(nums[1]);
      if (!Number.isFinite(graus) || !Number.isFinite(mins) || mins < 0 || mins >= 60) return NaN;
      resultado = graus + mins / 60;
    } else {
      const graus = Number(nums[0]);
      const mins = Number(nums[1]);
      const segs = Number(nums[2]);
      if (!Number.isFinite(graus) || !Number.isFinite(mins) || !Number.isFinite(segs) || mins < 0 || mins >= 60 || segs < 0 || segs >= 60) return NaN;
      resultado = graus + mins / 60 + segs / 3600;
    }

    if (!Number.isFinite(resultado)) return NaN;
    resultado = sinal * resultado;

    const limite = isLat ? 90 : 180;
    if (resultado < -limite || resultado > limite) return NaN;
    return resultado;
  }

  function notificarPonto(msg) {
    const toast = document.getElementById('toastNotificacao');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visivel');
      clearTimeout(window.__toastOpcoesPontoTimer);
      window.__toastOpcoesPontoTimer = setTimeout(() => toast.classList.remove('visivel'), 3000);
    }
  }

  window.selecionarTipoOpcoesPonto = function selecionarTipoOpcoesPonto(tipo, preservarCustom) {
    if (!TIPOS_MARCA[tipo]) return;
    tipoOpcoesSelecionado = tipo;
    document.querySelectorAll('.opcoes-tipo-btn').forEach((btn) => {
      btn.classList.toggle('ativo', btn.dataset.tipo === tipo);
    });
    const info = TIPOS_MARCA[tipo];
    if (!preservarCustom) {
      const selIcone = document.getElementById('opcoesPontoIcone');
      const inpCor = document.getElementById('opcoesPontoCor');
      if (selIcone) selIcone.value = info.icone;
      if (inpCor) inpCor.value = info.cor;
    }
    window.atualizarBadgeEdicaoMarca();
  };

  window.atualizarBadgeEdicaoMarca = function atualizarBadgeEdicaoMarca() {
    const badge = document.getElementById('opcoesPontoTipoBadge');
    if (!badge) return;
    const info = TIPOS_MARCA[tipoOpcoesSelecionado] || TIPOS_MARCA.geral;
    const selIcone = document.getElementById('opcoesPontoIcone');
    const icone = (selIcone && selIcone.value) ? selIcone.value : info.icone;
    badge.textContent = `${icone} ${info.nome}`;
  };

  window.atualizarPreviewCoordsEdicao = function atualizarPreviewCoordsEdicao() {
    const inpLat = document.getElementById('opcoesPontoLat');
    const inpLon = document.getElementById('opcoesPontoLon');
    const coordsNautEl = document.getElementById('opcoesPontoCoordsNaut');
    const coordsDecEl = document.getElementById('opcoesPontoCoordsDec');
    const lat = inpLat ? parseCoordenadaNautica(inpLat.value, true) : NaN;
    const lon = inpLon ? parseCoordenadaNautica(inpLon.value, false) : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      if (coordsNautEl) coordsNautEl.textContent = `${formatarCoordGrausMin(lat, true)} · ${formatarCoordGrausMin(lon, false)}`;
      if (coordsDecEl) coordsDecEl.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } else {
      if (coordsNautEl) coordsNautEl.textContent = '--';
      if (coordsDecEl) coordsDecEl.textContent = '--';
    }
  };

  function popularSelectMarcasEdicao(idSelecionado) {
    const sel = document.getElementById('opcoesPontoSelect');
    if (!sel) return;
    const lista = obterListaUnificada();
    sel.innerHTML = '';
    if (lista.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Nenhuma marca guardada';
      sel.appendChild(opt);
      return;
    }
    for (const item of lista) {
      const info = TIPOS_MARCA[item.tipo] || TIPOS_MARCA.geral;
      const icone = item.simbolo || (item.sym && Array.from(String(item.sym)).length <= 3 ? item.sym : info.icone);
      const opt = document.createElement('option');
      opt.value = String(item.id);
      opt.textContent = `${icone} ${item.nome}`;
      sel.appendChild(opt);
    }
    if (idSelecionado !== undefined && idSelecionado !== null) {
      sel.value = String(idSelecionado);
    }
  }

  window.abrirPainelAlterarMarca = function abrirPainelAlterarMarca(idPreferido) {
    const lista = obterListaUnificada();
    if (lista.length === 0) {
      notificarPonto('ℹ️ Ainda não há marcas guardadas para alterar.');
      return;
    }
    const idAlvo = idPreferido || lista[0].id;
    window.abrirOpcoesPonto(idAlvo);
  };

  window.selecionarMarcaEdicaoPorId = function selecionarMarcaEdicaoPorId(id) {
    if (!id) return;
    window.abrirOpcoesPonto(id);
  };

  window.cancelarConfirmacaoApagarPonto = function cancelarConfirmacaoApagarPonto() {
    const p1 = document.getElementById('opcoesPontoApagarPasso1');
    const p2 = document.getElementById('opcoesPontoApagarPasso2');
    if (p1) p1.style.display = 'block';
    if (p2) p2.style.display = 'none';
  };

  window.pedirConfirmacaoApagarPonto = function pedirConfirmacaoApagarPonto() {
    const p1 = document.getElementById('opcoesPontoApagarPasso1');
    const p2 = document.getElementById('opcoesPontoApagarPasso2');
    if (p1) p1.style.display = 'none';
    if (p2) p2.style.display = 'flex';
  };

  function encontrarPontoUnificadoPorId(id) {
    const emEventos = eventos.find((e) => String(e.id) === String(id));
    if (emEventos) return emEventos;
    const estGps = window.__vigilanteEstadoGps;
    if (estGps && Array.isArray(estGps.waypoints)) {
      return estGps.waypoints.find((w) => String(w.id) === String(id)) || null;
    }
    return null;
  }

  window.abrirOpcoesPonto = function abrirOpcoesPonto(id) {
    let ev = eventos.find((e) => String(e.id) === String(id));
    if (!ev) {
      const wpt = encontrarPontoUnificadoPorId(id);
      if (wpt && typeof window.abrirOpcoesPontoPorWaypoint === 'function') {
        window.abrirOpcoesPontoPorWaypoint(wpt);
        return;
      }
    }
    const modal = document.getElementById('opcoesPontoModal');
    if (!ev || !modal) return;

    pontoOpcoesAtivoId = ev.id;
    popularSelectMarcasEdicao(ev.id);

    const lat = Number(ev.lat);
    const lon = Number(ev.lon);
    const inpNome = document.getElementById('opcoesPontoNome');
    const inpLat = document.getElementById('opcoesPontoLat');
    const inpLon = document.getElementById('opcoesPontoLon');
    const inpNota = document.getElementById('opcoesPontoNota');
    const selIcone = document.getElementById('opcoesPontoIcone');
    const inpCor = document.getElementById('opcoesPontoCor');

    if (inpNome) inpNome.value = ev.nome || '';
    if (inpLat) inpLat.value = Number.isFinite(lat) ? formatarCoordGrausMin(lat, true) : '';
    if (inpLon) inpLon.value = Number.isFinite(lon) ? formatarCoordGrausMin(lon, false) : '';
    if (inpNota) inpNota.value = ev.nota || ev.desc || '';

    const tipoChave = TIPOS_MARCA[ev.tipo] ? ev.tipo : 'geral';
    const info = TIPOS_MARCA[tipoChave];
    const iconeAtual = ev.simbolo || (ev.sym && Array.from(String(ev.sym)).length <= 3 ? ev.sym : info.icone);
    const corAtual = ev.cor || info.cor;

    if (selIcone) {
      const existeOpcao = Array.from(selIcone.options).some((o) => o.value === iconeAtual);
      if (!existeOpcao && iconeAtual) {
        const opt = document.createElement('option');
        opt.value = iconeAtual;
        opt.textContent = `${iconeAtual} Personalizado`;
        selIcone.appendChild(opt);
      }
      selIcone.value = iconeAtual;
    }
    if (inpCor) {
      inpCor.value = /^#[0-9a-f]{6}$/i.test(String(corAtual)) ? corAtual : info.cor;
    }

    window.selecionarTipoOpcoesPonto(tipoChave, true);
    window.atualizarPreviewCoordsEdicao();
    window.cancelarConfirmacaoApagarPonto();
    modal.style.display = 'flex';
  };

  window.abrirOpcoesPontoPorWaypoint = function abrirOpcoesPontoPorWaypoint(wpt) {
    if (!wpt) return;
    const latNum = Number(wpt.lat);
    const lonNum = Number(wpt.lon);
    const nomeLow = String(wpt.nome || '').trim().toLowerCase();

    let ev = eventos.find((e) => String(e.id) === String(wpt.id));
    if (!ev && Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      ev = eventos.find(
        (e) =>
          Math.abs(Number(e.lat) - latNum) < 0.00002 &&
          Math.abs(Number(e.lon) - lonNum) < 0.00002 &&
          (!nomeLow || String(e.nome || '').trim().toLowerCase() === nomeLow)
      );
    }
    if (!ev && Number.isFinite(latNum) && Number.isFinite(lonNum)) {
      const tipoInferido = normalizarTipoCategoria(wpt.tipo, wpt.sym, wpt.desc);
      const info = TIPOS_MARCA[tipoInferido] || TIPOS_MARCA.geral;
      ev = {
        id: wpt.id || `gpx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        nome: String(wpt.nome || 'Ponto GPX').trim(),
        tipo: tipoInferido,
        simbolo: (wpt.sym && Array.from(String(wpt.sym)).length <= 3) ? wpt.sym : info.icone,
        cor: wpt.cor || info.cor,
        lat: Number(latNum.toFixed(6)),
        lon: Number(lonNum.toFixed(6)),
        nota: wpt.desc ? String(wpt.desc).trim() : '',
        criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
        origem: ficheiroAtivo || DEFAULT_GPX_NAME,
      };
      eventos.push(ev);
    }
    if (ev) {
      window.abrirOpcoesPonto(ev.id);
    }
  };

  window.fecharOpcoesPonto = function fecharOpcoesPonto() {
    pontoOpcoesAtivoId = null;
    const modal = document.getElementById('opcoesPontoModal');
    if (modal) modal.style.display = 'none';
    window.cancelarConfirmacaoApagarPonto();
  };

  window.guardarOpcoesPonto = function guardarOpcoesPonto() {
    if (!pontoOpcoesAtivoId) return;
    const ev = eventos.find((e) => String(e.id) === String(pontoOpcoesAtivoId));
    if (!ev) return;

    const inpNome = document.getElementById('opcoesPontoNome');
    const inpLat = document.getElementById('opcoesPontoLat');
    const inpLon = document.getElementById('opcoesPontoLon');
    const inpNota = document.getElementById('opcoesPontoNota');
    const selIcone = document.getElementById('opcoesPontoIcone');
    const inpCor = document.getElementById('opcoesPontoCor');

    const novoNome = inpNome ? inpNome.value.trim() : '';
    if (!novoNome) {
      notificarPonto('⚠️ Indica o nome da marca.');
      if (inpNome) inpNome.focus();
      return;
    }

    const novaLat = inpLat ? parseCoordenadaNautica(inpLat.value, true) : Number(ev.lat);
    const novaLon = inpLon ? parseCoordenadaNautica(inpLon.value, false) : Number(ev.lon);
    if (!Number.isFinite(novaLat) || !Number.isFinite(novaLon)) {
      notificarPonto('⚠️ Latitude ou Longitude inválida. Usa Graus Min (ex: 37° 04.520\' N) ou decimal.');
      return;
    }

    const latAntiga = ev.lat;
    const lonAntiga = ev.lon;
    const nomeAntigo = ev.nome;
    const novaNota = inpNota ? inpNota.value.trim() : '';
    const info = TIPOS_MARCA[tipoOpcoesSelecionado] || TIPOS_MARCA.geral;
    const novoIcone = (selIcone && selIcone.value) ? selIcone.value : info.icone;
    const novaCor = (inpCor && inpCor.value) ? inpCor.value : info.cor;

    ev.nome = novoNome;
    ev.lat = Number(novaLat.toFixed(7));
    ev.lon = Number(novaLon.toFixed(7));
    ev.tipo = info.chave;
    ev.simbolo = novoIcone;
    ev.cor = novaCor;
    ev.nota = novaNota;
    ev.manual = true;

    guardarLocal();
    renderizarTudo();
    if (typeof window.atualizarWaypointPorCoordenadas === 'function') {
      window.atualizarWaypointPorCoordenadas(ev.id, latAntiga, lonAntiga, nomeAntigo, ev.nome, ev.nota, ev.lat, ev.lon, ev.simbolo, ev.cor);
    }
    window.fecharOpcoesPonto();
    notificarPonto(`💾 Alterações guardadas: ${ev.nome}`);
  };

  window.navegarOpcoesPonto = function navegarOpcoesPonto() {
    if (!pontoOpcoesAtivoId) return;
    const idAlvo = pontoOpcoesAtivoId;
    window.fecharOpcoesPonto();
    window.navegarEventoGpsNautico(idAlvo);
  };

  window.registarDiarioOpcoesPonto = function registarDiarioOpcoesPonto() {
    if (!pontoOpcoesAtivoId) return;
    const ev = eventos.find((e) => String(e.id) === String(pontoOpcoesAtivoId));
    window.fecharOpcoesPonto();
    window.alternarPastaEventos(false);
    if (ev && window.DiarioPesca && typeof window.DiarioPesca.abrirNovoComPesqueiro === 'function') {
      window.DiarioPesca.abrirNovoComPesqueiro(ev.nome, ev.lat, ev.lon);
    }
  };

  window.confirmarApagarOpcoesPonto = function confirmarApagarOpcoesPonto() {
    if (!pontoOpcoesAtivoId) return;
    const idAlvo = pontoOpcoesAtivoId;
    const ev = eventos.find((e) => String(e.id) === String(idAlvo));
    eventos = eventos.filter((e) => String(e.id) !== String(idAlvo));
    window.fecharOpcoesPonto();
    guardarLocal();
    renderizarTudo();
    if (ev && typeof window.removerWaypointPorCoordenadas === 'function') {
      window.removerWaypointPorCoordenadas(ev.id, ev.lat, ev.lon, ev.nome);
    }
    notificarPonto(`🗑️ Ponto apagado: ${ev ? ev.nome : 'Marca'}`);
  };

  window.recarregarPastaEventosLocal = function recarregarPastaEventosLocal() {
    eventos = carregarLocal();
    window.fecharOpcoesPonto();
    renderizarTudo();
  };

  function adicionarEvento(lat, lon) {
    const info = TIPOS_MARCA[tipoSelecionado] || TIPOS_MARCA.geral;
    const inputNome = document.getElementById('pastaEventoNome');
    const nomeManual = inputNome ? inputNome.value.trim() : '';
    const numeroSeq = obterProximoNumeroSequencial();
    const agora = new Date();
    const dataHora = formatarDataHoraPonto(agora);
    const nomeFinal = formatarNomeComNumero(numeroSeq, nomeManual, `${info.nome} (${dataHora})`);
    const notaAuto = `Marcado em ${dataHora}`;

    const novo = {
      id: `ev-${agora.getTime()}-${Math.floor(Math.random() * 1000)}`,
      nome: nomeFinal,
      tipo: info.chave,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      nota: notaAuto,
      manual: true,
      criadoEmTs: agora.getTime(),
      criado_em: agora.toISOString().slice(0, 19).replace('T', ' '),
      origem: ficheiroAtivo || DEFAULT_GPX_NAME,
    };

    eventos.unshift(novo);
    guardarLocal();
    renderizarTudo();

    if (typeof window.adicionarWaypointPrincipal === 'function') {
      window.adicionarWaypointPrincipal({
        id: novo.id,
        nome: novo.nome,
        lat: novo.lat,
        lon: novo.lon,
        desc: novo.nota,
        sym: info.nome,
        tipo: novo.tipo,
        origem: 'Manual',
        manual: true,
        criadoEmTs: novo.criadoEmTs,
      }, { noTopo: true, renderizarNoMapa: true });
    }

    if (inputNome) inputNome.value = '';
    if (window.SyncGithubNautico && typeof window.SyncGithubNautico.notificarPontoNovoLocal === 'function') {
      window.SyncGithubNautico.notificarPontoNovoLocal();
    }
    notificarPonto(`✅ Ponto gravado: ${novo.nome}`);
  }

  function gerarConteudoGpx() {
    const linhas = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="GPS Nautico - Lista Unificada" xmlns="http://www.topografix.com/GPX/1/1">',
    ];

    const listaUnificada = obterListaUnificada();

    for (const ev of listaUnificada) {
      const info = TIPOS_MARCA[ev.tipo] || TIPOS_MARCA.geral;
      const sym = ev.sym || ev.simbolo || info.nome;
      const desc = ev.nota || ev.desc || info.nome;
      linhas.push(`  <wpt lat="${ev.lat.toFixed(6)}" lon="${ev.lon.toFixed(6)}">`);
      if (ev.ele !== null && ev.ele !== undefined && Number.isFinite(Number(ev.ele))) {
        linhas.push(`    <ele>${Number(ev.ele)}</ele>`);
      }
      linhas.push(`    <name>${escaparXml(ev.nome)}</name>`);
      linhas.push(`    <type>${escaparXml(info.chave)}</type>`);
      linhas.push(`    <sym>${escaparXml(sym)}</sym>`);
      linhas.push(`    <desc>${escaparXml(desc)}</desc>`);
      linhas.push('  </wpt>');
    }

    linhas.push('</gpx>');
    return linhas.join('\n') + '\n';
  }

  window.integrarGpxNaPastaEventos = function integrarGpxNaPastaEventos(waypoints, nomeFicheiro) {
    if (nomeFicheiro && String(nomeFicheiro).trim()) {
      const limpo = String(nomeFicheiro).trim();
      ficheiroAtivo = limpo.toLowerCase().endsWith('.gpx') ? limpo : `${limpo}.gpx`;
      fileHandle = null;
    }

    let alterouManuais = false;
    if (Array.isArray(waypoints) && waypoints.length > 0) {
      const chavesExistentes = new Set(eventos.map(chaveUnicaCoord).filter(Boolean));

      for (let i = waypoints.length - 1; i >= 0; i--) {
        const w = waypoints[i];
        if (!ehPontoManual(w)) continue;
        const lat = Number(w.lat);
        const lon = Number(w.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const chave = chaveUnicaCoord({ lat, lon });
        if (!chave || chavesExistentes.has(chave)) continue;
        chavesExistentes.add(chave);

        const nome = String(w.nome || 'Ponto GPX').trim();
        eventos.unshift({
          id: w.id || `gpx-${Date.now()}-${i}`,
          nome,
          tipo: normalizarTipoCategoria(w.tipo, w.sym, w.desc),
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
          ele: w.ele ?? null,
          sym: w.sym || '',
          nota: w.desc ? String(w.desc).trim() : (w.nota ? String(w.nota).trim() : ''),
          manual: true,
          criadoEmTs: Number(w.criadoEmTs) || Date.now(),
          criado_em: w.criado_em || new Date().toISOString().slice(0, 19).replace('T', ' '),
          origem: 'Manual',
        });
        alterouManuais = true;
      }
    }

    if (alterouManuais) {
      guardarLocal();
    } else {
      try {
        localStorage.setItem(FILE_KEY, ficheiroAtivo || DEFAULT_GPX_NAME);
      } catch (_) {}
    }
    renderizarTudo();
  };

  window.guardarGpxAtualizado = async function guardarGpxAtualizado() {
    const nomeDownload = ficheiroAtivo || DEFAULT_GPX_NAME;
    const conteudoGpx = gerarConteudoGpx();

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        if (!fileHandle) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: nomeDownload,
            types: [
              {
                description: 'Ficheiro GPX Náutico',
                accept: { 'application/gpx+xml': ['.gpx'] },
              },
            ],
          });
        }
        const writable = await fileHandle.createWritable();
        await writable.write(conteudoGpx);
        await writable.close();
        if (fileHandle.name) {
          ficheiroAtivo = fileHandle.name;
          guardarLocal();
          atualizarRotuloFicheiro();
        }
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        fileHandle = null;
      }
    }

    const blob = new Blob([conteudoGpx], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeDownload;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  window.alternarPastaEventos = function alternarPastaEventos(forcarEstado) {
    const painel = document.getElementById('pastaEventosPainel');
    const btn = document.getElementById('btnPastaEventos');
    if (!painel) return;

    painelAberto = typeof forcarEstado === 'boolean' ? forcarEstado : !painelAberto;
    painel.style.display = painelAberto ? 'flex' : 'none';
    if (btn) {
      btn.style.boxShadow = painelAberto ? '0 0 0 2px #fde68a' : '';
    }
    if (!painelAberto && modoCliqueMapa) {
      window.alternarModoCliqueEvento(false);
    }
  };

  window.selecionarTipoMarcaEvento = function selecionarTipoMarcaEvento(tipo) {
    if (!TIPOS_MARCA[tipo]) return;
    tipoSelecionado = tipo;
    document.querySelectorAll('.btn-tipo-marca').forEach((b) => {
      const ativo = b.dataset.tipo === tipo;
      const info = TIPOS_MARCA[b.dataset.tipo];
      b.style.background = ativo ? info.cor : '#1e293b';
      b.style.borderColor = ativo ? info.borda : '#334155';
      b.style.color = '#ffffff';
    });
  };

  window.marcarRapidoAorus = function marcarRapidoAorus(simbolo, nomeBase, cor, categoria) {
    const { lat, lon } = obterCoordenadasAtuais();
    const tipo = TIPOS_MARCA[categoria] ? categoria : 'geral';
    const numeroSeq = obterProximoNumeroSequencial();
    const inputNome = document.getElementById('pastaEventoNome');
    const nomeManual = inputNome ? inputNome.value.trim() : '';
    const agora = new Date();
    const dataHora = formatarDataHoraPonto(agora);
    const nomeFinal = formatarNomeComNumero(numeroSeq, nomeManual, `${nomeBase} (${dataHora})`);
    const novo = {
      id: `ev_${agora.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
      tipo,
      simbolo: simbolo || TIPOS_MARCA[tipo].icone,
      cor: cor || TIPOS_MARCA[tipo].cor,
      nome: nomeFinal,
      lat: Number(lat),
      lon: Number(lon),
      nota: `Marcado em ${dataHora}`,
      manual: true,
      criadoEmTs: agora.getTime(),
      criado_em: agora.toISOString().slice(0, 19).replace('T', ' '),
      criadoEm: agora.toISOString(),
    };
    if (inputNome) inputNome.value = '';
    eventos.unshift(novo);
    guardarLocal();
    renderizarTudo();

    if (typeof window.adicionarWaypointPrincipal === 'function') {
      window.adicionarWaypointPrincipal({
        id: novo.id,
        nome: novo.nome,
        lat: novo.lat,
        lon: novo.lon,
        desc: novo.nota,
        sym: novo.simbolo,
        tipo: novo.tipo,
        origem: 'Manual',
        manual: true,
        criadoEmTs: novo.criadoEmTs,
      }, { noTopo: true, renderizarNoMapa: true });
    }

    if (window.SyncGithubNautico && typeof window.SyncGithubNautico.notificarPontoNovoLocal === 'function') {
      window.SyncGithubNautico.notificarPontoNovoLocal();
    }

    notificarPonto(`✅ Ponto gravado: ${novo.nome}`);
  };

  window.exportarELimparGpxEventos = async function exportarELimparGpxEventos() {
    if (eventos.length === 0) {
      alert('Ainda não há pontos na Pasta de Eventos para exportar.');
      return;
    }
    await window.guardarGpxAtualizado();
    if (confirm('GPX exportado! Queres limpar os pontos da Pasta de Eventos agora?')) {
      eventos = [];
      guardarLocal();
      renderizarTudo();
    }
  };

  window.marcarEventoAtual = function marcarEventoAtual() {
    const coords = obterCoordenadasAtuais();
    adicionarEvento(coords.lat, coords.lon);
  };

  window.alternarModoCliqueEvento = function alternarModoCliqueEvento(forcarEstado) {
    const btn = document.getElementById('btnModoCliqueEvento');
    const m = obterMapa();
    modoCliqueMapa = typeof forcarEstado === 'boolean' ? forcarEstado : !modoCliqueMapa;
    if (btn) {
      btn.style.background = modoCliqueMapa ? '#16a34a' : '#1e293b';
      btn.style.borderColor = modoCliqueMapa ? '#86efac' : '#475569';
      btn.textContent = modoCliqueMapa ? '✅ Clica na Carta...' : '🗺️ Clicar na Carta';
    }
    if (m) {
      m.getContainer().style.cursor = modoCliqueMapa ? 'crosshair' : '';
    }
  };

  window.centrarEventoGpsNautico = function centrarEventoGpsNautico(id) {
    const ev = encontrarPontoUnificadoPorId(id);
    const m = obterMapa();
    if (!ev || !m) return;
    if (typeof window.alternarModoGps === 'function') {
      window.alternarModoGps('nautico');
    }
    m.setView([Number(ev.lat), Number(ev.lon)], Math.max(m.getZoom(), 14));
  };

  window.navegarEventoGpsNautico = function navegarEventoGpsNautico(id) {
    const ev = encontrarPontoUnificadoPorId(id);
    const estado = window.__vigilanteEstadoGps;
    if (!ev || !estado) return;
    const alvo = {
      id: ev.id,
      nome: ev.nome,
      lat: Number(ev.lat),
      lon: Number(ev.lon),
      camada: null
    };
    estado.waypointAtivo = alvo;
    const banner = document.getElementById('navBanner');
    const nomeEl = document.getElementById('navTargetNome');
    if (banner && nomeEl) {
      nomeEl.textContent = `⚓ ${alvo.nome}`;
      banner.style.display = 'block';
    }
    window.alternarPastaEventos(false);
    if (typeof window.atualizarPainelAorus === 'function') {
      window.atualizarPainelAorus();
    }
  };

  window.removerEventoPorCoordenadas = function removerEventoPorCoordenadas(id, lat, lon, nome) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const nomeLow = String(nome || '').trim().toLowerCase();
    const antes = eventos.length;

    eventos = eventos.filter((e) => {
      const mesmoId = id && String(e.id) === String(id);
      const mesmaCoord = Number.isFinite(latNum) && Number.isFinite(lonNum)
        && Math.abs(Number(e.lat) - latNum) < 0.00002
        && Math.abs(Number(e.lon) - lonNum) < 0.00002
        && (!nomeLow || String(e.nome || '').trim().toLowerCase() === nomeLow);
      return !(mesmoId || mesmaCoord);
    });

    if (eventos.length !== antes) {
      guardarLocal();
      renderizarTudo();
    }
  };

  window.apagarEventoGpsNautico = function apagarEventoGpsNautico(id) {
    const ev = eventos.find((e) => String(e.id) === String(id));
    const nome = ev ? ev.nome : 'esta marca';
    if (!confirm(`Queres mesmo apagar "${nome}"?`)) return;

    eventos = eventos.filter((e) => String(e.id) !== String(id));
    guardarLocal();
    renderizarTudo();

    if (ev && typeof window.removerWaypointPorCoordenadas === 'function') {
      window.removerWaypointPorCoordenadas(ev.id, ev.lat, ev.lon, ev.nome);
    }
  };

  function ligarAoMapaQuandoPronto(tentativas = 0) {
    const m = obterMapa();
    if (!m) {
      if (tentativas < 25) {
        setTimeout(() => ligarAoMapaQuandoPronto(tentativas + 1), 150);
      }
      return;
    }
    m.on('click', (e) => {
      if (!modoCliqueMapa) return;
      adicionarEvento(e.latlng.lat, e.latlng.lng);
      window.alternarModoCliqueEvento(false);
    });
    renderizarTudo();
  }

  function inicializar() {
    eventos = carregarLocal();
    window.selecionarTipoMarcaEvento('geral');
    atualizarRotuloFicheiro();
    ligarAoMapaQuandoPronto();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
