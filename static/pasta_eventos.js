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

  function normalizarTipoCategoria(tipoBruto, symBruto, descBruto) {
    const texto = `${tipoBruto || ''} ${symBruto || ''} ${descBruto || ''}`.toLowerCase();
    if (texto.includes('rocha') || texto.includes('pedra')) return 'rocha';
    if (texto.includes('lula') || texto.includes('choco')) return 'lula';
    if (texto.includes('peguilho') || texto.includes('preso') || texto.includes('enrosco')) return 'peguilho';
    return 'geral';
  }

  function guardarLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos));
      localStorage.setItem(FILE_KEY, ficheiroAtivo || DEFAULT_GPX_NAME);
    } catch (_) {}
  }

  function carregarLocal() {
    try {
      const f = localStorage.getItem(FILE_KEY);
      if (f && f.trim()) ficheiroAtivo = f.trim();
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (!bruto) return [];
      const dados = JSON.parse(bruto);
      return Array.isArray(dados) ? dados : [];
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
    }
    return camadaEventos;
  }

  function criarIconeLeaflet(tipo) {
    const info = TIPOS_MARCA[tipo] || TIPOS_MARCA.geral;
    return L.divIcon({
      className: 'pasta-evento-pin',
      html: `<div style="width:32px;height:32px;border-radius:50%;background:${info.cor};border:2px solid ${info.borda};display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.45);color:#fff;">${info.icone}</div>`,
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
      const lat = Number(ev.lat);
      const lon = Number(ev.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const info = TIPOS_MARCA[ev.tipo] || TIPOS_MARCA.geral;
      const marker = L.marker([lat, lon], { icon: criarIconeLeaflet(ev.tipo) });
      const popupHtml = `
        <div style="min-width:190px;font-family:system-ui,sans-serif;">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${info.icone} ${escaparHtml(ev.nome)}</div>
          <div style="font-size:12px;color:#475569;margin-bottom:4px;">Tipo: <strong>${escaparHtml(info.nome)}</strong></div>
          <div style="font-size:12px;font-family:monospace;color:#0f172a;margin-bottom:8px;">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
          <button type="button" onclick="window.apagarEventoGpsNautico('${escaparHtml(ev.id)}')" style="width:100%;padding:6px 10px;border:none;border-radius:6px;background:#dc2626;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">
            🗑️ Apagar
          </button>
        </div>
      `;
      marker.bindPopup(popupHtml);
      camada.addLayer(marker);
    }
  }

  function renderizarLista() {
    const listaEl = document.getElementById('pastaEventosLista');
    const contadorEl = document.getElementById('pastaEventosContador');
    if (contadorEl) contadorEl.textContent = String(eventos.length);
    atualizarRotuloFicheiro();
    if (!listaEl) return;

    if (eventos.length === 0) {
      listaEl.innerHTML = '<div style="padding:12px;text-align:center;color:#94a3b8;font-size:12px;">Ainda não há pontos gravados na Pasta de Eventos.</div>';
      return;
    }

    listaEl.innerHTML = eventos
      .map((ev) => {
        const info = TIPOS_MARCA[ev.tipo] || TIPOS_MARCA.geral;
        const lat = Number(ev.lat).toFixed(5);
        const lon = Number(ev.lon).toFixed(5);
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:#0f172a;border:1px solid #334155;border-left:4px solid ${info.cor};border-radius:8px;">
            <div onclick="window.centrarEventoGpsNautico('${escaparHtml(ev.id)}')" style="flex:1;min-width:0;cursor:pointer;" title="Clica para centrar na carta náutica">
              <div style="font-weight:700;font-size:13px;color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${info.icone} ${escaparHtml(ev.nome)}
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                <span style="color:${info.borda};font-weight:600;">${escaparHtml(info.nome)}</span> · ${lat}, ${lon}
              </div>
            </div>
            <button type="button" onclick="window.apagarEventoGpsNautico('${escaparHtml(ev.id)}')" style="padding:5px 8px;border:none;border-radius:6px;background:#991b1b;color:#fff;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;" title="Apagar este ponto">
              🗑️ Apagar
            </button>
          </div>
        `;
      })
      .join('');
  }

  function renderizarTudo() {
    renderizarMapa();
    renderizarLista();
  }

  function obterCoordenadasAtuais() {
    const m = obterMapa();
    if (m) {
      const c = m.getCenter();
      return { lat: c.lat, lon: c.lng };
    }
    return { lat: 37.101, lon: -8.674 };
  }

  function adicionarEvento(lat, lon) {
    const info = TIPOS_MARCA[tipoSelecionado] || TIPOS_MARCA.geral;
    const inputNome = document.getElementById('pastaEventoNome');
    const nomeManual = inputNome ? inputNome.value.trim() : '';
    const contadorTipo = eventos.filter((e) => e.tipo === info.chave).length + 1;
    const nomeFinal = nomeManual || `${info.nome} #${contadorTipo}`;

    const novo = {
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nome: nomeFinal,
      tipo: info.chave,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
      origem: ficheiroAtivo || DEFAULT_GPX_NAME,
    };

    eventos.unshift(novo);
    guardarLocal();
    renderizarTudo();
    if (inputNome) inputNome.value = '';
  }

  function gerarConteudoGpx() {
    const linhas = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="GPS Nautico - Pasta de Eventos" xmlns="http://www.topografix.com/GPX/1/1">',
    ];

    for (const ev of eventos) {
      const lat = Number(ev.lat);
      const lon = Number(ev.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const info = TIPOS_MARCA[ev.tipo] || TIPOS_MARCA.geral;
      linhas.push(`  <wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}">`);
      linhas.push(`    <name>${escaparXml(ev.nome)}</name>`);
      linhas.push(`    <type>${escaparXml(info.chave)}</type>`);
      linhas.push(`    <sym>${escaparXml(info.nome)}</sym>`);
      linhas.push(`    <desc>${escaparXml(info.nome)}</desc>`);
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

    if (Array.isArray(waypoints) && waypoints.length > 0) {
      const chavesExistentes = new Set(
        eventos.map((e) => `${String(e.nome || '').trim().toLowerCase()}|${Number(e.lat).toFixed(5)}|${Number(e.lon).toFixed(5)}`)
      );

      for (let i = waypoints.length - 1; i >= 0; i--) {
        const w = waypoints[i];
        const lat = Number(w.lat);
        const lon = Number(w.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const nome = String(w.nome || 'Ponto GPX').trim();
        const chave = `${nome.toLowerCase()}|${lat.toFixed(5)}|${lon.toFixed(5)}`;
        if (chavesExistentes.has(chave)) continue;
        chavesExistentes.add(chave);

        eventos.push({
          id: w.id || `gpx-${Date.now()}-${i}`,
          nome,
          tipo: normalizarTipoCategoria(w.tipo, w.sym, w.desc),
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
          criado_em: new Date().toISOString().slice(0, 19).replace('T', ' '),
          origem: ficheiroAtivo,
        });
      }
    }

    guardarLocal();
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
    const ev = eventos.find((e) => String(e.id) === String(id));
    const m = obterMapa();
    if (!ev || !m) return;
    m.setView([Number(ev.lat), Number(ev.lon)], Math.max(m.getZoom(), 14));
  };

  window.apagarEventoGpsNautico = function apagarEventoGpsNautico(id) {
    const ev = eventos.find((e) => String(e.id) === String(id));
    const nome = ev ? ev.nome : 'esta marca';
    if (!confirm(`Queres mesmo apagar "${nome}"?`)) return;

    eventos = eventos.filter((e) => String(e.id) !== String(id));
    guardarLocal();
    renderizarTudo();
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
