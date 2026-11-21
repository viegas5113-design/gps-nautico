/**
 * Diário de Pesca com Memória Futura — 100% Offline (HTML/JS/CSS + localStorage)
 * Chave permanente: gps_nautico_diario_pesca_v1
 */
(() => {
  const CHAVE_DIARIO = 'gps_nautico_diario_pesca_v1';
  const CHAVE_PASTA_EVENTOS = 'vigilante_pasta_eventos_v1';
  const RAIO_PROXIMIDADE_M = 250;
  const COOLDOWN_PROXIMIDADE_MS = 10 * 60 * 1000; // 10 min por pesqueiro

  let registos = [];
  let filtroTexto = '';
  let formularioAberto = false;
  let idEdicao = null;
  let ultimoAvisoPorLocal = {}; // { chaveLocal: timestamp }
  let ultimaChaveProximidadeAtiva = null;

  const ESPECIES_RAPIDAS = ['Lula', 'Choco', 'Pargo', 'Safia', 'Robalo', 'Polvo', 'Outros'];
  const ARTES_RAPIDAS = ['Toneiras/Palhaços', 'Rede de Emalhar', 'Cana/Chumbadinha', 'Palangre', 'Covos'];
  const MARES_RAPIDAS = ['Enchente', 'Vazante', 'Estofo'];
  const ESTADOS_MAR = ['Chão', 'Marezia', 'Picado', 'Vaga'];

  function escaparHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function notificar(msg) {
    const toast = document.getElementById('toastNotificacao');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visivel');
      clearTimeout(window.__toastDiarioTimer);
      window.__toastDiarioTimer = setTimeout(() => toast.classList.remove('visivel'), 3200);
    }
  }

  // ==========================================
  // CÁLCULO ASTRONÓMICO DA FASE DA LUA
  // ==========================================
  function calcularFaseLua(dataStr) {
    const base = dataStr ? new Date(`${dataStr}T12:00:00Z`) : new Date();
    const ms = isNaN(base.getTime()) ? Date.now() : base.getTime();
    // Lua Nova de referência conhecida: 2000-01-06 18:14 UTC
    const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
    const cicloSinodico = 29.53058867;
    const dias = (ms - ref) / 86400000;
    let idade = dias % cicloSinodico;
    if (idade < 0) idade += cicloSinodico;
    const fracao = idade / cicloSinodico;

    if (fracao < 0.125 || fracao >= 0.875) {
      return { nome: 'Lua Nova', emoji: '🌑', idadeDias: Math.round(idade) };
    }
    if (fracao < 0.375) {
      return { nome: 'Quarto Crescente', emoji: '🌓', idadeDias: Math.round(idade) };
    }
    if (fracao < 0.625) {
      return { nome: 'Lua Cheia', emoji: '🌕', idadeDias: Math.round(idade) };
    }
    return { nome: 'Quarto Minguante', emoji: '🌗', idadeDias: Math.round(idade) };
  }

  function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function carregarRegistos() {
    try {
      const bruto = localStorage.getItem(CHAVE_DIARIO);
      const parsed = bruto ? JSON.parse(bruto) : [];
      registos = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      registos = [];
    }
  }

  function guardarRegistos() {
    try {
      localStorage.setItem(CHAVE_DIARIO, JSON.stringify(registos));
    } catch (e) {
      notificar('⚠️ Erro ao guardar Diário no armazenamento local.');
    }
    if (window.BackupNautico && typeof window.BackupNautico.agendarSilencioso === 'function') {
      window.BackupNautico.agendarSilencioso();
    }
  }

  function obterPosicaoGpsAtual() {
    const est = window.__vigilanteEstadoGps;
    if (est && est.posicao && Number.isFinite(est.posicao.lat) && Number.isFinite(est.posicao.lon)) {
      return { lat: est.posicao.lat, lon: est.posicao.lon };
    }
    return null;
  }

  function obterPesqueirosDisponiveis() {
    const lista = [];
    const vistos = new Set();

    // 1. Pasta de Eventos (localStorage)
    try {
      const bruto = localStorage.getItem(CHAVE_PASTA_EVENTOS);
      const eventos = bruto ? JSON.parse(bruto) : [];
      if (Array.isArray(eventos)) {
        eventos.forEach((ev) => {
          if (Number.isFinite(Number(ev.lat)) && Number.isFinite(Number(ev.lon))) {
            const nome = (ev.nome || 'Evento').trim();
            const chave = `${nome}|${Number(ev.lat).toFixed(4)}|${Number(ev.lon).toFixed(4)}`;
            if (!vistos.has(chave)) {
              vistos.add(chave);
              lista.push({
                id: ev.id || chave,
                nome,
                lat: Number(ev.lat),
                lon: Number(ev.lon),
                origem: 'Pasta de Eventos'
              });
            }
          }
        });
      }
    } catch (_) {}

    // 2. Waypoints GPX carregados no GPS
    const est = window.__vigilanteEstadoGps;
    if (est && Array.isArray(est.waypoints)) {
      est.waypoints.forEach((w) => {
        if (Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lon))) {
          const nome = (w.nome || 'Waypoint').trim();
          const chave = `${nome}|${Number(w.lat).toFixed(4)}|${Number(w.lon).toFixed(4)}`;
          if (!vistos.has(chave)) {
            vistos.add(chave);
            lista.push({
              id: w.id || chave,
              nome,
              lat: Number(w.lat),
              lon: Number(w.lon),
              origem: 'GPX'
            });
          }
        }
      });
    }
    return lista;
  }

  // ==========================================
  // MEMÓRIA FUTURA: SAZONAL, LUNAR E AGENDADA
  // ==========================================
  function calcularSugestoesMemoriaFutura() {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().slice(0, 10);
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const luaHoje = calcularFaseLua(hojeStr).nome;

    const lembretesProximos = [];
    const sazonaisELunares = [];

    registos.forEach((r) => {
      // 1. Lembretes futuros agendados (-3 dias até +14 dias)
      if (r.lembreteData) {
        const dLemb = new Date(`${r.lembreteData}T12:00:00`);
        const diffDias = Math.round((dLemb - hoje) / 86400000);
        if (diffDias >= -3 && diffDias <= 14) {
          lembretesProximos.push({ registo: r, diffDias });
        }
      }

      // 2. Boas capturas no mesmo mês ou na mesma fase da lua
      const ehBoa = r.qualidade === 'boa' || (r.quantidade && !/^\s*0\b/.test(r.quantidade));
      if (!ehBoa) return;

      const partesData = String(r.data || '').split('-');
      const anoReg = Number(partesData[0]);
      const mesReg = Number(partesData[1]);
      const mesmoMes = mesReg === mesAtual && (anoReg !== anoAtual || r.data !== hojeStr);
      const mesmaLua = r.faseLua === luaHoje && r.data !== hojeStr;

      if (mesmoMes || mesmaLua) {
        const motivos = [];
        if (mesmoMes) motivos.push(anoReg < anoAtual ? `Mês (${mesReg}/${anoReg})` : 'Mesma época');
        if (mesmaLua) motivos.push(`${calcularFaseLua(r.data).emoji} ${luaHoje}`);
        sazonaisELunares.push({ registo: r, motivos });
      }
    });

    lembretesProximos.sort((a, b) => a.diffDias - b.diffDias);

    return {
      luaHoje: calcularFaseLua(hojeStr),
      lembretesProximos: lembretesProximos.slice(0, 4),
      sazonaisELunares: sazonaisELunares.slice(0, 5)
    };
  }

  function renderizarSugestoesMemoria() {
    const box = document.getElementById('diarioMemoriaFuturaBox');
    if (!box) return;

    const { luaHoje, lembretesProximos, sazonaisELunares } = calcularSugestoesMemoriaFutura();

    if (lembretesProximos.length === 0 && sazonaisELunares.length === 0) {
      box.innerHTML = `
        <div class="diario-memoria-vazia">
          <span>${luaHoje.emoji} Hoje: <b>${luaHoje.nome}</b></span>
          <span style="color:#94a3b8;">Sem lembretes próximos nem padrões históricos ainda. Cria registos com lembretes futuros!</span>
        </div>
      `;
      return;
    }

    let html = `<div class="diario-memoria-lua">${luaHoje.emoji} Hoje: <b>${luaHoje.nome}</b></div>`;

    if (lembretesProximos.length > 0) {
      html += `<div class="diario-memoria-sub">⏰ Lembretes Agendados:</div>`;
      lembretesProximos.forEach(({ registo, diffDias }) => {
        const quando =
          diffDias === 0 ? 'Hoje' : diffDias === 1 ? 'Amanhã' : diffDias < 0 ? `Há ${Math.abs(diffDias)}d` : `Em ${diffDias}d`;
        html += `
          <div class="diario-memoria-item lembrete" onclick="window.DiarioPesca.focarRegisto('${escaparHtml(registo.id)}')">
            <div class="diario-memoria-topo">
              <b>📍 ${escaparHtml(registo.pesqueiro || 'Local marcado')}</b>
              <span class="diario-badge-quando">${quando} (${escaparHtml(registo.lembreteData)})</span>
            </div>
            <div class="diario-memoria-txt">🔮 ${escaparHtml(registo.lembrete || 'Verificar pesqueiro')}</div>
          </div>
        `;
      });
    }

    if (sazonaisELunares.length > 0) {
      html += `<div class="diario-memoria-sub">🌕 Boas Capturas (Época / Lua):</div>`;
      sazonaisELunares.forEach(({ registo, motivos }) => {
        html += `
          <div class="diario-memoria-item" onclick="window.DiarioPesca.focarRegisto('${escaparHtml(registo.id)}')">
            <div class="diario-memoria-topo">
              <b>🐟 ${escaparHtml(registo.especie || 'Captura')} — ${escaparHtml(registo.pesqueiro || 'Sem nome')}</b>
              <span class="diario-badge-motivo">${escaparHtml(motivos.join(' · '))}</span>
            </div>
            <div class="diario-memoria-txt">
              ${escaparHtml(registo.quantidade || '')} · ${escaparHtml(registo.arte || '')} · Maré ${escaparHtml(registo.mare || '-')}
            </div>
          </div>
        `;
      });
    }

    box.innerHTML = html;
  }

  // ==========================================
  // FORMULÁRIO NOVO REGISTO / EDIÇÃO
  // ==========================================
  function atualizarFaseLuaFormulario() {
    const inpData = document.getElementById('diarioInpData');
    const lblLua = document.getElementById('diarioLblLua');
    if (!inpData || !lblLua) return;
    const lua = calcularFaseLua(inpData.value);
    lblLua.textContent = `${lua.emoji} ${lua.nome}`;
  }

  function preencherSelectPesqueiros() {
    const sel = document.getElementById('diarioSelPesqueiro');
    if (!sel) return;
    const lista = obterPesqueirosDisponiveis();
    sel.innerHTML = `<option value="">-- Usar GPS Atual ou Escrever Nome --</option>`;
    lista.forEach((p, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `${p.nome} (${p.origem})`;
      opt.dataset.lat = String(p.lat);
      opt.dataset.lon = String(p.lon);
      opt.dataset.nome = p.nome;
      sel.appendChild(opt);
    });
  }

  function abrirFormularioNovo(registoExistente = null) {
    formularioAberto = true;
    idEdicao = registoExistente ? registoExistente.id : null;
    const form = document.getElementById('diarioFormBox');
    if (!form) return;
    form.style.display = 'flex';
    preencherSelectPesqueiros();

    const agora = new Date();
    const dataDef = registoExistente?.data || agora.toISOString().slice(0, 10);
    const horaDef = registoExistente?.hora || agora.toTimeString().slice(0, 5);
    const pos = obterPosicaoGpsAtual();

    const meteo = !registoExistente && window.MeteorologiaMaritima
      ? window.MeteorologiaMaritima.obterDadosAtuais()
      : null;

    document.getElementById('diarioInpData').value = dataDef;
    document.getElementById('diarioInpHora').value = horaDef;
    document.getElementById('diarioInpPesqueiro').value = registoExistente?.pesqueiro || '';
    document.getElementById('diarioInpLat').value =
      registoExistente?.lat != null ? Number(registoExistente.lat).toFixed(5) : pos ? pos.lat.toFixed(5) : '';
    document.getElementById('diarioInpLon').value =
      registoExistente?.lon != null ? Number(registoExistente.lon).toFixed(5) : pos ? pos.lon.toFixed(5) : '';
    document.getElementById('diarioInpEspecie').value = registoExistente?.especie || '';
    document.getElementById('diarioInpQtd').value = registoExistente?.quantidade || '';
    document.getElementById('diarioInpArte').value = registoExistente?.arte || '';
    document.getElementById('diarioInpMare').value = registoExistente?.mare || meteo?.mare?.chipMare || 'Enchente';
    document.getElementById('diarioInpVento').value = registoExistente?.vento || meteo?.ventoTexto || '';
    document.getElementById('diarioInpMar').value = registoExistente?.estadoMar || meteo?.estadoMarDiario || 'Chão';
    document.getElementById('diarioInpAlturaVaga').value = registoExistente?.alturaVaga || meteo?.vagaTexto || '';
    document.getElementById('diarioInpPressao').value = registoExistente?.pressao || meteo?.pressaoTexto || '';
    document.getElementById('diarioInpProf').value = registoExistente?.profundidade || '';
    document.getElementById('diarioInpTempAgua').value = registoExistente?.tempAgua || meteo?.tempAguaTexto || '';
    document.getElementById('diarioInpQualidade').value = registoExistente?.qualidade || 'boa';
    document.getElementById('diarioInpLembrete').value = registoExistente?.lembrete || '';
    document.getElementById('diarioInpLembreteData').value = registoExistente?.lembreteData || '';

    atualizarEstadoBotoesRapidos();
    atualizarFaseLuaFormulario();
  }

  function fecharFormulario() {
    formularioAberto = false;
    idEdicao = null;
    const form = document.getElementById('diarioFormBox');
    if (form) form.style.display = 'none';
  }

  function atualizarEstadoBotoesRapidos() {
    const espVal = document.getElementById('diarioInpEspecie')?.value || '';
    document.querySelectorAll('.diario-chip-esp').forEach((btn) => {
      btn.classList.toggle('ativo', btn.dataset.val === espVal);
    });
    const arteVal = document.getElementById('diarioInpArte')?.value || '';
    document.querySelectorAll('.diario-chip-arte').forEach((btn) => {
      btn.classList.toggle('ativo', btn.dataset.val === arteVal);
    });
    const mareVal = document.getElementById('diarioInpMare')?.value || '';
    document.querySelectorAll('.diario-chip-mare').forEach((btn) => {
      btn.classList.toggle('ativo', btn.dataset.val === mareVal);
    });
  }

  function guardarFormulario() {
    const data = document.getElementById('diarioInpData').value || new Date().toISOString().slice(0, 10);
    const hora = document.getElementById('diarioInpHora').value || '12:00';
    const pesqueiro = document.getElementById('diarioInpPesqueiro').value.trim() || 'Pesqueiro no Mar';
    const lat = parseFloat(document.getElementById('diarioInpLat').value);
    const lon = parseFloat(document.getElementById('diarioInpLon').value);
    const especie = document.getElementById('diarioInpEspecie').value.trim() || 'Outros';
    const quantidade = document.getElementById('diarioInpQtd').value.trim();
    const arte = document.getElementById('diarioInpArte').value.trim();
    const mare = document.getElementById('diarioInpMare').value.trim();
    const vento = document.getElementById('diarioInpVento').value.trim();
    const estadoMar = document.getElementById('diarioInpMar').value.trim();
    const alturaVaga = document.getElementById('diarioInpAlturaVaga').value.trim();
    const pressao = document.getElementById('diarioInpPressao').value.trim();
    const profundidade = document.getElementById('diarioInpProf').value.trim();
    const tempAgua = document.getElementById('diarioInpTempAgua').value.trim();
    const qualidade = document.getElementById('diarioInpQualidade').value || 'normal';
    const lembrete = document.getElementById('diarioInpLembrete').value.trim();
    const lembreteData = document.getElementById('diarioInpLembreteData').value || '';
    const lua = calcularFaseLua(data);

    const registo = {
      id: idEdicao || `diario_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      data,
      hora,
      faseLua: lua.nome,
      faseLuaEmoji: lua.emoji,
      pesqueiro,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      especie,
      quantidade,
      arte,
      mare,
      vento,
      estadoMar,
      alturaVaga,
      pressao,
      profundidade,
      tempAgua,
      qualidade,
      lembrete,
      lembreteData,
      atualizadoEm: new Date().toISOString()
    };

    if (idEdicao) {
      const idx = registos.findIndex((r) => r.id === idEdicao);
      if (idx >= 0) registos[idx] = registo;
      else registos.unshift(registo);
    } else {
      registos.unshift(registo);
    }

    registos.sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));
    guardarRegistos();
    fecharFormulario();
    renderizarTudo();
    notificar('✅ Registo guardado no Diário de Pesca.');
  }

  // ==========================================
  // LISTA DE REGISTOS
  // ==========================================
  function renderizarLista() {
    const listaEl = document.getElementById('diarioListaRegistos');
    const contadorEl = document.getElementById('diarioContador');
    if (contadorEl) contadorEl.textContent = String(registos.length);
    if (!listaEl) return;

    const termo = filtroTexto.trim().toLowerCase();
    const filtrados = termo
      ? registos.filter((r) =>
          `${r.pesqueiro} ${r.especie} ${r.arte} ${r.lembrete} ${r.faseLua} ${r.mare} ${r.data}`
            .toLowerCase()
            .includes(termo)
        )
      : registos;

    if (filtrados.length === 0) {
      listaEl.innerHTML = `<div style="text-align:center;padding:18px;color:#94a3b8;font-size:12.5px;">Nenhum registo encontrado. Toca em "➕ Novo Registo" para começar.</div>`;
      return;
    }

    listaEl.innerHTML = filtrados
      .map((r) => {
        const temCoords = Number.isFinite(r.lat) && Number.isFinite(r.lon);
        const badgeQual = r.qualidade === 'boa' ? '⭐ Boa' : r.qualidade === 'fraca' ? '⚪ Fraca' : '';
        return `
          <div class="diario-card-reg">
            <div class="diario-card-head">
              <div>
                <div class="diario-card-titulo">${escaparHtml(r.especie || 'Pesca')} ${r.quantidade ? `(${escaparHtml(r.quantidade)})` : ''}</div>
                <div class="diario-card-sub">📍 ${escaparHtml(r.pesqueiro)} · ${escaparHtml(r.data)} ${escaparHtml(r.hora || '')}</div>
              </div>
              <div class="diario-card-badges">
                <span>${escaparHtml(r.faseLuaEmoji || '🌙')} ${escaparHtml(r.faseLua || '')}</span>
                ${badgeQual ? `<span class="diario-badge-qual">${badgeQual}</span>` : ''}
              </div>
            </div>
            <div class="diario-card-detalhes">
              ${r.arte ? `<span>🎣 ${escaparHtml(r.arte)}</span>` : ''}
              ${r.mare ? `<span>🌊 ${escaparHtml(r.mare)}</span>` : ''}
              ${r.vento ? `<span>💨 ${escaparHtml(r.vento)}</span>` : ''}
              ${r.estadoMar ? `<span>⛵ ${escaparHtml(r.estadoMar)}</span>` : ''}
              ${r.profundidade ? `<span>📏 ${escaparHtml(r.profundidade)}</span>` : ''}
              ${r.tempAgua ? `<span>🌡️ ${escaparHtml(r.tempAgua)}</span>` : ''}
            </div>
            ${
              r.lembrete || r.lembreteData
                ? `<div class="diario-card-lembrete">🔮 ${escaparHtml(r.lembrete || 'Lembrete')} ${r.lembreteData ? `<b>(${escaparHtml(r.lembreteData)})</b>` : ''}</div>`
                : ''
            }
            <div class="diario-card-acoes">
              ${temCoords ? `<button type="button" onclick="window.DiarioPesca.focarRegisto('${escaparHtml(r.id)}')">🗺️ Mapa</button>` : ''}
              <button type="button" onclick="window.DiarioPesca.editarRegisto('${escaparHtml(r.id)}')">✏️ Editar</button>
              <button type="button" class="btn-apagar" onclick="window.DiarioPesca.apagarRegisto('${escaparHtml(r.id)}')">🗑️</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderizarTudo() {
    renderizarSugestoesMemoria();
    renderizarLista();
  }

  // ==========================================
  // MEMÓRIA POR LOCAL (PROXIMIDADE < 250m & CLIQUE EM WAYPOINT)
  // ==========================================
  function verificarProximidadeEmbarcacao() {
    const pos = obterPosicaoGpsAtual();
    if (!pos || registos.length === 0) return;

    let maisProximo = null;
    let menorDist = Infinity;

    registos.forEach((r) => {
      if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return;
      const dist = calcularDistanciaMetros(pos.lat, pos.lon, r.lat, r.lon);
      if (dist <= RAIO_PROXIMIDADE_M && dist < menorDist) {
        menorDist = dist;
        maisProximo = r;
      }
    });

    if (!maisProximo) return;
    const chave = `${maisProximo.pesqueiro}|${maisProximo.lat.toFixed(3)}|${maisProximo.lon.toFixed(3)}`;
    const agora = Date.now();
    if (ultimoAvisoPorLocal[chave] && agora - ultimoAvisoPorLocal[chave] < COOLDOWN_PROXIMIDADE_MS) {
      return;
    }

    ultimoAvisoPorLocal[chave] = agora;
    ultimaChaveProximidadeAtiva = chave;
    mostrarAvisoProximidade(maisProximo, Math.round(menorDist));
  }

  function mostrarAvisoProximidade(registo, distanciaM) {
    const aviso = document.getElementById('diarioAvisoProximidade');
    if (!aviso) return;
    const distTxt = Number.isFinite(distanciaM) ? ` (${distanciaM}m)` : '';
    aviso.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <div style="font-weight:700;color:#fbbf24;font-size:12.5px;">📓 Memória do Pesqueiro: ${escaparHtml(registo.pesqueiro)}${distTxt}</div>
          <div style="font-size:11.5px;color:#e2e8f0;margin-top:2px;">
            Último: <b>${escaparHtml(registo.especie)}</b> ${registo.quantidade ? `(${escaparHtml(registo.quantidade)})` : ''} · ${escaparHtml(registo.arte || '-')} · ${escaparHtml(registo.data)}
          </div>
          ${registo.lembrete ? `<div style="font-size:11.5px;color:#7dd3fc;margin-top:2px;">🔮 ${escaparHtml(registo.lembrete)}</div>` : ''}
        </div>
        <button type="button" onclick="document.getElementById('diarioAvisoProximidade').style.display='none'" style="background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;padding:2px 4px;">✕</button>
      </div>
    `;
    aviso.style.display = 'block';
  }

  function ligarHookMapaWaypoints(tentativas = 0) {
    const mapa = window.mapaGpsNautico;
    if (!mapa || typeof mapa.on !== 'function') {
      if (tentativas < 25) setTimeout(() => ligarHookMapaWaypoints(tentativas + 1), 400);
      return;
    }
    mapa.on('popupopen', (ev) => {
      try {
        const ll = ev.popup && ev.popup.getLatLng ? ev.popup.getLatLng() : null;
        if (!ll) return;
        const correspondentes = registos.filter(
          (r) =>
            Number.isFinite(r.lat) &&
            Number.isFinite(r.lon) &&
            calcularDistanciaMetros(ll.lat, ll.lng, r.lat, r.lon) <= RAIO_PROXIMIDADE_M
        );
        if (correspondentes.length > 0) {
          mostrarAvisoProximidade(correspondentes[0], null);
        }
      } catch (_) {}
    });
  }

  // ==========================================
  // EXPORTAÇÃO (JSON / CSV) E IMPORTAÇÃO
  // ==========================================
  function descarregarFicheiro(nome, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportarJson() {
    const dataHoje = new Date().toISOString().slice(0, 10);
    descarregarFicheiro(
      `diario_pesca_${dataHoje}.json`,
      JSON.stringify(registos, null, 2),
      'application/json;charset=utf-8'
    );
    notificar('💾 Diário exportado em JSON.');
  }

  function escaparCsv(val) {
    const s = String(val ?? '').replace(/"/g, '""');
    return `"${s}"`;
  }

  function exportarCsv() {
    const cabecalho = [
      'Data',
      'Hora',
      'Fase da Lua',
      'Pesqueiro',
      'Latitude',
      'Longitude',
      'Especie',
      'Quantidade/Peso',
      'Arte/Isco',
      'Mare',
      'Vento',
      'Estado do Mar',
      'Profundidade',
      'Temp. Agua',
      'Qualidade',
      'Lembrete Futuro',
      'Data Lembrete'
    ];
    const linhas = [cabecalho.map(escaparCsv).join(';')];
    registos.forEach((r) => {
      linhas.push(
        [
          r.data,
          r.hora,
          r.faseLua,
          r.pesqueiro,
          r.lat ?? '',
          r.lon ?? '',
          r.especie,
          r.quantidade,
          r.arte,
          r.mare,
          r.vento,
          r.estadoMar,
          r.profundidade,
          r.tempAgua,
          r.qualidade,
          r.lembrete,
          r.lembreteData
        ]
          .map(escaparCsv)
          .join(';')
      );
    });
    const dataHoje = new Date().toISOString().slice(0, 10);
    descarregarFicheiro(
      `diario_pesca_${dataHoje}.csv`,
      '\uFEFF' + linhas.join('\r\n'),
      'text/csv;charset=utf-8'
    );
    notificar('📊 Diário exportado para Excel (CSV).');
  }

  function importarJson(ficheiro) {
    if (!ficheiro) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dados = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(dados)) throw new Error('Formato inválido');
        const idsExistentes = new Set(registos.map((r) => r.id));
        let adicionados = 0;
        dados.forEach((item) => {
          if (item && typeof item === 'object') {
            const id = item.id || `diario_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            if (!idsExistentes.has(id)) {
              idsExistentes.add(id);
              registos.push({ ...item, id });
              adicionados++;
            }
          }
        });
        registos.sort((a, b) => `${b.data || ''} ${b.hora || ''}`.localeCompare(`${a.data || ''} ${a.hora || ''}`));
        guardarRegistos();
        renderizarTudo();
        notificar(`📂 Importados ${adicionados} registos para o Diário.`);
      } catch (_) {
        notificar('⚠️ Ficheiro JSON inválido para o Diário.');
      }
    };
    reader.readAsText(ficheiro);
  }

  // ==========================================
  // INTERFACE E EVENTOS
  // ==========================================
  function construirPainelHtml() {
    if (document.getElementById('diarioPescaPainel')) return;

    const avisoEl = document.createElement('div');
    avisoEl.id = 'diarioAvisoProximidade';
    avisoEl.className = 'diario-aviso-proximidade';
    avisoEl.style.display = 'none';
    document.getElementById('app-container')?.appendChild(avisoEl);

    const painel = document.createElement('aside');
    painel.id = 'diarioPescaPainel';
    painel.className = 'diario-pesca-painel';
    painel.style.display = 'none';
    painel.innerHTML = `
      <div class="diario-header">
        <div class="diario-header-titulo">📓 Diário de Pesca (<span id="diarioContador">0</span>)</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button type="button" id="btnDiarioAbrirIa" class="diario-btn-ia" title="Abrir Agente IA de Pesca">🤖 IA Pesca</button>
          <button type="button" id="btnFecharDiario" class="diario-btn-fechar">✖</button>
        </div>
      </div>

      <div class="diario-body">
        <!-- Memória Sazonal e Lunar -->
        <div class="diario-memoria-box">
          <div class="diario-sec-titulo">🔮 Sugestões da Memória Futura</div>
          <div id="diarioMemoriaFuturaBox"></div>
        </div>

        <!-- Barra de Ações -->
        <div class="diario-acoes-topo">
          <button type="button" id="btnNovoRegistoDiario" class="diario-btn-primario">➕ Novo Registo</button>
          <input type="text" id="diarioPesquisa" class="diario-input-pesquisa" placeholder="🔍 Filtrar espécie, local, lua...">
        </div>

        <!-- Formulário Novo Registo (Recolhido por defeito) -->
        <div id="diarioFormBox" class="diario-form" style="display:none;">
          <div class="diario-form-grid2">
            <div>
              <label>Data</label>
              <input type="date" id="diarioInpData">
            </div>
            <div>
              <label>Hora</label>
              <input type="time" id="diarioInpHora">
            </div>
          </div>
          <div class="diario-lua-pill">Fase da Lua: <b id="diarioLblLua">🌙 --</b></div>

          <div>
            <label>Escolher Pesqueiro (Pasta de Eventos / GPX)</label>
            <select id="diarioSelPesqueiro"></select>
          </div>
          <div>
            <label>Nome do Pesqueiro / Local</label>
            <input type="text" id="diarioInpPesqueiro" placeholder="Ex: Cabeço da Rocha, Pedra Alta...">
          </div>
          <div class="diario-form-grid2">
            <div>
              <label>Latitude</label>
              <input type="number" step="0.00001" id="diarioInpLat" placeholder="37.11050">
            </div>
            <div>
              <label>Longitude</label>
              <input type="number" step="0.00001" id="diarioInpLon" placeholder="-8.56800">
            </div>
          </div>

          <div>
            <label>Espécie / Captura</label>
            <div class="diario-chips">
              ${ESPECIES_RAPIDAS.map((e) => `<button type="button" class="diario-chip diario-chip-esp" data-val="${e}">${e}</button>`).join('')}
            </div>
            <div class="diario-form-grid2" style="margin-top:6px;">
              <input type="text" id="diarioInpEspecie" placeholder="Espécie...">
              <input type="text" id="diarioInpQtd" placeholder="Qtd / Peso (ex: 8 / 2.5kg)">
            </div>
          </div>

          <div>
            <label>Arte / Isco Utilizado</label>
            <div class="diario-chips">
              ${ARTES_RAPIDAS.map((a) => `<button type="button" class="diario-chip diario-chip-arte" data-val="${a}">${a}</button>`).join('')}
            </div>
            <input type="text" id="diarioInpArte" placeholder="Arte ou isco..." style="margin-top:6px;">
          </div>

          <div>
            <label>Maré</label>
            <div class="diario-chips">
              ${MARES_RAPIDAS.map((m) => `<button type="button" class="diario-chip diario-chip-mare" data-val="${m}">${m}</button>`).join('')}
            </div>
            <input type="hidden" id="diarioInpMare" value="Enchente">
          </div>

          <div class="diario-form-grid3">
            <div>
              <label>Vento</label>
              <input type="text" id="diarioInpVento" placeholder="NW 10 nós">
            </div>
            <div>
              <label>Estado do Mar</label>
              <select id="diarioInpMar">
                ${ESTADOS_MAR.map((m) => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Resultado</label>
              <select id="diarioInpQualidade">
                <option value="boa">⭐ Boa</option>
                <option value="normal">👍 Normal</option>
                <option value="fraca">⚪ Fraca</option>
              </select>
            </div>
          </div>

          <div class="diario-form-grid2">
            <div>
              <label>Altura da Vaga</label>
              <input type="text" id="diarioInpAlturaVaga" placeholder="Ex: 0.8 m (7s)">
            </div>
            <div>
              <label>Pressão (hPa)</label>
              <input type="text" id="diarioInpPressao" placeholder="Ex: 1018 hPa">
            </div>
          </div>

          <div class="diario-form-grid2">
            <div>
              <label>Profundidade (Sonda)</label>
              <input type="text" id="diarioInpProf" placeholder="Ex: 18 braças / 32m">
            </div>
            <div>
              <label>Temp. da Água</label>
              <input type="text" id="diarioInpTempAgua" placeholder="Ex: 18.5 °C">
            </div>
          </div>

          <div class="diario-lembrete-box">
            <label>🔮 Lembrete / Memória Futura</label>
            <input type="text" id="diarioInpLembrete" placeholder="Ex: Voltar na próxima lua cheia, testar ao lusco-fusco">
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <span style="font-size:11px;color:#93c5fd;white-space:nowrap;">Avisar em:</span>
              <input type="date" id="diarioInpLembreteData" style="flex:1;">
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:4px;">
            <button type="button" id="btnGuardarRegistoDiario" class="diario-btn-guardar">💾 Guardar Registo</button>
            <button type="button" id="btnCancelarFormDiario" class="diario-btn-sec">Cancelar</button>
          </div>
        </div>

        <!-- Lista de Registos -->
        <div id="diarioListaRegistos" class="diario-lista"></div>
      </div>

      <!-- Rodapé Backup JSON / CSV -->
      <div class="diario-footer">
        <button type="button" id="btnExportarDiarioJson">💾 Exportar (JSON)</button>
        <button type="button" id="btnExportarDiarioCsv">📊 Excel (CSV)</button>
        <button type="button" id="btnImportarDiarioJson">📂 Importar</button>
        <input type="file" id="inpImportarDiarioJson" accept=".json" style="display:none;">
      </div>
      <div class="diario-footer-pc">
        <button type="button" id="btnBackupDiarioPc" class="btn-pc-save">☁️ Guardar Backup no PC</button>
        <button type="button" id="btnRestaurarDiarioPc" class="btn-pc-restore">📥 Restaurar do PC</button>
      </div>
    `;

    document.getElementById('app-container')?.appendChild(painel);

    // Ligar eventos
    document.getElementById('btnFecharDiario').addEventListener('click', () => alternarPainel(false));
    document.getElementById('btnDiarioAbrirIa').addEventListener('click', () => {
      alternarPainel(false);
      if (window.AgentePescaUI && typeof window.AgentePescaUI.alternarPainel === 'function') {
        window.AgentePescaUI.alternarPainel(true);
      }
    });
    document.getElementById('btnNovoRegistoDiario').addEventListener('click', () => {
      if (formularioAberto && !idEdicao) fecharFormulario();
      else abrirFormularioNovo(null);
    });
    document.getElementById('btnCancelarFormDiario').addEventListener('click', fecharFormulario);
    document.getElementById('btnGuardarRegistoDiario').addEventListener('click', guardarFormulario);
    document.getElementById('diarioInpData').addEventListener('change', atualizarFaseLuaFormulario);
    document.getElementById('diarioPesquisa').addEventListener('input', (e) => {
      filtroTexto = e.target.value || '';
      renderizarLista();
    });

    document.getElementById('diarioSelPesqueiro').addEventListener('change', (e) => {
      const opt = e.target.selectedOptions[0];
      if (!opt || !opt.value) return;
      document.getElementById('diarioInpPesqueiro').value = opt.dataset.nome || '';
      document.getElementById('diarioInpLat').value = Number(opt.dataset.lat).toFixed(5);
      document.getElementById('diarioInpLon').value = Number(opt.dataset.lon).toFixed(5);
    });

    document.querySelectorAll('.diario-chip-esp').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('diarioInpEspecie').value = btn.dataset.val;
        atualizarEstadoBotoesRapidos();
      });
    });
    document.querySelectorAll('.diario-chip-arte').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('diarioInpArte').value = btn.dataset.val;
        atualizarEstadoBotoesRapidos();
      });
    });
    document.querySelectorAll('.diario-chip-mare').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('diarioInpMare').value = btn.dataset.val;
        atualizarEstadoBotoesRapidos();
      });
    });

    document.getElementById('btnExportarDiarioJson').addEventListener('click', exportarJson);
    document.getElementById('btnExportarDiarioCsv').addEventListener('click', exportarCsv);
    document.getElementById('btnImportarDiarioJson').addEventListener('click', () => {
      document.getElementById('inpImportarDiarioJson').click();
    });
    document.getElementById('inpImportarDiarioJson').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importarJson(file);
      e.target.value = '';
    });
    document.getElementById('btnBackupDiarioPc').addEventListener('click', () => {
      if (window.BackupNautico) window.BackupNautico.guardarManual();
    });
    document.getElementById('btnRestaurarDiarioPc').addEventListener('click', () => {
      if (window.BackupNautico) window.BackupNautico.restaurarManual();
    });
  }

  function alternarPainel(forcarEstado) {
    const painel = document.getElementById('diarioPescaPainel');
    if (!painel) return;
    const abrir = typeof forcarEstado === 'boolean' ? forcarEstado : painel.style.display === 'none';

    if (abrir) {
      if (typeof window.alternarPastaEventos === 'function') window.alternarPastaEventos(false);
      if (window.AgentePescaUI && typeof window.AgentePescaUI.alternarPainel === 'function') {
        window.AgentePescaUI.alternarPainel(false);
      }
      renderizarTudo();
      painel.style.display = 'flex';
    } else {
      painel.style.display = 'none';
    }
  }

  function focarRegisto(id) {
    const r = registos.find((x) => x.id === id);
    if (!r) return;
    if (Number.isFinite(r.lat) && Number.isFinite(r.lon) && window.mapaGpsNautico) {
      if (typeof window.alternarModoGps === 'function') window.alternarModoGps('nautico');
      window.mapaGpsNautico.setView([r.lat, r.lon], Math.max(window.mapaGpsNautico.getZoom(), 14));
      alternarPainel(false);
      notificar(`📍 ${r.pesqueiro} (${r.especie})`);
    } else {
      notificar(`📓 ${r.pesqueiro}: ${r.lembrete || r.especie}`);
    }
  }

  function editarRegisto(id) {
    const r = registos.find((x) => x.id === id);
    if (r) abrirFormularioNovo(r);
  }

  function apagarRegisto(id) {
    registos = registos.filter((r) => r.id !== id);
    guardarRegistos();
    renderizarTudo();
    notificar('🗑️ Registo removido do Diário.');
  }

  function obterContextoResumido(maxRegistos = 15) {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const lua = calcularFaseLua(hojeStr);
    const pos = obterPosicaoGpsAtual();
    const est = window.__vigilanteEstadoGps;
    const alvo = est && est.waypointAtivo ? { nome: est.waypointAtivo.nome, lat: est.waypointAtivo.lat, lon: est.waypointAtivo.lon } : null;

    return {
      dataHoje: hojeStr,
      faseLuaAtual: `${lua.emoji} ${lua.nome}`,
      posicaoAtual: pos,
      pesqueiroSelecionado: alvo,
      totalRegistosDiario: registos.length,
      ultimosRegistos: registos.slice(0, maxRegistos).map((r) => ({
        data: r.data,
        hora: r.hora,
        faseLua: r.faseLua,
        pesqueiro: r.pesqueiro,
        lat: r.lat,
        lon: r.lon,
        especie: r.especie,
        quantidade: r.quantidade,
        arte: r.arte,
        mare: r.mare,
        vento: r.vento,
        estadoMar: r.estadoMar,
        profundidade: r.profundidade,
        tempAgua: r.tempAgua,
        qualidade: r.qualidade,
        lembrete: r.lembrete,
        lembreteData: r.lembreteData
      }))
    };
  }

  function inicializar() {
    carregarRegistos();
    construirPainelHtml();
    renderizarTudo();
    ligarHookMapaWaypoints();
    setInterval(verificarProximidadeEmbarcacao, 5000);
    setTimeout(verificarProximidadeEmbarcacao, 2500);
  }

  window.DiarioPesca = {
    alternarPainel,
    abrirNovoComPesqueiro: (nome, lat, lon) => {
      alternarPainel(true);
      abrirFormularioNovo(null);
      const inpNome = document.getElementById('diarioInpPesqueiro');
      const inpLat = document.getElementById('diarioInpLat');
      const inpLon = document.getElementById('diarioInpLon');
      if (inpNome) inpNome.value = nome || '';
      if (inpLat && Number.isFinite(Number(lat))) inpLat.value = Number(lat).toFixed(5);
      if (inpLon && Number.isFinite(Number(lon))) inpLon.value = Number(lon).toFixed(5);
    },
    recarregarLocal: () => {
      carregarRegistos();
      renderizarTudo();
    },
    obterRegistos: () => registos.slice(),
    calcularFaseLua,
    calcularDistanciaMetros,
    obterContextoResumido,
    focarRegisto,
    editarRegisto,
    apagarRegisto,
    exportarJson,
    exportarCsv
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
