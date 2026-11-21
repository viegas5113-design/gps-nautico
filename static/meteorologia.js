/**
 * Motor de Meteorologia Marítima & Previsão de Atividade de Pesca (Offline-First)
 * Open-Meteo Marine + Weather Forecast API (5 dias hora a hora)
 * Cache permanente: gps_nautico_meteo_cache_v1
 */
(() => {
  const CHAVE_CACHE_METEO = 'gps_nautico_meteo_cache_v1';
  const LAGOS_PADRAO = { lat: 37.10, lon: -8.67, nome: 'Lagos (Defeito)' };
  const INTERVALO_AUTO_ATUALIZAR_MS = 30 * 60 * 1000; // 30 min

  const estado = {
    cache: null, // { atualizadoEm, lat, lon, origemNome, horas: [...], dias: [...] }
    modo: 'sem-dados', // 'online' | 'offline' | 'sem-dados'
    painelAberto: false,
    diaSelecionadoIdx: 0,
    horaSelecionadaIso: null,
    aCarregar: false,
    controloMapaEl: null
  };

  // ==========================================
  // UTILITÁRIOS DE FORMATAÇÃO & ROSA-DOS-VENTOS
  // ==========================================
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
      clearTimeout(window.__toastMeteoTimer);
      window.__toastMeteoTimer = setTimeout(() => toast.classList.remove('visivel'), 3200);
    }
  }

  function grausParaCardeal(graus) {
    if (!Number.isFinite(graus)) return '---';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(((graus % 360) + 360) % 360 / 22.5) % 16;
    return dirs[idx];
  }

  function obterNomeVentoLocal(graus) {
    if (!Number.isFinite(graus)) return 'Variável';
    const g = ((graus % 360) + 360) % 360;
    if (g >= 337.5 || g < 22.5) return 'Nortada';
    if (g >= 22.5 && g < 67.5) return 'Nordeste';
    if (g >= 67.5 && g < 112.5) return 'Levante';
    if (g >= 112.5 && g < 157.5) return 'Sueste';
    if (g >= 157.5 && g < 202.5) return 'Sul';
    if (g >= 202.5 && g < 247.5) return 'Sudoeste (Vendaval)';
    if (g >= 247.5 && g < 292.5) return 'Poente';
    return 'Noroeste (Nortada)';
  }

  function formatarIsoHoraLocal(date) {
    const d = date instanceof Date ? date : new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    const hora = String(d.getHours()).padStart(2, '0');
    return `${ano}-${mes}-${dia}T${hora}:00`;
  }

  function formatarDiaCurto(dataStr, idx) {
    if (idx === 0) return 'Hoje';
    if (idx === 1) return 'Amanhã';
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const d = new Date(ano, (mes || 1) - 1, dia || 1);
    const diasSem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return `${diasSem[d.getDay()]} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
  }

  // ==========================================
  // POSIÇÃO ALVO (GPS ATUAL -> WAYPOINT -> LAGOS)
  // ==========================================
  function obterCoordenadasAlvo() {
    const gps = window.__vigilanteEstadoGps;
    if (gps?.posicao && Number.isFinite(gps.posicao.lat) && Number.isFinite(gps.posicao.lon)) {
      return { lat: gps.posicao.lat, lon: gps.posicao.lon, nome: 'Posição GPS Atual' };
    }
    if (gps?.waypointAtivo && Number.isFinite(gps.waypointAtivo.lat) && Number.isFinite(gps.waypointAtivo.lon)) {
      return {
        lat: gps.waypointAtivo.lat,
        lon: gps.waypointAtivo.lon,
        nome: gps.waypointAtivo.nome || 'Ponto Selecionado'
      };
    }
    return { ...LAGOS_PADRAO };
  }

  // ==========================================
  // CÁLCULOS ASTRONÓMICOS & MARÉS (100% OFFLINE)
  // ==========================================
  function calcularFaseLua(date) {
    const d = date instanceof Date ? date : new Date();
    const refLuaNova = Date.UTC(2000, 0, 6, 18, 14, 0);
    const cicloSinodico = 29.53058867;
    const diasDesde = (d.getTime() - refLuaNova) / 86400000;
    const idade = ((diasDesde % cicloSinodico) + cicloSinodico) % cicloSinodico;
    const fracao = idade / cicloSinodico; // 0 = Nova, 0.5 = Cheia

    let nome = 'Lua Nova';
    let emoji = '🌑';
    if (idade < 1.85 || idade >= 27.68) {
      nome = 'Lua Nova'; emoji = '🌑';
    } else if (idade < 5.54) {
      nome = 'Crescente Côncava'; emoji = '🌒';
    } else if (idade < 9.23) {
      nome = 'Quarto Crescente'; emoji = '🌓';
    } else if (idade < 12.92) {
      nome = 'Crescente Gibosa'; emoji = '🌔';
    } else if (idade < 16.61) {
      nome = 'Lua Cheia'; emoji = '🌕';
    } else if (idade < 20.30) {
      nome = 'Minguante Gibosa'; emoji = '🌖';
    } else if (idade < 23.99) {
      nome = 'Quarto Minguante'; emoji = '🌗';
    } else {
      nome = 'Minguante Côncava'; emoji = '🌘';
    }
    return { nome, emoji, idade, fracao };
  }

  function calcularSolFallback(date, lat, lon) {
    // Cálculo simplificado de nascer/pôr do sol (UTC -> local)
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const start = new Date(date.getFullYear(), 0, 0);
    const doy = Math.floor((d - start) / 86400000);
    const rad = Math.PI / 180;
    const decl = -23.44 * Math.cos(rad * (360 / 365) * (doy + 10));
    const latRad = lat * rad;
    const declRad = decl * rad;
    const cosH = Math.max(-0.99, Math.min(0.99, -Math.tan(latRad) * Math.tan(declRad)));
    const H = Math.acos(cosH) / rad; // graus
    const tzOffsetH = -date.getTimezoneOffset() / 60;
    const meioDiaSolar = 12 - lon / 15 + tzOffsetH;
    return {
      nascerH: meioDiaSolar - H / 15,
      porH: meioDiaSolar + H / 15
    };
  }

  function calcularSolunarDia(date, lat, lon) {
    // Aproximação astronómica offline para Trânsito Lunar, Oposição, Nascer e Pôr da Lua
    const rad = Math.PI / 180;
    const dUtcMid = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const daysSinceJ2000 = (dUtcMid - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;

    // Posição média da Lua
    const L = (218.316 + 13.176396 * daysSinceJ2000) % 360;
    const M = (134.963 + 13.064993 * daysSinceJ2000) % 360;
    const F = (93.272 + 13.229350 * daysSinceJ2000) % 360;
    const lonLua = L + 6.289 * Math.sin(M * rad);
    const latLua = 5.128 * Math.sin(F * rad);

    // Ascensão Reta e Declinação da Lua
    const obliq = 23.439 * rad;
    const ra = Math.atan2(
      Math.sin(lonLua * rad) * Math.cos(obliq) - Math.tan(latLua * rad) * Math.sin(obliq),
      Math.cos(lonLua * rad)
    ) / rad;
    const dec = Math.asin(
      Math.sin(latLua * rad) * Math.cos(obliq) +
      Math.cos(latLua * rad) * Math.sin(obliq) * Math.sin(lonLua * rad)
    );

    // Tempo Sideral em Greenwich às 12h UTC
    const gmst12 = (280.46061837 + 360.98564736629 * daysSinceJ2000) % 360;
    const lst12 = ((gmst12 + lon) % 360 + 360) % 360;
    const raNorm = ((ra % 360) + 360) % 360;

    // Diferença angular para trânsito lunar em horas locais
    let diffDeg = ((raNorm - lst12) % 360 + 360) % 360;
    if (diffDeg > 180) diffDeg -= 360;
    const tzOffsetH = -date.getTimezoneOffset() / 60;
    const transitoH = ((12 + tzOffsetH + diffDeg / 14.492) % 24 + 24) % 24;
    const oposicaoH = (transitoH + 12.42) % 24;

    // Semi-arco diurno da Lua
    const cosH = Math.max(-0.92, Math.min(0.92, -Math.tan(lat * rad) * Math.tan(dec)));
    const semiArcoH = (Math.acos(cosH) / rad) / 14.492;
    const nascerLuaH = ((transitoH - semiArcoH) % 24 + 24) % 24;
    const porLuaH = ((transitoH + semiArcoH) % 24 + 24) % 24;

    return { transitoH, oposicaoH, nascerLuaH, porLuaH };
  }

  function distCircularHoras(h1, h2) {
    const diff = Math.abs(h1 - h2) % 24;
    return diff > 12 ? 24 - diff : diff;
  }

  function calcularMareLagos(date) {
    // Modelo harmónico semidiurno M2 (12.4206h) calibrado para Lagos (Costa Algarvia)
    // Referência de Preamar em Lua Nova/Cheia ~02:30 / 14:55 UTC em Lagos
    const refPreamarLagos = Date.UTC(2026, 0, 3, 2, 30, 0); // Lua Cheia de referência
    const periodoM2Ms = 12.4206012 * 3600 * 1000;
    const fase = (((date.getTime() - refPreamarLagos) % periodoM2Ms) + periodoM2Ms) % periodoM2Ms / periodoM2Ms; // 0..1 (0 = Preamar, 0.5 = Baixa-mar)

    const alturaRel = Math.round(((Math.cos(fase * 2 * Math.PI) + 1) / 2) * 100);
    const lua = calcularFaseLua(date);
    const distSizigia = Math.min(
      Math.abs(lua.fracao - 0),
      Math.abs(lua.fracao - 0.5),
      Math.abs(lua.fracao - 1)
    );
    const amplitude = distSizigia < 0.08 ? 'Águas Vivas' : distSizigia > 0.17 ? 'Águas Mortas' : 'Média';

    let estadoMare = 'Enchente';
    let chipMare = 'Enchente';
    if (fase < 0.07 || fase > 0.93) {
      estadoMare = 'Estofo (Preamar)';
      chipMare = 'Estofo';
    } else if (fase >= 0.43 && fase <= 0.57) {
      estadoMare = 'Estofo (Baixa-mar)';
      chipMare = 'Estofo';
    } else if (fase >= 0.07 && fase < 0.43) {
      estadoMare = 'Vazante';
      chipMare = 'Vazante';
    } else {
      estadoMare = 'Enchente';
      chipMare = 'Enchente';
    }

    return { estado: estadoMare, chipMare, alturaRel, amplitude, fase };
  }

  function obterNascerPorSolDia(dataStr, dias, lat, lon) {
    const diaObj = Array.isArray(dias) ? dias.find((d) => d.data === dataStr) : null;
    if (diaObj && diaObj.sunrise && diaObj.sunset) {
      const sRise = new Date(diaObj.sunrise);
      const sSet = new Date(diaObj.sunset);
      if (!isNaN(sRise) && !isNaN(sSet)) {
        return {
          nascerH: sRise.getHours() + sRise.getMinutes() / 60,
          porH: sSet.getHours() + sSet.getMinutes() / 60
        };
      }
    }
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    return calcularSolFallback(new Date(ano, (mes || 1) - 1, dia || 1, 12, 0, 0), lat, lon);
  }

  function calcularIndicePescaHora(horaObj, horasLista, idx, diasLista, lat, lon) {
    const dt = new Date(horaObj.time);
    const horaDecimal = dt.getHours() + 0.5;
    const dataStr = horaObj.time.slice(0, 10);

    const lua = calcularFaseLua(dt);
    const solunar = calcularSolunarDia(dt, lat, lon);
    const sol = obterNascerPorSolDia(dataStr, diasLista, lat, lon);
    const mare = calcularMareLagos(dt);

    let pontos = 18;
    const motivos = [];

    // 1. Períodos Solunares
    const distMaior = Math.min(
      distCircularHoras(horaDecimal, solunar.transitoH),
      distCircularHoras(horaDecimal, solunar.oposicaoH)
    );
    const distMenor = Math.min(
      distCircularHoras(horaDecimal, solunar.nascerLuaH),
      distCircularHoras(horaDecimal, solunar.porLuaH)
    );

    if (distMaior <= 1.1) {
      pontos += 28;
      motivos.push(
        distCircularHoras(horaDecimal, solunar.transitoH) <= 1.1 ? 'Trânsito Lunar' : 'Oposição Lunar'
      );
    } else if (distMenor <= 0.9) {
      pontos += 17;
      motivos.push(
        distCircularHoras(horaDecimal, solunar.nascerLuaH) <= 0.9 ? 'Nascer da Lua' : 'Pôr da Lua'
      );
    }

    // Bónus Lua Nova / Lua Cheia
    const distLuaPico = Math.min(Math.abs(lua.fracao), Math.abs(lua.fracao - 0.5), Math.abs(lua.fracao - 1));
    if (distLuaPico < 0.08) pontos += 8;
    else if (distLuaPico < 0.15) pontos += 4;

    // 2. Horas de Ouro (Amanhecer / Anoitecer)
    const distNascer = distCircularHoras(horaDecimal, sol.nascerH);
    const distPor = distCircularHoras(horaDecimal, sol.porH);
    if (distNascer <= 1.0) {
      pontos += 23;
      motivos.push('Amanhecer');
    } else if (distPor <= 1.0) {
      pontos += 23;
      motivos.push('Anoitecer');
    } else if (distNascer <= 1.7 || distPor <= 1.7) {
      pontos += 10;
    }

    // 3. Movimento de Maré (Lagos)
    if (mare.chipMare === 'Enchente') {
      pontos += 18;
      motivos.push('Enchente');
    } else if (mare.chipMare === 'Estofo') {
      pontos += 15;
      motivos.push('Estofo');
    } else {
      pontos += 10;
    }
    if (mare.amplitude === 'Águas Vivas') pontos += 4;

    // 4. Pressão Atmosférica & Período da Onda
    const pAtual = horaObj.pressao;
    const pAnt = idx >= 3 ? horasLista[idx - 3]?.pressao : pAtual;
    let tendenciaPressao = 'Estável';
    if (Number.isFinite(pAtual) && Number.isFinite(pAnt)) {
      const deltaP = pAtual - pAnt;
      if (Math.abs(deltaP) <= 1.5 && pAtual >= 1008 && pAtual <= 1026) {
        pontos += 14;
        tendenciaPressao = 'Estável';
      } else if (deltaP < -3.0) {
        pontos += 2;
        tendenciaPressao = 'A descer rápido';
      } else if (deltaP > 0) {
        pontos += 9;
        tendenciaPressao = 'A subir';
      } else {
        pontos += 8;
        tendenciaPressao = 'Ligeira descida';
      }
    }

    const vaga = horaObj.vaga;
    const periodo = horaObj.periodoOnda;
    if (Number.isFinite(vaga) && Number.isFinite(periodo)) {
      if (vaga <= 1.2 && periodo >= 7) pontos += 10;
      else if (vaga <= 1.8) pontos += 6;
      else if (vaga > 2.5) pontos -= 8;
    }

    // Penalização vento muito forte (> 22 nós)
    if (Number.isFinite(horaObj.ventoNos) && horaObj.ventoNos > 22) {
      pontos -= 12;
    }

    const indice = Math.max(5, Math.min(99, Math.round(pontos)));
    let nivel = 'Fraca';
    let cor = '#94a3b8';
    if (indice >= 78) { nivel = 'Excelente'; cor = '#10b981'; }
    else if (indice >= 58) { nivel = 'Boa'; cor = '#38bdf8'; }
    else if (indice >= 38) { nivel = 'Moderada'; cor = '#fbbf24'; }

    const resumoMotivo = motivos.length ? motivos.slice(0, 2).join(' + ') : `${mare.estado}`;

    return {
      indice,
      nivel,
      cor,
      motivos,
      resumoMotivo,
      mare,
      lua,
      solunar,
      sol,
      tendenciaPressao
    };
  }

  // ==========================================
  // CACHE OFFLINE & FETCH OPEN-METEO
  // ==========================================
  function lerCacheLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_CACHE_METEO);
      if (!bruto) return null;
      const obj = JSON.parse(bruto);
      if (obj && Array.isArray(obj.horas) && obj.horas.length > 0) {
        return obj;
      }
    } catch (_) {}
    return null;
  }

  function guardarCacheLocal(dados) {
    try {
      localStorage.setItem(CHAVE_CACHE_METEO, JSON.stringify(dados));
    } catch (_) {}
  }

  async function fetchComTimeout(url, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const resp = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async function descarregarPrevisaoOpenMeteo(forcarNotificacao = false) {
    if (estado.aCarregar) return;
    estado.aCarregar = true;
    atualizarBotaoRefresh(true);

    const alvo = obterCoordenadasAlvo();
    const lat = alvo.lat.toFixed(4);
    const lon = alvo.lon.toFixed(4);

    const urlMarine =
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}` +
      `&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature&forecast_days=5&timezone=auto`;
    const urlWeather =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure&daily=sunrise,sunset&wind_speed_unit=kn&forecast_days=5&timezone=auto`;

    try {
      const [marine, weather] = await Promise.all([
        fetchComTimeout(urlMarine),
        fetchComTimeout(urlWeather)
      ]);

      const mapaHoras = new Map();
      const wHoras = weather?.hourly || {};
      const mHoras = marine?.hourly || {};

      (wHoras.time || []).forEach((t, i) => {
        const nos = wHoras.wind_speed_10m?.[i];
        const rajNos = wHoras.wind_gusts_10m?.[i];
        const dirVento = wHoras.wind_direction_10m?.[i];
        mapaHoras.set(t, {
          time: t,
          ventoNos: Number.isFinite(nos) ? Math.round(nos * 10) / 10 : null,
          ventoKmh: Number.isFinite(nos) ? Math.round(nos * 1.852) : null,
          rajadasNos: Number.isFinite(rajNos) ? Math.round(rajNos * 10) / 10 : null,
          rajadasKmh: Number.isFinite(rajNos) ? Math.round(rajNos * 1.852) : null,
          ventoDir: Number.isFinite(dirVento) ? Math.round(dirVento) : null,
          pressao: Number.isFinite(wHoras.surface_pressure?.[i]) ? Math.round(wHoras.surface_pressure[i]) : null,
          vaga: null,
          periodoOnda: null,
          ondaDir: null,
          tempAgua: null
        });
      });

      (mHoras.time || []).forEach((t, i) => {
        const reg = mapaHoras.get(t) || { time: t };
        const vh = mHoras.wave_height?.[i];
        const vp = mHoras.wave_period?.[i];
        const vd = mHoras.wave_direction?.[i];
        const sst = mHoras.sea_surface_temperature?.[i];
        reg.vaga = Number.isFinite(vh) ? Math.round(vh * 10) / 10 : null;
        reg.periodoOnda = Number.isFinite(vp) ? Math.round(vp * 10) / 10 : null;
        reg.ondaDir = Number.isFinite(vd) ? Math.round(vd) : null;
        reg.tempAgua = Number.isFinite(sst) ? Math.round(sst * 10) / 10 : null;
        mapaHoras.set(t, reg);
      });

      const horas = Array.from(mapaHoras.values()).sort((a, b) => a.time.localeCompare(b.time));
      const dias = (weather?.daily?.time || []).map((d, i) => ({
        data: d,
        sunrise: weather.daily.sunrise?.[i] || null,
        sunset: weather.daily.sunset?.[i] || null
      }));

      if (horas.length === 0) throw new Error('Sem dados horários');

      const novoCache = {
        atualizadoEm: new Date().toISOString(),
        lat: Number(lat),
        lon: Number(lon),
        origemNome: alvo.nome,
        horas,
        dias
      };

      estado.cache = novoCache;
      estado.modo = 'online';
      guardarCacheLocal(novoCache);
      if (forcarNotificacao) notificar('📡 Meteorologia marítima atualizada (5 dias guardados).');
    } catch (err) {
      const cacheGuardado = lerCacheLocal();
      if (cacheGuardado) {
        estado.cache = cacheGuardado;
        estado.modo = 'offline';
        if (forcarNotificacao) notificar('📴 Sem rede: a usar previsão guardada offline.');
      } else {
        estado.modo = 'sem-dados';
        if (forcarNotificacao) notificar('⚠️ Sem internet e sem previsão guardada em cache.');
      }
    } finally {
      estado.aCarregar = false;
      atualizarBotaoRefresh(false);
      renderizarTudo();
    }
  }

  // ==========================================
  // SELEÇÃO DA HORA ATUAL / INDEXAÇÃO
  // ==========================================
  function obterIndiceHoraAtual() {
    if (!estado.cache?.horas?.length) return -1;
    const isoAgora = formatarIsoHoraLocal(new Date());
    let idx = estado.cache.horas.findIndex((h) => h.time === isoAgora);
    if (idx >= 0) return idx;
    // Procurar a hora mais próxima não anterior, ou última disponível
    idx = estado.cache.horas.findIndex((h) => h.time >= isoAgora);
    return idx >= 0 ? idx : estado.cache.horas.length - 1;
  }

  function obterDadosHora(idx) {
    if (!estado.cache?.horas?.length || idx < 0 || idx >= estado.cache.horas.length) return null;
    const hora = estado.cache.horas[idx];
    const pesca = calcularIndicePescaHora(
      hora,
      estado.cache.horas,
      idx,
      estado.cache.dias || [],
      estado.cache.lat || LAGOS_PADRAO.lat,
      estado.cache.lon || LAGOS_PADRAO.lon
    );
    return { hora, pesca, idx };
  }

  function obterMelhoresJanelasDia(dataStr) {
    if (!estado.cache?.horas?.length) return [];
    const resultados = [];
    estado.cache.horas.forEach((h, idx) => {
      if (!h.time.startsWith(dataStr)) return;
      const pesca = calcularIndicePescaHora(
        h,
        estado.cache.horas,
        idx,
        estado.cache.dias || [],
        estado.cache.lat || LAGOS_PADRAO.lat,
        estado.cache.lon || LAGOS_PADRAO.lon
      );
      resultados.push({ hora: h, pesca, idx });
    });

    // Ordenar por maior índice e escolher picos espaçados (>= 2h entre si)
    const ordenados = [...resultados].sort((a, b) => b.pesca.indice - a.pesca.indice);
    const janelas = [];
    for (const item of ordenados) {
      const hNum = parseInt(item.hora.time.slice(11, 13), 10);
      const perto = janelas.some((j) => Math.abs(j.horaNum - hNum) < 3);
      if (!perto) {
        janelas.push({
          ...item,
          horaNum: hNum,
          horaInicio: `${String(hNum).padStart(2, '0')}:00`,
          horaFim: `${String((hNum + 2) % 24).padStart(2, '0')}:00`
        });
      }
      if (janelas.length >= 3) break;
    }
    return janelas.sort((a, b) => a.horaNum - b.horaNum);
  }

  // ==========================================
  // SETA DIRECIONAL NA CARTA NÁUTICA
  // ==========================================
  function atualizarSetaCarta(atual) {
    const mapaEl = document.getElementById('mapa');
    if (!mapaEl) return;

    if (!estado.controloMapaEl) {
      const el = document.createElement('div');
      el.id = 'meteoCartaSeta';
      el.className = 'meteo-carta-seta';
      el.title = 'Direção do vento (abatimento/deriva) e ondulação — Toca para abrir Meteo';
      el.addEventListener('click', () => alternarPainel(true));
      mapaEl.appendChild(el);
      estado.controloMapaEl = el;
    }

    if (!atual) {
      estado.controloMapaEl.style.display = 'none';
      return;
    }

    const { hora } = atual;
    // O vento sopra DE ventoDir, logo empurra/abate o barco PARA (ventoDir + 180)
    const rotAbatimento = Number.isFinite(hora.ventoDir) ? (hora.ventoDir + 180) % 360 : 0;
    const cardeal = grausParaCardeal(hora.ventoDir);
    const nomeLocal = obterNomeVentoLocal(hora.ventoDir);
    const rotOnda = Number.isFinite(hora.ondaDir) ? (hora.ondaDir + 180) % 360 : null;

    estado.controloMapaEl.style.display = 'flex';
    estado.controloMapaEl.innerHTML = `
      <div class="meteo-seta-rosa" title="Seta aponta para onde o vento abate o barco">
        <svg viewBox="0 0 36 36" width="32" height="32" aria-hidden="true">
          <circle cx="18" cy="18" r="16" fill="rgba(9,16,29,0.78)" stroke="rgba(56,189,248,0.45)" stroke-width="1.2"/>
          ${rotOnda !== null ? `<g transform="rotate(${rotOnda} 18 18)"><path d="M18 6 L21 13 L15 13 Z" fill="rgba(45,212,191,0.75)"/></g>` : ''}
          <g transform="rotate(${rotAbatimento} 18 18)">
            <line x1="18" y1="29" x2="18" y2="9" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>
            <polygon points="18,4 13.5,12.5 22.5,12.5" fill="#fbbf24"/>
          </g>
        </svg>
      </div>
      <div class="meteo-seta-info">
        <div class="meteo-seta-vento">💨 ${hora.ventoNos ?? '--'}kt ${cardeal}</div>
        <div class="meteo-seta-sub">${escaparHtml(nomeLocal)} · ${hora.vaga ?? '--'}m ${hora.periodoOnda ?? '--'}s</div>
      </div>
    `;
  }

  // ==========================================
  // BOTÃO COMPACTO NA BARRA SUPERIOR & PAINEL
  // ==========================================
  function atualizarBotaoTopo(atual) {
    const btn = document.getElementById('btnMeteoPesca');
    if (!btn) return;
    if (!atual) {
      btn.innerHTML = `🌤️ Meteo`;
      return;
    }
    const { hora, pesca } = atual;
    const vTxt = hora.ventoNos != null ? `${Math.round(hora.ventoNos)}kt` : '--kt';
    const oTxt = hora.vaga != null ? `${hora.vaga}m/${hora.periodoOnda ?? '-'}s` : '--m';
    btn.innerHTML = `🌤️ ${vTxt} · ${oTxt} · <span style="color:${pesca.cor};">🎣 ${pesca.indice}%</span>`;
  }

  function atualizarBotaoRefresh(aCarregar) {
    const btn = document.getElementById('btnMeteoAtualizar');
    if (!btn) return;
    btn.disabled = aCarregar;
    btn.textContent = aCarregar ? '⏳' : '🔄';
  }

  function construirPainelHtml() {
    if (document.getElementById('meteoPescaPainel')) return;
    const painel = document.createElement('aside');
    painel.id = 'meteoPescaPainel';
    painel.className = 'meteo-pesca-painel';
    painel.style.display = 'none';
    painel.innerHTML = `
      <div class="meteo-header">
        <div class="meteo-header-titulo">🌤️ Meteo &amp; 🎣 Hora do Peixe</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span id="meteoModoBadge" class="meteo-modo-badge">📡 Online</span>
          <button type="button" id="btnMeteoAtualizar" class="meteo-btn-icon" title="Atualizar previsão">🔄</button>
          <button type="button" id="btnFecharMeteo" class="diario-btn-fechar" title="Fechar">✖</button>
        </div>
      </div>
      <div id="meteoCorpo" class="meteo-body">
        <div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">⏳ A carregar meteorologia marítima...</div>
      </div>
    `;

    document.getElementById('app-container')?.appendChild(painel);
    document.getElementById('btnFecharMeteo').addEventListener('click', () => alternarPainel(false));
    document.getElementById('btnMeteoAtualizar').addEventListener('click', () => descarregarPrevisaoOpenMeteo(true));
  }

  function renderizarPainel(atual) {
    const corpo = document.getElementById('meteoCorpo');
    const badge = document.getElementById('meteoModoBadge');
    if (badge) {
      if (estado.modo === 'online') {
        badge.textContent = '📡 Online';
        badge.className = 'meteo-modo-badge online';
      } else if (estado.modo === 'offline') {
        badge.textContent = '📴 Offline Guardado';
        badge.className = 'meteo-modo-badge offline';
      } else {
        badge.textContent = '⚠️ Sem Dados';
        badge.className = 'meteo-modo-badge sem-dados';
      }
    }

    if (!corpo) return;
    if (!estado.cache?.horas?.length) {
      corpo.innerHTML = `
        <div style="padding:18px;text-align:center;color:#cbd5e1;font-size:13px;">
          <p>Sem previsão meteorológica guardada ainda.</p>
          <button type="button" onclick="window.MeteorologiaMaritima.atualizar(true)" class="diario-btn-primario" style="margin-top:8px;">🔄 Descarregar 5 Dias</button>
        </div>
      `;
      return;
    }

    const dias = estado.cache.dias || [];
    const hojeStr = new Date().toISOString().slice(0, 10);
    const janelasHoje = obterMelhoresJanelasDia(dias[0]?.data || hojeStr);

    if (estado.diaSelecionadoIdx >= dias.length) estado.diaSelecionadoIdx = 0;
    const diaAtivoStr = dias[estado.diaSelecionadoIdx]?.data || hojeStr;
    const horasDia = estado.cache.horas
      .map((h, idx) => ({ h, idx }))
      .filter((item) => item.h.time.startsWith(diaAtivoStr));

    // Garantir hora selecionada válida
    let itemSel = null;
    if (estado.horaSelecionadaIso) {
      const idxSel = estado.cache.horas.findIndex((h) => h.time === estado.horaSelecionadaIso);
      if (idxSel >= 0) itemSel = obterDadosHora(idxSel);
    }
    if (!itemSel) itemSel = atual || obterDadosHora(horasDia[0]?.idx ?? 0);

    const { hora, pesca } = itemSel;
    const cardealVento = grausParaCardeal(hora.ventoDir);
    const nomeVento = obterNomeVentoLocal(hora.ventoDir);
    const cardealOnda = grausParaCardeal(hora.ondaDir);
    const horaTxt = hora.time.slice(11, 16);
    const dataTxt = formatarDiaCurto(hora.time.slice(0, 10), dias.findIndex((d) => d.data === hora.time.slice(0, 10)));

    const solNascerTxt = `${String(Math.floor(pesca.sol.nascerH)).padStart(2, '0')}:${String(Math.round((pesca.sol.nascerH % 1) * 60) % 60).padStart(2, '0')}`;
    const solPorTxt = `${String(Math.floor(pesca.sol.porH)).padStart(2, '0')}:${String(Math.round((pesca.sol.porH % 1) * 60) % 60).padStart(2, '0')}`;
    const transitoTxt = `${String(Math.floor(pesca.solunar.transitoH)).padStart(2, '0')}:${String(Math.round((pesca.solunar.transitoH % 1) * 60) % 60).padStart(2, '0')}`;

    const janelasHtml = janelasHoje.length
      ? janelasHoje.map((j) => `
          <button type="button" class="meteo-janela-card" data-iso="${j.hora.time}">
            <div class="meteo-janela-top">
              <span class="meteo-janela-hora">⏰ ${j.horaInicio}–${j.horaFim}</span>
              <span class="meteo-janela-score" style="background:${j.pesca.cor}22;color:${j.pesca.cor};border-color:${j.pesca.cor}66;">
                ${j.pesca.indice}% ${j.pesca.nivel}
              </span>
            </div>
            <div class="meteo-janela-motivo">${escaparHtml(j.pesca.resumoMotivo)}</div>
          </button>
        `).join('')
      : `<div style="font-size:12px;color:#94a3b8;">Sem janelas calculadas para hoje.</div>`;

    const diasTabsHtml = dias.map((d, idx) => `
      <button type="button" class="meteo-dia-tab ${idx === estado.diaSelecionadoIdx ? 'ativo' : ''}" data-dia-idx="${idx}">
        ${formatarDiaCurto(d.data, idx)}
      </button>
    `).join('');

    const timelineHtml = horasDia.map(({ h, idx }) => {
      const p = calcularIndicePescaHora(
        h,
        estado.cache.horas,
        idx,
        dias,
        estado.cache.lat || LAGOS_PADRAO.lat,
        estado.cache.lon || LAGOS_PADRAO.lon
      );
      const selecionado = h.time === hora.time;
      return `
        <button type="button" class="meteo-hora-chip ${selecionado ? 'ativo' : ''}" data-iso="${h.time}">
          <span class="meteo-chip-h">${h.time.slice(11, 13)}h</span>
          <span class="meteo-chip-peixe" style="color:${p.cor};">🎣 ${p.indice}%</span>
          <span class="meteo-chip-vento">${h.ventoNos ?? '--'}kt</span>
          <span class="meteo-chip-vaga">${h.vaga ?? '--'}m</span>
        </button>
      `;
    }).join('');

    corpo.innerHTML = `
      <div class="meteo-local-bar">
        <span>📍 ${escaparHtml(estado.cache.origemNome || 'Lagos')} (${Number(estado.cache.lat).toFixed(2)}°N, ${Number(estado.cache.lon).toFixed(2)}°W)</span>
        <span>${pesca.lua.emoji} ${escaparHtml(pesca.lua.nome)}</span>
      </div>

      <!-- MELHORES JANELAS DE PESCA HOJE -->
      <div class="meteo-secao">
        <div class="meteo-sec-titulo">🔥 Melhores Janelas de Pesca Hoje</div>
        <div class="meteo-janelas-grid">${janelasHtml}</div>
      </div>

      <!-- SELETOR DE DIAS & LINHA TEMPORAL -->
      <div class="meteo-secao">
        <div class="meteo-sec-titulo">🎣 Melhores Horas para o Peixe Morder</div>
        <div class="meteo-dias-tabs">${diasTabsHtml}</div>
        <div class="meteo-timeline">${timelineHtml}</div>
      </div>

      <!-- DETALHE DA HORA SELECIONADA -->
      <div class="meteo-detalhe-card">
        <div class="meteo-detalhe-head">
          <div>
            <div style="font-size:12px;color:#94a3b8;">Previsão Selecionada</div>
            <div style="font-size:15px;font-weight:800;color:#f8fafc;">${dataTxt} · ${horaTxt}</div>
          </div>
          <div class="meteo-score-pill" style="background:${pesca.cor}22;color:${pesca.cor};border-color:${pesca.cor};">
            🎣 ${pesca.indice}% · ${pesca.nivel}
          </div>
        </div>

        <div class="meteo-grid-dados">
          <div class="meteo-dado-box">
            <span class="meteo-dado-lbl">💨 Vento</span>
            <span class="meteo-dado-val">${hora.ventoNos ?? '--'} kt <small>(${hora.ventoKmh ?? '--'} km/h)</small></span>
            <span class="meteo-dado-sub">${hora.ventoDir ?? '--'}° ${cardealVento} · ${escaparHtml(nomeVento)}</span>
          </div>
          <div class="meteo-dado-box">
            <span class="meteo-dado-lbl">🌬️ Rajadas</span>
            <span class="meteo-dado-val">${hora.rajadasNos ?? '--'} kt <small>(${hora.rajadasKmh ?? '--'} km/h)</small></span>
            <span class="meteo-dado-sub">Abatimento para ${grausParaCardeal((hora.ventoDir ?? 0) + 180)}</span>
          </div>
          <div class="meteo-dado-box">
            <span class="meteo-dado-lbl">🌊 Vaga &amp; Período</span>
            <span class="meteo-dado-val">${hora.vaga ?? '--'} m · ${hora.periodoOnda ?? '--'} s</span>
            <span class="meteo-dado-sub">Ondulação: ${hora.ondaDir ?? '--'}° ${cardealOnda}</span>
          </div>
          <div class="meteo-dado-box">
            <span class="meteo-dado-lbl">🌡️ Água &amp; Pressão</span>
            <span class="meteo-dado-val">${hora.tempAgua ?? '--'} °C · ${hora.pressao ?? '--'} hPa</span>
            <span class="meteo-dado-sub">Pressão: ${pesca.tendenciaPressao}</span>
          </div>
        </div>

        <div class="meteo-fatores-pesca">
          <div>🌊 <b>Maré (Lagos):</b> ${escaparHtml(pesca.mare.estado)} (${pesca.mare.amplitude})</div>
          <div>🌅 <b>Horas de Ouro:</b> Amanhecer ${solNascerTxt} · Anoitecer ${solPorTxt}</div>
          <div>🌙 <b>Solunar:</b> Trânsito Lunar ${transitoTxt} · ${escaparHtml(pesca.resumoMotivo)}</div>
        </div>
      </div>
    `;

    // Ligar cliques nas janelas, dias e horas
    corpo.querySelectorAll('.meteo-dia-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.diaSelecionadoIdx = parseInt(btn.dataset.diaIdx, 10) || 0;
        const dStr = dias[estado.diaSelecionadoIdx]?.data;
        const primeiraHora = estado.cache.horas.find((h) => h.time.startsWith(dStr));
        estado.horaSelecionadaIso = primeiraHora ? primeiraHora.time : null;
        renderizarPainel(atual);
      });
    });

    corpo.querySelectorAll('.meteo-hora-chip, .meteo-janela-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.iso;
        if (!iso) return;
        estado.horaSelecionadaIso = iso;
        const dIdx = dias.findIndex((d) => iso.startsWith(d.data));
        if (dIdx >= 0) estado.diaSelecionadoIdx = dIdx;
        renderizarPainel(atual);
      });
    });
  }

  function renderizarTudo() {
    const idxAtual = obterIndiceHoraAtual();
    const atual = idxAtual >= 0 ? obterDadosHora(idxAtual) : null;
    atualizarBotaoTopo(atual);
    atualizarSetaCarta(atual);
    if (estado.painelAberto) {
      renderizarPainel(atual);
    }
  }

  function alternarPainel(forcarEstado) {
    const painel = document.getElementById('meteoPescaPainel');
    if (!painel) return;
    const abrir = typeof forcarEstado === 'boolean' ? forcarEstado : painel.style.display === 'none';
    estado.painelAberto = abrir;
    painel.style.display = abrir ? 'flex' : 'none';
    if (abrir) {
      const idxAtual = obterIndiceHoraAtual();
      estado.horaSelecionadaIso = idxAtual >= 0 ? estado.cache.horas[idxAtual].time : null;
      estado.diaSelecionadoIdx = 0;
      renderizarTudo();
    }
  }

  // ==========================================
  // API PÚBLICA PARA DIÁRIO & IA PESCA
  // ==========================================
  function obterDadosAtuais() {
    const idxAtual = obterIndiceHoraAtual();
    if (idxAtual < 0) return null;
    const { hora, pesca } = obterDadosHora(idxAtual);
    const cardeal = grausParaCardeal(hora.ventoDir);
    const nomeLocal = obterNomeVentoLocal(hora.ventoDir);

    let estadoMarDiario = 'Chão';
    if (Number.isFinite(hora.vaga)) {
      if (hora.vaga < 0.4) estadoMarDiario = 'Chão';
      else if (hora.vaga < 0.9) estadoMarDiario = 'Marezia';
      else if (hora.vaga < 1.6) estadoMarDiario = 'Picado';
      else estadoMarDiario = 'Vaga';
    }

    return {
      modo: estado.modo,
      horaIso: hora.time,
      ventoNos: hora.ventoNos,
      ventoKmh: hora.ventoKmh,
      rajadasNos: hora.rajadasNos,
      ventoDir: hora.ventoDir,
      ventoCardeal: cardeal,
      ventoLocal: nomeLocal,
      ventoTexto: `${hora.ventoNos ?? '--'} kt ${cardeal} (${nomeLocal})`,
      vagaM: hora.vaga,
      periodoS: hora.periodoOnda,
      vagaTexto: hora.vaga != null ? `${hora.vaga} m (${hora.periodoOnda ?? '--'}s)` : '',
      ondaDir: hora.ondaDir,
      estadoMarDiario,
      pressaoHpa: hora.pressao,
      pressaoTexto: hora.pressao != null ? `${hora.pressao} hPa` : '',
      tendenciaPressao: pesca.tendenciaPressao,
      tempAguaC: hora.tempAgua,
      tempAguaTexto: hora.tempAgua != null ? `${hora.tempAgua} °C` : '',
      mare: pesca.mare,
      lua: pesca.lua,
      indicePesca: pesca.indice,
      nivelPesca: pesca.nivel,
      resumoMotivo: pesca.resumoMotivo
    };
  }

  function obterResumoParaIA() {
    const atual = obterDadosAtuais();
    if (!atual) {
      return {
        disponivel: false,
        textoResumo: 'Sem dados meteorológicos em cache.',
        janelasHoje: []
      };
    }
    const hojeStr = (estado.cache?.dias?.[0]?.data) || new Date().toISOString().slice(0, 10);
    const janelas = obterMelhoresJanelasDia(hojeStr).map((j) => ({
      horario: `${j.horaInicio}-${j.horaFim}`,
      indice: j.pesca.indice,
      nivel: j.pesca.nivel,
      motivo: j.pesca.resumoMotivo
    }));

    const janelasTxt = janelas.length
      ? janelas.map((j) => `${j.horario} (${j.indice}% ${j.nivel}: ${j.motivo})`).join('; ')
      : 'Sem janelas calculadas';

    const textoResumo =
      `Meteo (${atual.modo === 'online' ? 'Online' : 'Offline Cache'}): ` +
      `Vento ${atual.ventoTexto} (rajadas ${atual.rajadasNos ?? '--'} kt) | ` +
      `Vaga ${atual.vagaTexto || '--'} | Pressão ${atual.pressaoTexto || '--'} (${atual.tendenciaPressao}) | ` +
      `Água ${atual.tempAguaTexto || '--'} | Maré ${atual.mare.estado} (${atual.mare.amplitude}) | ` +
      `Atividade Peixe Agora: ${atual.indicePesca}% (${atual.nivelPesca}) | ` +
      `Melhores Janelas Hoje: ${janelasTxt}`;

    return {
      disponivel: true,
      atual,
      janelasHoje: janelas,
      textoResumo
    };
  }

  // ==========================================
  // INICIALIZAÇÃO
  // ==========================================
  function inicializar() {
    construirPainelHtml();

    // Carregar cache imediato para arranque instantâneo (mesmo offline no mar)
    const cacheGuardado = lerCacheLocal();
    if (cacheGuardado) {
      estado.cache = cacheGuardado;
      estado.modo = navigator.onLine ? 'online' : 'offline';
      renderizarTudo();
    }

    // Atualizar em segundo plano se houver internet
    descarregarPrevisaoOpenMeteo(false);
    setInterval(() => descarregarPrevisaoOpenMeteo(false), INTERVALO_AUTO_ATUALIZAR_MS);

    window.addEventListener('online', () => descarregarPrevisaoOpenMeteo(false));
    window.addEventListener('offline', () => {
      if (estado.cache) {
        estado.modo = 'offline';
        renderizarTudo();
      }
    });
  }

  window.MeteorologiaMaritima = {
    alternarPainel,
    atualizar: descarregarPrevisaoOpenMeteo,
    obterDadosAtuais,
    obterResumoParaIA
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
