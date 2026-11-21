/**
 * VigilanteAI Maps — GPS Náutico para Telemóvel
 * Navegação, Rastreamento em Tempo Real e Importação Completa de Ficheiros GPX
 */

(() => {
  // ==========================================
  // ESTADO GLOBAL DO SISTEMA
  // ==========================================
  const estado = {
    posicao: null, // { lat, lon, sog, cog, altitude, precisao, hora }
    rumoBussola: null,
    modoSeguir: true,
    modoNoturno: false,
    unidadeVel: 'nos', // 'nos' ou 'kmh'
    formatoCoord: 'ddm', // 'ddm', 'decimal', 'dms'
    transmitirServidor: true,
    gravandoTrilho: false,
    trilho: [], // [{lat, lon, tempo, sog}]
    distanciaTrilhoM: 0,
    tempoInicioTrilho: null,
    intervaloGravacao: null,
    waypoints: [], // [{id, nome, lat, lon, ele, desc, sym, camada}]
    camadaWaypoints: null,
    camadaTrilhosGpx: null,
    camadaRastoNavegacao: null,
    linhaNavegacaoAtiva: null,
    waypointAtivo: null,
    wakeLock: null,
    mapa: null,
    marcadorBarco: null,
    circuloPrecisao: null,
    linhaProa: null,
    filtroAtual: 'todos',
    termoPesquisa: ''
  };

  window.__vigilanteEstadoGps = estado;
  const MODO_ESTATICO_WEB = location.hostname.includes('github.io') || location.protocol === 'file:';

  // Coordenadas iniciais padrão (Costa do Algarve — Portimão / Lagos / Sagres)
  const COORD_PADRAO = [37.1105, -8.5680];

  // ==========================================
  // INICIALIZAÇÃO DA INTERFACE & MAPA
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    inicializarMapa();
    carregarPreferencias();
    configurarEventosUI();
    iniciarLocalizacaoGps();
    iniciarBussola();
    solicitarWakeLock();
    registarServiceWorker();
    carregarPesqueirosDisponiveis();
    carregar54BolinhasPadrao();
  });

  function carregar54BolinhasPadrao() {
    setTimeout(() => {
      window.carregarPesqueiroServidor('54_Bolinhas_completo_Esferas.gpx');
    }, 500);
  }

  function inicializarMapa() {
    estado.mapa = L.map('mapa', {
      zoomControl: false,
      attributionControl: false,
      maxZoom: 19
    }).setView(COORD_PADRAO, 13);
    window.mapaGpsNautico = estado.mapa;

    // Controlo de Zoom em posição ergonómica para toque
    L.control.zoom({ position: 'bottomright' }).addTo(estado.mapa);

    // 1. OpenStreetMap
    const terrestre = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: 'OSM'
    });

    // 2. OpenSeaMap (Marcas náuticas, faróis e boias)
    const nautica = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.95
    });

    // 3. Satélite de Alta Resolução (Esri World Imagery)
    const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri Satellite'
    });

    // 4. CartoDB Dark Matter (Excelente para cartas noturnas)
    const escuro = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    });

    // Adicionar bases padrão
    terrestre.addTo(estado.mapa);
    nautica.addTo(estado.mapa);

    // 5. Curvas Batimétricas Algarvias (2 a 51 braças do Vigilante)
    window.dadosBatimetria = [];
    const curvasLocais = L.geoJSON(null, {
      style: (feature) => {
        const bracas = feature.properties.bracas || Math.round(Math.abs(feature.properties.profundidade) / 1.8288);
        const ehMultiplo5 = (bracas % 5 === 0);
        return {
          color: ehMultiplo5 ? "#ffcc00" : "#38bdf8",
          weight: ehMultiplo5 ? 2.8 : 1.6,
          opacity: ehMultiplo5 ? 0.95 : 0.8,
          dashArray: ehMultiplo5 ? null : "3, 3",
          className: "linha-batimetrica-mobile"
        };
      },
      onEachFeature: (feature, layer) => {
        const bracas = feature.properties.bracas || Math.round(Math.abs(feature.properties.profundidade) / 1.8288);
        const metros = (feature.properties.prof_m ? Math.abs(feature.properties.prof_m) : Math.abs(feature.properties.profundidade)).toFixed(1);

        // Touch buffer de 34px para toque fácil e imediato em ecrãs táteis
        const bufferLayer = L.polyline(layer.getLatLngs(), {
          weight: 34,
          color: "#000000",
          opacity: 0.0001,
          lineCap: "round",
          lineJoin: "round",
          interactive: true,
          bubblingMouseEvents: true
        });

        const tooltipHtml = `
          <div style="font-family:sans-serif;font-size:13px;font-weight:bold;color:#f8fafc;display:flex;align-items:center;gap:6px;">
            <span style="color:#fbbf24;">⚓ ${bracas} braças</span>
            <span style="color:#94a3b8;font-size:11px;font-weight:normal;">(${metros} m)</span>
          </div>
        `;

        bufferLayer.bindTooltip(tooltipHtml, {
          sticky: true,
          direction: "top",
          offset: [0, -12],
          opacity: 1,
          className: "tooltip-batimetria"
        });

        bufferLayer.bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;line-height:1.4;color:#0f172a;min-width:160px;">
            <b style="color:#0284c7;font-size:14px;">⚓ Isobática Batimétrica</b><br>
            Profundidade: <b style="font-size:16px;color:#d97706;">${bracas} braças</b> <span style="color:#64748b;">(${metros} m)</span><br>
            <span style="font-size:11px;color:#64748b;">Costa Sul de Portugal • 2-51 braças</span>
          </div>
        `);

        function selecionarCurva() {
          if (layer.setStyle) {
            layer.setStyle({ color: '#ffffff', weight: 4.5, opacity: 1 });
            setTimeout(() => {
              const ehMultiplo5 = (bracas % 5 === 0);
              layer.setStyle({
                color: ehMultiplo5 ? "#ffcc00" : "#38bdf8",
                weight: ehMultiplo5 ? 2.8 : 1.6,
                opacity: ehMultiplo5 ? 0.95 : 0.8,
                dashArray: ehMultiplo5 ? null : "3, 3"
              });
            }, 2500);
          }
          atualizarBatimetriaHud(bracas, metros);
          mostrarNotificacao(`⚓ Batimetria: ${bracas} braças (${metros} m)`, 2500);
        }

        bufferLayer.on('click', selecionarCurva);
        bufferLayer.on('mouseover', function() {
          atualizarBatimetriaHud(bracas, metros);
        });

        curvasLocais.addLayer(bufferLayer);
      }
    });

    // Carregar GeoJSON das curvas submarinas
    fetch('static/curvas_submarinas_5m.geojson')
      .then(r => r.ok ? r.json() : null)
      .then(dados => {
        if (dados) {
          window.dadosBatimetria = dados.features || [];
          curvasLocais.addData(dados);
          curvasLocais.addTo(estado.mapa);
        }
      })
      .catch(e => console.warn('Curvas batimétricas locais não carregadas:', e));

    // Camadas de Waypoints & Trilhos
    if (typeof L.markerClusterGroup === 'function') {
      estado.camadaWaypoints = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 40,
        disableClusteringAtZoom: 16
      });
    } else {
      estado.camadaWaypoints = L.featureGroup();
    }
    estado.camadaWaypoints.addTo(estado.mapa);

    estado.camadaTrilhosGpx = L.featureGroup().addTo(estado.mapa);
    estado.camadaRastoNavegacao = L.polyline([], {
      color: '#ef4444',
      weight: 3.5,
      opacity: 0.85,
      lineCap: 'round'
    }).addTo(estado.mapa);

    // Controlo de Camadas Leaflet
    L.control.layers(
      {
        '🗺️ Carta Terrestre (OSM)': terrestre,
        '🛰️ Imagem de Satélite HD': satelite,
        '🌌 Carta Náutica Noturna': escuro
      },
      {
        '⚓ Balizagem & Marcas (OpenSeaMap)': nautica,
        '🌊 Curvas de Batimetria (2 a 51 braças)': curvasLocais
      },
      { position: 'topright', collapsed: true }
    ).addTo(estado.mapa);

    // Marcador da Embarcação / Posição do Telemóvel
    criarMarcadorBarco(COORD_PADRAO);

    // Se o utilizador arrastar o mapa manualmente, desativar temporariamente o "Modo Seguir"
    estado.mapa.on('dragstart', () => {
      if (estado.modoSeguir) {
        setModoSeguir(false);
      }
    });

    // Ao tocar no mapa, inspecionar coordenadas e permitir colocar barco
    estado.mapa.on('click', (e) => {
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      const coordTxt = formatarCoordenadaNautica(lat, lon);

      L.popup({ offset: [0, -10] })
        .setLatLng(e.latlng)
        .setContent(`
          <div style="font-family:sans-serif;font-size:13px;line-height:1.5;min-width:180px;text-align:center;color:#0f172a;">
            <b style="color:#0284c7;">⚓ Coordenadas Náuticas</b><br>
            <span style="font-size:12px;color:#334155;font-weight:600;">${coordTxt}</span><br>
            <button onclick="window.definirMinhaPosicaoManual(${lat}, ${lon})" style="margin-top:8px;background:#0284c7;color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:bold;cursor:pointer;width:100%;">
              📍 Colocar Meu Barco Aqui
            </button>
          </div>
        `)
        .openOn(estado.mapa);
    });
  }

  window.definirMinhaPosicaoManual = function(lat, lon) {
    estado.posicao = {
      lat: Number(lat),
      lon: Number(lon),
      sog: 0.0,
      sogKmh: 0.0,
      cog: 0.0,
      altitude: 0,
      precisao: 3,
      hora: new Date().toLocaleTimeString()
    };
    try {
      localStorage.setItem('vigilante_ultima_posicao', JSON.stringify({ lat: Number(lat), lon: Number(lon) }));
    } catch (e) {}

    atualizarMarcadorPosicao(lat, lon, 0, 3);
    atualizarHudNumerico();
    atualizarBatimetriaPorPosicao(lat, lon);

    const badge = document.getElementById('gpsBadge');
    const badgeTxt = document.getElementById('gpsBadgeTxt');
    if (badge) {
      badge.className = 'gps-badge';
      badgeTxt.textContent = 'Posição Definida';
    }

    if (estado.mapa) {
      estado.mapa.setView([lat, lon], 16);
      estado.mapa.closePopup();
    }
    mostrarNotificacao(`📍 Barco posicionado em: ${formatarCoordenadaNautica(lat, lon)}`, 2500);

    if (estado.transmitirServidor) {
      transmitirGpsAoServidor(lat, lon, 0, 0);
    }
  };

  function criarMarcadorBarco(pos) {
    const iconeBarco = L.divIcon({
      className: 'marcador-barco-container',
      html: `
        <div id="iconeBarcoRotativo" class="marcador-barco-svg">
          <svg viewBox="0 0 44 44" width="44" height="44">
            <!-- Sombra e Anel exterior de rumo -->
            <circle cx="22" cy="22" r="19" fill="rgba(2, 132, 199, 0.2)" stroke="#38bdf8" stroke-width="1.8" />
            <!-- Barco / Flecha náutica direcional -->
            <path d="M22 6 L32 34 L22 28 L12 34 Z" fill="#0284c7" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
            <!-- Ponto central de fixação GPS -->
            <circle cx="22" cy="22" r="3.5" fill="#38bdf8" />
          </svg>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    estado.marcadorBarco = L.marker(pos, {
      icon: iconeBarco,
      zIndexOffset: 1000
    }).addTo(estado.mapa);

    estado.circuloPrecisao = L.circle(pos, {
      radius: 15,
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
      weight: 1
    }).addTo(estado.mapa);

    estado.linhaProa = L.polyline([pos, pos], {
      color: '#38bdf8',
      weight: 2,
      dashArray: '4, 6',
      opacity: 0.8
    }).addTo(estado.mapa);
  }

  // ==========================================
  // GPS EM TEMPO REAL & OPERAÇÃO NÁUTICA
  // ==========================================
  function inicializarPosicaoPadrao() {
    let lat = COORD_PADRAO[0];
    let lon = COORD_PADRAO[1];

    try {
      const guardada = localStorage.getItem('vigilante_ultima_posicao');
      if (guardada) {
        const p = JSON.parse(guardada);
        if (p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon)) {
          lat = Number(p.lat);
          lon = Number(p.lon);
        }
      }
    } catch (e) {}

    estado.posicao = {
      lat,
      lon,
      sog: 0.0,
      sogKmh: 0.0,
      cog: 0.0,
      altitude: 0,
      precisao: 10,
      hora: new Date().toLocaleTimeString()
    };
    atualizarMarcadorPosicao(lat, lon, 0, 10);
    atualizarHudNumerico();
    atualizarBatimetriaPorPosicao(lat, lon);
  }

  function sincronizarTelemetriaBordo() {
    if (MODO_ESTATICO_WEB) return;
    // Sincronizar apenas sonda ou telemetria auxiliar, NUNCA sobrepor a posição do utilizador
    fetch('/api/maritimo/telemetria')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.sonda && d.sonda.profundidade_bracas) {
          atualizarBatimetriaHud(d.sonda.profundidade_bracas, d.sonda.profundidade_m);
        }
      })
      .catch(() => {});
  }

  window.ativarModoHttps = function() {
    mostrarNotificacao('A abrir GPS Seguro (HTTPS porta 8767)...', 2000);
    setTimeout(() => {
      window.location.href = `https://${location.hostname}:8767/gps`;
    }, 400);
  };

  function ativarLocalizacaoGpsReal(explicitUserAction = false) {
    const emHttp = (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');

    if (emHttp) {
      if (explicitUserAction) {
        window.ativarModoHttps();
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      if (explicitUserAction) {
        mostrarNotificacao('Geolocalização não suportada neste telemóvel.', 3000);
      }
      return;
    }

    const badge = document.getElementById('gpsBadge');
    const badgeTxt = document.getElementById('gpsBadgeTxt');
    if (badgeTxt) badgeTxt.textContent = 'A fixar satélites...';
    if (badge) badge.className = 'gps-badge a-procurar';

    const opcoes = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        processarPosicaoGps(pos);
        if (estado.mapa) {
          estado.mapa.setView([pos.coords.latitude, pos.coords.longitude], 16);
        }
        mostrarNotificacao(`🎯 GPS Fix Real: ±${Math.round(pos.coords.accuracy)}m`, 2500);
      },
      (err) => {
        tratarErroGps(err);
      },
      opcoes
    );

    if (estado.watchGpsId) {
      navigator.geolocation.clearWatch(estado.watchGpsId);
    }
    estado.watchGpsId = navigator.geolocation.watchPosition(
      processarPosicaoGps,
      tratarErroGps,
      opcoes
    );
  }

  function iniciarLocalizacaoGps() {
    const banner = document.getElementById('bannerHttpsGps');
    const badge = document.getElementById('gpsBadge');
    const badgeTxt = document.getElementById('gpsBadgeTxt');
    const emHttp = (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');

    inicializarPosicaoPadrao();
    sincronizarTelemetriaBordo();
    setInterval(sincronizarTelemetriaBordo, 5000);

    if (emHttp) {
      if (banner) banner.style.display = 'flex';
      if (badgeTxt) badgeTxt.textContent = 'GPS requer HTTPS';
      if (badge) {
        badge.className = 'gps-badge sem-sinal';
        badge.style.cursor = 'pointer';
        badge.title = 'Toca para ligar o GPS em modo HTTPS seguro';
        badge.onclick = () => window.ativarModoHttps();
      }
    } else {
      if (banner) banner.style.display = 'none';
      if (badgeTxt) badgeTxt.textContent = 'A ligar GPS...';
      if (badge) {
        badge.style.cursor = 'pointer';
        badge.onclick = () => ativarLocalizacaoGpsReal(true);
      }
      ativarLocalizacaoGpsReal(false);
    }
  }

  function processarPosicaoGps(pos) {
    estado.gpsHardwareAtivo = true;
    const banner = document.getElementById('bannerHttpsGps');
    if (banner) banner.style.display = 'none';

    const coords = pos.coords;
    const lat = coords.latitude;
    const lon = coords.longitude;
    const precisao = coords.accuracy || 10;
    const altitude = coords.altitude !== null ? coords.altitude : 0;
    
    // Velocidade (m/s para nós e km/h)
    let velocidadeMs = coords.speed !== null && coords.speed >= 0 ? coords.speed : 0;
    let velocidadeNos = (velocidadeMs * 1.94384);
    let velocidadeKmh = (velocidadeMs * 3.6);

    // Rumo (Heading)
    let cog = coords.heading !== null && !isNaN(coords.heading) && coords.heading >= 0
      ? coords.heading
      : (estado.rumoBussola !== null ? estado.rumoBussola : 0);

    if (velocidadeNos < 0.5 && estado.rumoBussola !== null) {
      cog = estado.rumoBussola;
    }

    const hora = new Date(pos.timestamp).toLocaleTimeString();

    estado.posicao = {
      lat,
      lon,
      sog: velocidadeNos,
      sogKmh: velocidadeKmh,
      cog,
      altitude,
      precisao,
      hora
    };

    // Guardar em memória local do telemóvel a última posição real
    try {
      localStorage.setItem('vigilante_ultima_posicao', JSON.stringify({ lat, lon }));
    } catch (e) {}

    // Atualizar Badge de Status
    const badge = document.getElementById('gpsBadge');
    const badgeTxt = document.getElementById('gpsBadgeTxt');
    if (badge) {
      badge.className = 'gps-badge';
      badgeTxt.textContent = `GPS Fix ±${Math.round(precisao)}m`;
    }

    // Atualizar Marcadores no Mapa
    atualizarMarcadorPosicao(lat, lon, cog, precisao);

    // Atualizar HUD Numérico
    atualizarHudNumerico();

    // Se estiver a gravar trajeto, adicionar ponto
    if (estado.gravandoTrilho) {
      adicionarPontoAoTrilho(lat, lon, velocidadeNos);
    }

    // Se houver navegação ativa para waypoint, recalcular dados
    if (estado.waypointAtivo) {
      atualizarNavegacaoAtiva();
    }

    // Atualizar batimetria aproximada na posição do barco
    atualizarBatimetriaPorPosicao(lat, lon);

    // Se o Modo Seguir estiver ligado, centrar mapa na posição real
    if (estado.modoSeguir && estado.mapa) {
      estado.mapa.setView([lat, lon], estado.mapa.getZoom() < 15 ? 16 : estado.mapa.getZoom());
    }

    // Transmitir telemetria para o servidor VigilanteAI Maps
    if (estado.transmitirServidor) {
      transmitirGpsAoServidor(lat, lon, velocidadeNos, cog);
    }
  }

  function tratarErroGps(err) {
    const badge = document.getElementById('gpsBadge');
    const badgeTxt = document.getElementById('gpsBadgeTxt');
    const emHttp = (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');

    if (badge && !estado.gpsHardwareAtivo) {
      badge.className = 'gps-badge sem-sinal';
      badgeTxt.textContent = emHttp ? 'GPS requer HTTPS' : 'Sem Fix GPS';
    }
  }

  function atualizarMarcadorPosicao(lat, lon, cog, precisao) {
    const pos = [lat, lon];
    if (estado.marcadorBarco) {
      estado.marcadorBarco.setLatLng(pos);
      const elemSvg = document.getElementById('iconeBarcoRotativo');
      if (elemSvg) {
        elemSvg.style.transform = `rotate(${Math.round(cog)}deg)`;
      }
    }

    if (estado.circuloPrecisao) {
      estado.circuloPrecisao.setLatLng(pos);
      estado.circuloPrecisao.setRadius(Math.max(precisao, 5));
    }

    // Vetor de proa (linha projetada para 0.5 NM na direção do COG)
    if (estado.linhaProa) {
      const pontaProa = calcularPontoDestino(lat, lon, 0.5, cog);
      estado.linhaProa.setLatLngs([pos, [pontaProa.lat, pontaProa.lon]]);
    }
  }

  function atualizarHudNumerico() {
    if (!estado.posicao) return;
    const { lat, lon, sog, sogKmh, cog, precisao, altitude } = estado.posicao;

    // Velocidade
    const elVel = document.getElementById('hudVelocidade');
    const elVelUnid = document.getElementById('hudVelUnidade');
    if (elVel) {
      if (estado.unidadeVel === 'nos') {
        elVel.textContent = sog.toFixed(1);
        if (elVelUnid) elVelUnid.textContent = 'KTS';
      } else {
        elVel.textContent = sogKmh.toFixed(1);
        if (elVelUnid) elVelUnid.textContent = 'KM/H';
      }
    }

    // Rumo
    const elRumo = document.getElementById('hudRumo');
    const elRumoCard = document.getElementById('hudRumoCardeal');
    if (elRumo) {
      elRumo.textContent = `${Math.round(cog).toString().padStart(3, '0')}°`;
      if (elRumoCard) elRumoCard.textContent = obterPontoCardeal(cog);
    }

    // Coordenadas
    const elCoords = document.getElementById('hudCoordenadas');
    if (elCoords) {
      if (estado.formatoCoord === 'ddm') {
        elCoords.innerHTML = formatarCoordenadaNauticaHtml(lat, lon);
      } else if (estado.formatoCoord === 'dms') {
        elCoords.textContent = formatarCoordenadaDms(lat, lon);
      } else {
        elCoords.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
      }
    }

    // Precisão & Altitude
    const elPrecisao = document.getElementById('hudPrecisao');
    if (typeof window.atualizarPainelAorus === 'function') window.atualizarPainelAorus();
    if (elPrecisao) {
      elPrecisao.textContent = `±${Math.round(precisao)}m`;
    }
    const elAlt = document.getElementById('hudAltitude');
    if (elAlt) {
      elAlt.textContent = `${Math.round(altitude)}m`;
    }
  }

  function atualizarBatimetriaHud(bracas, metros) {
    const el = document.getElementById('hudBatimetria');
    if (el) {
      el.innerHTML = `<span style="color:#fbbf24;font-weight:bold;">${bracas} br</span> <span style="font-size:11px;color:#94a3b8;">(${metros}m)</span>`;
    }
  }
  window.atualizarBatimetriaHud = atualizarBatimetriaHud;

  function atualizarBatimetriaPorPosicao(lat, lon) {
    if (!window.dadosBatimetria || window.dadosBatimetria.length === 0) return;
    let menorDist = Infinity;
    let melhorFeature = null;

    for (let i = 0; i < window.dadosBatimetria.length; i++) {
      const feat = window.dadosBatimetria[i];
      const coords = feat.geometry && feat.geometry.coordinates;
      if (!coords) continue;
      for (let j = 0; j < coords.length; j += 4) {
        const pt = coords[j];
        const dLat = (lat - pt[1]);
        const dLon = (lon - pt[0]);
        const distSq = dLat * dLat + dLon * dLon;
        if (distSq < menorDist) {
          menorDist = distSq;
          melhorFeature = feat;
        }
      }
    }

    if (melhorFeature && menorDist < 0.00002) {
      const bracas = melhorFeature.properties.bracas || Math.round(Math.abs(melhorFeature.properties.profundidade) / 1.8288);
      const metros = (melhorFeature.properties.prof_m ? Math.abs(melhorFeature.properties.prof_m) : Math.abs(melhorFeature.properties.profundidade)).toFixed(1);
      atualizarBatimetriaHud(bracas, metros);
    }
  }

  // ==========================================
  // BÚSSOLA / ORIENTAÇÃO DO DISPOSITIVO
  // ==========================================
  function iniciarBussola() {
    if (window.DeviceOrientationEvent) {
      try {
        escutarOrientacao();
      } catch (e) {}
    }
  }

  function escutarOrientacao() {
    window.addEventListener('deviceorientationabsolute', (e) => {
      let heading = e.alpha;
      if (e.webkitCompassHeading) {
        heading = e.webkitCompassHeading; // iOS Safari
      }
      if (heading !== null && heading !== undefined) {
        estado.rumoBussola = heading;
        if (typeof window.atualizarPainelAorus === 'function') window.atualizarPainelAorus();
      }
    }, true);

    window.addEventListener('deviceorientation', (e) => {
      if (estado.rumoBussola === null && e.alpha !== null) {
        estado.rumoBussola = 360 - e.alpha;
        if (typeof window.atualizarPainelAorus === 'function') window.atualizarPainelAorus();
      }
    }, true);
  }

  // ==========================================
  // PARSER E IMPORTAÇÃO ROBUSTA DE FICHEIROS GPX
  // ==========================================
  function importarFicheiroGpxTexto(conteudoXml, nomeFicheiro = 'ficheiro.gpx') {
    try {
      mostrarNotificacao('A analisar ficheiro GPX...', 2000);
      const parser = new DOMParser();
      const docXml = parser.parseFromString(conteudoXml, 'application/xml');

      if (docXml.querySelector('parsererror')) {
        throw new Error('Formato XML inválido ou ficheiro corrompido.');
      }

      const novosWaypoints = [];
      const novosTrilhos = [];

      // 1. Extração de Waypoints (<wpt>)
      const wpts = docXml.getElementsByTagName('wpt');
      for (let i = 0; i < wpts.length; i++) {
        const el = wpts[i];
        const lat = parseFloat(el.getAttribute('lat'));
        const lon = parseFloat(el.getAttribute('lon'));

        if (isNaN(lat) || isNaN(lon)) continue;

        const nome = obterTextoTag(el, 'name') || `WPT_${estado.waypoints.length + novosWaypoints.length + 1}`;
        const desc = obterTextoTag(el, 'desc') || '';
        const ele = parseFloat(obterTextoTag(el, 'ele')) || null;
        const sym = obterTextoTag(el, 'sym') || 'Waypoint';
        const tipoTag = obterTextoTag(el, 'type') || '';

        novosWaypoints.push({
          id: `wpt_${Date.now()}_${i}`,
          nome,
          lat,
          lon,
          ele,
          desc,
          sym,
          tipo: tipoTag,
          origem: nomeFicheiro
        });
      }

      // 2. Extração de Trilhos (<trk> -> <trkseg> -> <trkpt>)
      const trks = docXml.getElementsByTagName('trk');
      for (let t = 0; t < trks.length; t++) {
        const nomeTrilho = obterTextoTag(trks[t], 'name') || `Trilho ${t + 1}`;
        const trkpts = trks[t].getElementsByTagName('trkpt');
        const coordenadasTrilho = [];

        for (let p = 0; p < trkpts.length; p++) {
          const lat = parseFloat(trkpts[p].getAttribute('lat'));
          const lon = parseFloat(trkpts[p].getAttribute('lon'));
          if (!isNaN(lat) && !isNaN(lon)) {
            coordenadasTrilho.push([lat, lon]);
          }
        }

        if (coordenadasTrilho.length > 0) {
          novosTrilhos.push({
            nome: nomeTrilho,
            pontos: coordenadasTrilho
          });
        }
      }

      // 3. Extração de Rotas (<rte> -> <rtept>)
      const rtes = docXml.getElementsByTagName('rte');
      for (let r = 0; r < rtes.length; r++) {
        const nomeRota = obterTextoTag(rtes[r], 'name') || `Rota ${r + 1}`;
        const rtepts = rtes[r].getElementsByTagName('rtept');
        const coordenadasRota = [];

        for (let p = 0; p < rtepts.length; p++) {
          const lat = parseFloat(rtepts[p].getAttribute('lat'));
          const lon = parseFloat(rtepts[p].getAttribute('lon'));
          if (!isNaN(lat) && !isNaN(lon)) {
            coordenadasRota.push([lat, lon]);
          }
        }

        if (coordenadasRota.length > 0) {
          novosTrilhos.push({
            nome: nomeRota,
            pontos: coordenadasRota,
            ehRota: true
          });
        }
      }

      // Renderizar no Mapa
      renderizarWaypointsGpx(novosWaypoints);
      renderizarTrilhosGpx(novosTrilhos);

      // Guardar na lista
      estado.waypoints = estado.waypoints.concat(novosWaypoints);
      atualizarContadorWaypoints();
      atualizarListaWaypointsGaveta();

      if (typeof window.integrarGpxNaPastaEventos === 'function') {
        window.integrarGpxNaPastaEventos(novosWaypoints, nomeFicheiro);
      }

      // Ajustar visualização do mapa para englobar os pontos importados
      if (novosWaypoints.length > 0) {
        const grupoBounds = L.latLngBounds(novosWaypoints.map(w => [w.lat, w.lon]));
        estado.mapa.fitBounds(grupoBounds, { padding: [40, 40], maxZoom: 15 });
      }

      fecharModalImportar();
      mostrarNotificacao(`GPX Carregado: ${novosWaypoints.length} waypoints e ${novosTrilhos.length} linhas/trilhos.`, 3500);

    } catch (err) {
      console.error('Falha ao processar GPX:', err);
      mostrarNotificacao(`Erro ao ler GPX: ${err.message}`, 4000);
    }
  }

  function obterTextoTag(elem, tag) {
    const f = elem.getElementsByTagName(tag);
    if (f && f.length > 0 && f[0].textContent) {
      return f[0].textContent.trim();
    }
    return '';
  }

  function renderizarWaypointsGpx(listaWpts) {
    const iconeWaypoint = L.divIcon({
      className: 'marcador-gpx-custom',
      html: `
        <div style="background:#0284c7;color:#ffffff;border:2px solid #ffffff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.5);font-size:11px;font-weight:bold;">
          ⚓
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    listaWpts.forEach(wpt => {
      let icone = iconeWaypoint;
      const symLow = (wpt.sym || '').toLowerCase();
      if (symLow.includes('esfera')) {
        icone = L.divIcon({
          className: 'marcador-esfera',
          html: `<div style="background:radial-gradient(circle at 30% 30%, #f1f5f9, #64748b, #1e293b);border:1.5px solid #ffffff;border-radius:50%;width:16px;height:16px;box-shadow:0 2px 5px rgba(0,0,0,0.6);" title="${escaparHtml(wpt.nome)}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
      }
      const marcador = L.marker([wpt.lat, wpt.lon], { icon: icone });
      
      const popupConteudo = `
        <div style="font-family:sans-serif;font-size:12px;min-width:180px;line-height:1.4;">
          <b style="color:#0284c7;font-size:14px;">📍 ${escaparHtml(wpt.nome)}</b><br>
          <span style="color:#64748b;font-size:11px;">${formatarCoordenadaNautica(wpt.lat, wpt.lon)}</span>
          ${wpt.ele ? `<br>Prof/Alt: <b>${wpt.ele.toFixed(1)}m</b>` : ''}
          ${wpt.desc ? `<p style="margin:4px 0;color:#334155;font-size:11.5px;">${escaparHtml(wpt.desc)}</p>` : ''}
          <div style="margin-top:8px;display:flex;gap:4px;">
            <button onclick="window.iniciarNavegacaoPara('${wpt.id}')" style="flex:1;background:#0284c7;color:white;border:none;padding:6px;border-radius:6px;font-weight:bold;cursor:pointer;">
              🧭 Navegar Para
            </button>
            <button onclick="window.apagarWaypoint('${wpt.id}')" style="background:#dc2626;color:white;border:none;padding:6px 10px;border-radius:6px;font-weight:bold;cursor:pointer;">
              🗑️ Apagar
            </button>
          </div>
        </div>
      `;

      marcador.bindPopup(popupConteudo);
      wpt.camada = marcador;
      estado.camadaWaypoints.addLayer(marcador);
    });
  }

  function renderizarTrilhosGpx(trilhos) {
    trilhos.forEach(tr => {
      const cor = tr.ehRota ? '#ff007f' : '#38bdf8';
      const poly = L.polyline(tr.pontos, {
        color: cor,
        weight: 3.5,
        opacity: 0.85,
        dashArray: tr.ehRota ? '6, 6' : null
      });
      poly.bindPopup(`<b>${escaparHtml(tr.nome)}</b><br>${tr.pontos.length} pontos registados`);
      estado.camadaTrilhosGpx.addLayer(poly);
    });
  }

  // ==========================================
  // NAVEGAÇÃO ATIVA PARA WAYPOINT (GO-TO)
  // ==========================================
  window.iniciarNavegacaoPara = function(wptId) {
    const wpt = estado.waypoints.find(w => w.id === wptId);
    if (!wpt) return;

    estado.waypointAtivo = wpt;

    // Atualizar e Mostrar Banner de Navegação
    const banner = document.getElementById('navBanner');
    const nomeEl = document.getElementById('navTargetNome');
    if (banner && nomeEl) {
      nomeEl.textContent = `⚓ ${wpt.nome}`;
      banner.style.display = 'block';
    }

    // Fechar gaveta de waypoints
    fecharGavetaWaypoints();

    // Se tiver popup aberto no mapa, fechar
    if (wpt.camada) wpt.camada.closePopup();

    // Atualizar cálculo e traçar linha
    atualizarNavegacaoAtiva();
    if (typeof window.atualizarPainelAorus === 'function') window.atualizarPainelAorus();
    mostrarNotificacao(`Navegação ativa para: ${wpt.nome}`, 3000);
  };

  window.cancelarNavegacao = function() {
    estado.waypointAtivo = null;
    const banner = document.getElementById('navBanner');
    if (banner) banner.style.display = 'none';

    if (estado.linhaNavegacaoAtiva) {
      estado.mapa.removeLayer(estado.linhaNavegacaoAtiva);
      estado.linhaNavegacaoAtiva = null;
    }
    if (typeof window.atualizarPainelAorus === 'function') window.atualizarPainelAorus();
    mostrarNotificacao('Navegação cancelada.', 2000);
  };

  function atualizarNavegacaoAtiva() {
    if (!estado.waypointAtivo || !estado.posicao) return;

    const wpt = estado.waypointAtivo;
    const { lat: latA, lon: lonA, sog, cog } = estado.posicao;
    const latB = wpt.lat;
    const lonB = wpt.lon;

    // 1. Distância ao Waypoint (DTW)
    const distanciaM = calcularDistanciaMetros(latA, lonA, latB, lonB);
    const distanciaNm = distanciaM / 1852.0;

    // 2. Rumo ao Waypoint (BTW)
    const bearingVerdadeiro = calcularAzimute(latA, lonA, latB, lonB);

    // 3. Desvio de Agulha (CTS - Course To Steer)
    let desvio = (bearingVerdadeiro - cog + 360) % 360;
    if (desvio > 180) desvio -= 360;

    // 4. Estimativa de Tempo de Chegada (ETA)
    let etaTexto = '--:--';
    if (sog > 0.3) {
      const tempoHoras = distanciaNm / sog;
      const agora = new Date();
      const chegada = new Date(agora.getTime() + tempoHoras * 3600 * 1000);
      etaTexto = chegada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Atualizar Elementos no Banner
    const elDtw = document.getElementById('navDtw');
    const elBtw = document.getElementById('navBtw');
    const elEta = document.getElementById('navEta');
    const elSteer = document.getElementById('navSteerBadge');

    if (elDtw) elDtw.textContent = `${distanciaNm.toFixed(2)} NM`;
    if (elBtw) elBtw.textContent = `${Math.round(bearingVerdadeiro).toString().padStart(3, '0')}°`;
    if (elEta) elEta.textContent = etaTexto;

    if (elSteer) {
      const absDesvio = Math.abs(Math.round(desvio));
      if (absDesvio <= 3) {
        elSteer.className = 'nav-steer-badge steer-ok';
        elSteer.textContent = 'NO RUMO (0°)';
      } else if (desvio < 0) {
        elSteer.className = 'nav-steer-badge steer-port';
        elSteer.textContent = `◄ CORRIGIR ${absDesvio}° BB`;
      } else {
        elSteer.className = 'nav-steer-badge steer-stbd';
        elSteer.textContent = `CORRIGIR ${absDesvio}° EB ►`;
      }
    }

    // Atualizar Linha Visual de Navegação (Rumo Direto)
    const pts = [[latA, lonA], [latB, lonB]];
    if (!estado.linhaNavegacaoAtiva) {
      estado.linhaNavegacaoAtiva = L.polyline(pts, {
        color: '#ff007f',
        weight: 2.5,
        dashArray: '8, 8',
        opacity: 0.9
      }).addTo(estado.mapa);
    } else {
      estado.linhaNavegacaoAtiva.setLatLngs(pts);
    }
  }

  // ==========================================
  // GRAVAÇÃO DE TRAJETO / RASTO DE NAVEGAÇÃO
  // ==========================================
  function alternarGravacaoTrilho() {
    const btn = document.getElementById('btnGravarTrilho');
    estado.gravandoTrilho = !estado.gravandoTrilho;

    if (estado.gravandoTrilho) {
      estado.trilho = [];
      estado.distanciaTrilhoM = 0;
      estado.tempoInicioTrilho = new Date();
      estado.camadaRastoNavegacao.setLatLngs([]);
      
      if (btn) {
        btn.classList.add('gravando');
        btn.querySelector('.dock-icon').textContent = '⏹️';
        btn.querySelector('span:last-child').textContent = 'A Gravar...';
      }

      if (estado.posicao) {
        adicionarPontoAoTrilho(estado.posicao.lat, estado.posicao.lon, estado.posicao.sog);
      }
      mostrarNotificacao('🔴 Gravação de rasto iniciada!', 2500);

    } else {
      if (btn) {
        btn.classList.remove('gravando');
        btn.querySelector('.dock-icon').textContent = '🔴';
        btn.querySelector('span:last-child').textContent = 'Gravar Rasto';
      }

      const distNm = (estado.distanciaTrilhoM / 1852.0).toFixed(2);
      const totalPts = estado.trilho.length;

      if (totalPts > 1) {
        perguntarExportarTrilhoGravado(distNm, totalPts);
      } else {
        mostrarNotificacao('Gravação terminada (poucos pontos registados).', 2500);
      }
    }
  }

  function adicionarPontoAoTrilho(lat, lon, sog) {
    const novoPonto = { lat, lon, time: new Date().toISOString(), sog };

    if (estado.trilho.length > 0) {
      const ultimo = estado.trilho[estado.trilho.length - 1];
      const d = calcularDistanciaMetros(ultimo.lat, ultimo.lon, lat, lon);
      // Ignorar ruído GPS se deslocamento for menor que 3 metros
      if (d < 3) return;
      estado.distanciaTrilhoM += d;
    }

    estado.trilho.push(novoPonto);
    estado.camadaRastoNavegacao.addLatLng([lat, lon]);
  }

  function perguntarExportarTrilhoGravado(distNm, totalPts) {
    const resposta = confirm(`Trajeto concluído!\nDistância: ${distNm} NM\nPontos: ${totalPts}\n\nDesejas descarregar o ficheiro GPX deste percurso?`);
    if (resposta) {
      descarregarTrilhoComoGpx();
    }
  }

  function descarregarTrilhoComoGpx() {
    if (estado.trilho.length === 0) return;

    const dataIso = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeFicheiro = `vigilante_trajeto_${dataIso}.gpx`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<gpx version="1.1" creator="VigilanteAI GPS Telemovel" xmlns="http://www.topografix.com/GPX/1/1">\n`;
    xml += `  <metadata><name>Trajeto VigilanteAI</name><time>${new Date().toISOString()}</time></metadata>\n`;
    xml += `  <trk>\n    <name>Trajeto Náutico ${new Date().toLocaleDateString()}</name>\n    <trkseg>\n`;

    estado.trilho.forEach(pt => {
      xml += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">\n`;
      xml += `        <time>${pt.time}</time>\n`;
      xml += `      </trkpt>\n`;
    });

    xml += `    </trkseg>\n  </trk>\n</gpx>`;

    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFicheiro;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarNotificacao('Ficheiro GPX descarregado para o telemóvel!', 3000);
  }

  // ==========================================
  // MARCAÇÃO RÁPIDA DE PONTO (MOB)
  // ==========================================
  function marcarPontoRapidoMob() {
    let lat, lon, origemTxt;
    if (estado.posicao) {
      lat = estado.posicao.lat;
      lon = estado.posicao.lon;
      origemTxt = `Marcado no telemóvel às ${new Date().toLocaleTimeString()}`;
    } else if (estado.mapa) {
      const c = estado.mapa.getCenter();
      lat = c.lat;
      lon = c.lng;
      origemTxt = `Marcado no centro da carta às ${new Date().toLocaleTimeString()}`;
    } else {
      mostrarNotificacao('A aguardar sinal GPS para marcar ponto...', 2500);
      return;
    }

    const num = estado.waypoints.length + 1;
    const nomeSugerido = `MOB_${num}`;

    const nome = prompt('Nome do ponto marcado / MOB:', nomeSugerido);
    if (!nome) return;

    const novoWpt = {
      id: `mob_${Date.now()}`,
      nome: nome.trim(),
      lat,
      lon,
      ele: null,
      desc: origemTxt,
      sym: 'MOB',
      origem: 'Manual'
    };

    renderizarWaypointsGpx([novoWpt]);
    estado.waypoints.push(novoWpt);
    atualizarContadorWaypoints();
    atualizarListaWaypointsGaveta();

    if (typeof window.integrarGpxNaPastaEventos === 'function') {
      window.integrarGpxNaPastaEventos([novoWpt]);
    }

    mostrarNotificacao(`📍 Ponto marcado: ${novoWpt.nome}`, 2500);
  }

  function removerWaypointInterno(wpt) {
    if (!wpt) return;
    if (wpt.camada && estado.camadaWaypoints) {
      estado.camadaWaypoints.removeLayer(wpt.camada);
    }
    if (estado.waypointAtivo && estado.waypointAtivo.id === wpt.id) {
      window.cancelarNavegacao();
    }
  }

  window.apagarWaypoint = function(wptId, ignorarConfirmacao) {
    const wpt = estado.waypoints.find(w => String(w.id) === String(wptId));
    if (!wpt) return;
    if (!ignorarConfirmacao && !confirm(`Queres mesmo apagar "${wpt.nome}"?`)) return;

    removerWaypointInterno(wpt);
    estado.waypoints = estado.waypoints.filter(w => String(w.id) !== String(wptId));
    atualizarContadorWaypoints();
    atualizarListaWaypointsGaveta();

    if (typeof window.removerEventoPorCoordenadas === 'function') {
      window.removerEventoPorCoordenadas(wpt.id, wpt.lat, wpt.lon, wpt.nome);
    }
    mostrarNotificacao(`🗑️ Marca apagada: ${wpt.nome}`, 2200);
  };

  window.removerWaypointPorCoordenadas = function(id, lat, lon, nome) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const nomeLow = String(nome || '').trim().toLowerCase();
    let alterou = false;

    estado.waypoints = estado.waypoints.filter(w => {
      const mesmoId = id && String(w.id) === String(id);
      const mesmaCoord = Number.isFinite(latNum) && Number.isFinite(lonNum)
        && Math.abs(Number(w.lat) - latNum) < 0.00002
        && Math.abs(Number(w.lon) - lonNum) < 0.00002
        && (!nomeLow || String(w.nome || '').trim().toLowerCase() === nomeLow);
      if (mesmoId || mesmaCoord) {
        removerWaypointInterno(w);
        alterou = true;
        return false;
      }
      return true;
    });

    if (alterou) {
      atualizarContadorWaypoints();
      atualizarListaWaypointsGaveta();
    }
  };

  // ==========================================
  // GESTÃO DA GAVETA E LISTA DE WAYPOINTS
  // ==========================================
  function abrirGavetaWaypoints() {
    document.getElementById('drawerWaypoints').classList.add('aberta');
    atualizarListaWaypointsGaveta();
  }

  function fecharGavetaWaypoints() {
    document.getElementById('drawerWaypoints').classList.remove('aberta');
  }

  function atualizarContadorWaypoints() {
    const el = document.getElementById('badgeCountWaypoints');
    if (el) el.textContent = estado.waypoints.length;
  }

  function atualizarListaWaypointsGaveta() {
    const listaEl = document.getElementById('drawerLista');
    if (!listaEl) return;

    let filtrados = estado.waypoints.slice();

    // Filtro por pesquisa
    if (estado.termoPesquisa) {
      const t = estado.termoPesquisa.toLowerCase();
      filtrados = filtrados.filter(w => w.nome.toLowerCase().includes(t) || (w.desc && w.desc.toLowerCase().includes(t)));
    }

    // Calcular distância e rumo de cada ponto relativamente à posição do telemóvel
    if (estado.posicao) {
      const { lat, lon } = estado.posicao;
      filtrados.forEach(w => {
        w.distanciaM = calcularDistanciaMetros(lat, lon, w.lat, w.lon);
        w.distanciaNm = w.distanciaM / 1852.0;
        w.rumo = calcularAzimute(lat, lon, w.lat, w.lon);
      });

      // Ordenação
      if (estado.filtroAtual === 'proximos') {
        filtrados.sort((a, b) => a.distanciaM - b.distanciaM);
      } else if (estado.filtroAtual === 'alfabetica') {
        filtrados.sort((a, b) => a.nome.localeCompare(b.nome));
      }
    }

    if (filtrados.length === 0) {
      listaEl.innerHTML = `
        <div style="text-align:center;padding:30px 10px;color:#94a3b8;">
          <div style="font-size:32px;margin-bottom:8px;">⚓</div>
          <b>Nenhum waypoint encontrado</b>
          <p style="font-size:12px;margin-top:4px;">Importa um ficheiro GPX ou marca um ponto na barra inferior.</p>
          <button onclick="window.abrirModalImportar()" style="margin-top:10px;background:#0284c7;color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;">
            📂 Carregar GPX
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    filtrados.forEach(w => {
      const distStr = w.distanciaNm !== undefined ? `${w.distanciaNm.toFixed(2)} NM (${Math.round(w.rumo || 0)}°)` : '-- NM';
      html += `
        <div class="wpt-card">
          <div class="wpt-topo">
            <span class="wpt-nome">📍 ${escaparHtml(w.nome)}</span>
            <span class="wpt-dist">${distStr}</span>
          </div>
          <div class="wpt-dados">
            <span>${formatarCoordenadaNautica(w.lat, w.lon)}</span>
            ${w.ele ? `<span>⚓ ${w.ele}m</span>` : ''}
          </div>
          ${w.desc ? `<div style="font-size:11px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escaparHtml(w.desc)}</div>` : ''}
          <div class="wpt-acoes">
            <button class="btn-wpt btn-wpt-nav" onclick="window.iniciarNavegacaoPara('${w.id}')">
              🧭 Navegar Para
            </button>
            <button class="btn-wpt btn-wpt-ver" onclick="window.centrarNoWaypoint('${w.id}')">
              👁️ Ver no Mapa
            </button>
            <button class="btn-wpt" style="background:#991b1b;color:#fff;flex:0 0 auto;padding:7px 10px;" onclick="window.apagarWaypoint('${w.id}')" title="Apagar marca">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    listaEl.innerHTML = html;
  }

  window.centrarNoWaypoint = function(wptId) {
    const wpt = estado.waypoints.find(w => w.id === wptId);
    if (!wpt) return;

    setModoSeguir(false);
    estado.mapa.setView([wpt.lat, wpt.lon], 16);
    if (wpt.camada) wpt.camada.openPopup();
    fecharGavetaWaypoints();
  };

  // ==========================================
  // CARREGAR PESQUEIROS PREDEFINIDOS DO VIGILANTE (ONLINE & OFFLINE)
  // ==========================================
  function carregarPesqueirosDisponiveis() {
    const container = document.getElementById('pesqueirosBordoLista');
    if (!container) return;

    function renderizarLista(ficheiros) {
      if (!ficheiros || ficheiros.length === 0) {
        container.innerHTML = `<p style="font-size:12px;color:#94a3b8;">Sem ficheiros predefinidos disponíveis.</p>`;
        return;
      }
      let html = '';
      ficheiros.forEach(f => {
        const nome = f.nome || f.ficheiro || '';
        const ficheiro = f.ficheiro || f.nome || '';
        const tam = f.tamanho_kb || 0;
        const desc = f.descricao || 'Formato GPX Náutico';
        html += `
          <div class="pesqueiro-item" onclick="window.carregarPesqueiroServidor('${escaparHtml(ficheiro)}')">
            <div>
              <div class="pesqueiro-nome">🐟 ${escaparHtml(nome)}</div>
              <div class="pesqueiro-sub">${tam} KB • ${escaparHtml(desc)}</div>
            </div>
            <span style="color:#38bdf8;font-size:18px;">➔</span>
          </div>
        `;
      });
      container.innerHTML = html;
    }

    // Tentar primeiro a API dinâmica; se falhar ou estiver offline, ler do ficheiro estático em cache PWA
    fetch('/api/pesqueiros_lista')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(dados => {
        if (dados && dados.sucesso && dados.ficheiros && dados.ficheiros.length > 0) {
          renderizarLista(dados.ficheiros);
        } else {
          throw new Error('Lista dinâmica vazia');
        }
      })
      .catch(() => {
        fetch('static/pesqueiros/lista.json')
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(lista => renderizarLista(lista))
          .catch(() => {
            renderizarLista([
              { nome: '54_Bolinhas_completo_Esferas.gpx', tamanho_kb: 267.5, descricao: '54 Bolinhas Esferas Completo' },
              { nome: 'viegas novogps.gpx', tamanho_kb: 483, descricao: 'Costa Algarvia • Portimão / Lagos / Sagres' },
              { nome: '54_Bolinhas_Completo.gpx', tamanho_kb: 315, descricao: 'Pesqueiros de Bolinhas • Algarve' },
              { nome: 'caladas.gpx', tamanho_kb: 281, descricao: 'Caladas e Marcas de Pesca' }
            ]);
          });
      });
  }

  window.carregarPesqueiroServidor = function(nomeFicheiro) {
    mostrarNotificacao(`A carregar ${nomeFicheiro}...`, 2000);
    // Tenta primeiro static/pesqueiros/ (compatível com Service Worker offline e cache), depois a API dinâmica
    fetch(`static/pesqueiros/${encodeURIComponent(nomeFicheiro)}`)
      .then(r => {
        if (r.ok) return r.text();
        return fetch(`/api/pesqueiros_gpx?ficheiro=${encodeURIComponent(nomeFicheiro)}`).then(r2 => {
          if (!r2.ok) throw new Error('Não foi possível obter o ficheiro.');
          return r2.text();
        });
      })
      .then(xml => {
        importarFicheiroGpxTexto(xml, nomeFicheiro);
      })
      .catch(e => {
        mostrarNotificacao(`Falha ao descarregar ${nomeFicheiro}: ${e.message}`, 3500);
      });
  };

  // ==========================================
  // SINCRONIZAÇÃO BIDIRECIONAL COM O SERVIDOR
  // ==========================================
  let ultimoEnvioServidor = 0;
  function transmitirGpsAoServidor(lat, lon, sog, cog) {
    if (MODO_ESTATICO_WEB) return;
    const agora = Date.now();
    // Limitar transmissão a cada 2 segundos para não sobrecarregar
    if (agora - ultimoEnvioServidor < 2000) return;
    ultimoEnvioServidor = agora;

    fetch('/api/maritimo/submit/gps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
        sog_nos: sog,
        cog_graus: cog,
        fonte: 'mobile_gps'
      })
    }).catch(() => {
      // Falha silenciosa quando o servidor de terra/bordo estiver desligado
    });
  }

  // ==========================================
  // CONFIGURAÇÃO DE EVENTOS DE INTERFACE (TOUCH)
  // ==========================================
  function configurarEventosUI() {
    // 1. Botão "Seguir" (Centrar no telemóvel e ativar GPS)
    const btnSeguir = document.getElementById('btnSeguirGps');
    if (btnSeguir) {
      btnSeguir.addEventListener('click', () => {
        setModoSeguir(true);
        ativarLocalizacaoGpsReal(true);
        if (estado.posicao && estado.mapa) {
          estado.mapa.setView([estado.posicao.lat, estado.posicao.lon], estado.mapa.getZoom() < 15 ? 16 : estado.mapa.getZoom());
          mostrarNotificacao('🎯 A centrar no barco / GPS.', 1500);
        }
      });
    }

    const badge = document.getElementById('gpsBadge');
    if (badge) {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', () => {
        ativarLocalizacaoGpsReal(true);
      });
    }

    // 2. Botão Gravar Trajeto
    const btnGravar = document.getElementById('btnGravarTrilho');
    if (btnGravar) {
      btnGravar.addEventListener('click', alternarGravacaoTrilho);
    }

    // 3. Botão Marcar Ponto / MOB
    const btnMob = document.getElementById('btnMarcarPonto');
    if (btnMob) {
      btnMob.addEventListener('click', marcarPontoRapidoMob);
    }

    // 4. Botão e Gaveta de Waypoints
    const btnWpts = document.getElementById('btnAbrirWaypoints');
    if (btnWpts) btnWpts.addEventListener('click', abrirGavetaWaypoints);

    const btnFecharGaveta = document.getElementById('btnFecharGaveta');
    if (btnFecharGaveta) btnFecharGaveta.addEventListener('click', fecharGavetaWaypoints);

    const puxadorGaveta = document.getElementById('drawerPuxador');
    if (puxadorGaveta) puxadorGaveta.addEventListener('click', fecharGavetaWaypoints);

    // 5. Pesquisa e Filtros na Gaveta
    const inputPesquisa = document.getElementById('inputPesquisaWaypoints');
    if (inputPesquisa) {
      inputPesquisa.addEventListener('input', (e) => {
        estado.termoPesquisa = e.target.value;
        atualizarListaWaypointsGaveta();
      });
    }

    document.querySelectorAll('.drawer-filtro-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.drawer-filtro-btn').forEach(b => b.classList.remove('ativo'));
        e.target.classList.add('ativo');
        estado.filtroAtual = e.target.dataset.filtro;
        atualizarListaWaypointsGaveta();
      });
    });

    // 6. Modal de Importação GPX
    const btnAbrirImportar = document.getElementById('btnAbrirImportar');
    if (btnAbrirImportar) btnAbrirImportar.addEventListener('click', abrirModalImportar);

    const btnFecharModal = document.getElementById('btnFecharModalImportar');
    if (btnFecharModal) btnFecharModal.addEventListener('click', fecharModalImportar);

    const inputFicheiro = document.getElementById('inputFicheiroGpx');
    const dropzone = document.getElementById('gpxDropzone');

    if (dropzone && inputFicheiro) {
      dropzone.addEventListener('click', () => inputFicheiro.click());

      inputFicheiro.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          importarFicheiroGpxTexto(ev.target.result, file.name);
        };
        reader.readAsText(file);
      });

      // Drag and Drop
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#fff';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '';
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        if (e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
            importarFicheiroGpxTexto(ev.target.result, file.name);
          };
          reader.readAsText(file);
        }
      });
    }

    // 7. Alternar Unidade de Velocidade (Toque no HUD)
    const cardVel = document.getElementById('hudCardVelocidade');
    if (cardVel) {
      cardVel.addEventListener('click', () => {
        estado.unidadeVel = (estado.unidadeVel === 'nos') ? 'kmh' : 'nos';
        atualizarHudNumerico();
        salvarPreferencias();
        mostrarNotificacao(`Unidade: ${estado.unidadeVel === 'nos' ? 'Nós (KTS)' : 'km/h'}`, 1200);
      });
    }

    // 8. Alternar Formato de Coordenadas
    const cardCoords = document.getElementById('hudCoordenadas');
    if (cardCoords) {
      cardCoords.addEventListener('click', () => {
        if (estado.formatoCoord === 'ddm') estado.formatoCoord = 'decimal';
        else if (estado.formatoCoord === 'decimal') estado.formatoCoord = 'dms';
        else estado.formatoCoord = 'ddm';
        atualizarHudNumerico();
        salvarPreferencias();
        mostrarNotificacao(`Formato: ${estado.formatoCoord.toUpperCase()}`, 1200);
      });
    }

    // 9. Modo Noturno Tático
    const btnNoite = document.getElementById('btnModoNoturno');
    if (btnNoite) {
      btnNoite.addEventListener('click', () => {
        estado.modoNoturno = !estado.modoNoturno;
        document.body.classList.toggle('modo-noturno', estado.modoNoturno);
        btnNoite.classList.toggle('ativo', estado.modoNoturno);
        salvarPreferencias();
        mostrarNotificacao(estado.modoNoturno ? '🌙 Modo Noturno Ativado' : '☀️ Modo Diurno Ativado', 1500);
      });
    }

    // 10. Ecrã Cheio (Fullscreen)
    const btnFull = document.getElementById('btnFullscreen');
    if (btnFull) {
      btnFull.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // 11. Modal Definições
    const btnDefs = document.getElementById('btnAbrirDefinicoes');
    const modalDefs = document.getElementById('modalDefinicoes');
    const fecharDefs = document.getElementById('btnFecharDefinicoes');
    if (btnDefs && modalDefs) {
      btnDefs.addEventListener('click', () => modalDefs.style.display = 'flex');
      if (fecharDefs) fecharDefs.addEventListener('click', () => modalDefs.style.display = 'none');
    }

    // Checkbox Transmitir Servidor
    const chkSync = document.getElementById('chkTransmitirServidor');
    if (chkSync) {
      chkSync.checked = estado.transmitirServidor;
      chkSync.addEventListener('change', (e) => {
        estado.transmitirServidor = e.target.checked;
        salvarPreferencias();
      });
    }
  }

  function setModoSeguir(ativo) {
    estado.modoSeguir = ativo;
    const btn = document.getElementById('btnSeguirGps');
    if (btn) btn.classList.toggle('ativo', ativo);
  }

  window.abrirModalImportar = function() {
    const m = document.getElementById('modalImportar');
    if (m) m.style.display = 'flex';
  };

  function fecharModalImportar() {
    const m = document.getElementById('modalImportar');
    if (m) m.style.display = 'none';
  }

  // ==========================================
  // WAKE LOCK API (MANTER ECRÃ LIGADO NO BARCO)
  // ==========================================
  async function solicitarWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        estado.wakeLock = await navigator.wakeLock.request('screen');
        const badge = document.getElementById('wakeLockBadge');
        if (badge) badge.style.display = 'flex';

        estado.wakeLock.addEventListener('release', () => {
          if (badge) badge.style.display = 'none';
        });

        // Reativar se a janela voltar a ganhar foco
        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState === 'visible') {
            solicitarWakeLock();
          }
        });
      } catch (err) {
        console.warn('Wake Lock não autorizado ou indisponível:', err);
      }
    }
  }

  // ==========================================
  // SERVICE WORKER & PWA OFFLINE
  // ==========================================
  function registarServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Vigilante GPS Service Worker registado'))
        .catch(e => console.warn('Falha no registo SW:', e));
    }
  }

  // ==========================================
  // CÁLCULOS NÁUTICOS & MATEMÁTICA GEODÉSICA
  // ==========================================
  function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calcularAzimute(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) -
              Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

    const theta = Math.atan2(y, x);
    return (theta * 180 / Math.PI + 360) % 360;
  }

  function calcularPontoDestino(lat, lon, distanciaNm, rumoDeg) {
    const d = (distanciaNm * 1852.0) / 6371000.0;
    const brng = rumoDeg * Math.PI / 180.0;
    const phi1 = lat * Math.PI / 180.0;
    const lambda1 = lon * Math.PI / 180.0;

    const phi2 = Math.asin(
      Math.sin(phi1) * Math.cos(d) +
      Math.cos(phi1) * Math.sin(d) * Math.cos(brng)
    );
    const lambda2 = lambda1 + Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(phi1),
      Math.cos(d) - Math.sin(phi1) * Math.sin(phi2)
    );

    return {
      lat: phi2 * 180.0 / Math.PI,
      lon: lambda2 * 180.0 / Math.PI
    };
  }

  function formatarCoordenadaNautica(lat, lon) {
    const latAbs = Math.abs(lat);
    const lonAbs = Math.abs(lon);

    const latDeg = Math.floor(latAbs);
    const latMin = ((latAbs - latDeg) * 60).toFixed(3);

    const lonDeg = Math.floor(lonAbs);
    const lonMin = ((lonAbs - lonDeg) * 60).toFixed(3);

    const latH = lat >= 0 ? 'N' : 'S';
    const lonH = lon >= 0 ? 'E' : 'W';

    return `${latDeg.toString().padStart(2, '0')}° ${latMin.padStart(6, '0')}' ${latH} | ${lonDeg.toString().padStart(3, '0')}° ${lonMin.padStart(6, '0')}' ${lonH}`;
  }

  function formatarCoordenadaNauticaHtml(lat, lon) {
    const latAbs = Math.abs(lat);
    const lonAbs = Math.abs(lon);
    const latDeg = Math.floor(latAbs);
    const latMin = ((latAbs - latDeg) * 60).toFixed(3);
    const lonDeg = Math.floor(lonAbs);
    const lonMin = ((lonAbs - lonDeg) * 60).toFixed(3);
    const latH = lat >= 0 ? 'N' : 'S';
    const lonH = lon >= 0 ? 'E' : 'W';

    return `<div>${latDeg.toString().padStart(2, '0')}° ${latMin}' <b style="color:#38bdf8">${latH}</b></div><div>${lonDeg.toString().padStart(3, '0')}° ${lonMin}' <b style="color:#38bdf8">${lonH}</b></div>`;
  }

  function formatarCoordenadaDms(lat, lon) {
    function toDms(val, posH, negH) {
      const h = val >= 0 ? posH : negH;
      const abs = Math.abs(val);
      const d = Math.floor(abs);
      const m = Math.floor((abs - d) * 60);
      const s = (((abs - d) * 60 - m) * 60).toFixed(1);
      return `${d}° ${m}' ${s}" ${h}`;
    }
    return `${toDms(lat, 'N', 'S')}, ${toDms(lon, 'E', 'W')}`;
  }

  function obterPontoCardeal(rumo) {
    const r = (rumo + 360) % 360;
    const setores = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(r / 22.5) % 16;
    return setores[idx];
  }

  function mostrarNotificacao(msg, duracaoMs = 2500) {
    const el = document.getElementById('toastNotificacao');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visivel');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.classList.remove('visivel');
    }, duracaoMs);
  }

  function escaparHtml(texto) {
    if (!texto) return '';
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // PERSISTÊNCIA EM LOCALSTORAGE
  // ==========================================
  function carregarPreferencias() {
    try {
      const salvo = localStorage.getItem('vigilante_gps_prefs');
      if (salvo) {
        const p = JSON.parse(salvo);
        if (p.unidadeVel) estado.unidadeVel = p.unidadeVel;
        if (p.formatoCoord) estado.formatoCoord = p.formatoCoord;
        if (p.modoNoturno) {
          estado.modoNoturno = p.modoNoturno;
          document.body.classList.toggle('modo-noturno', true);
          const btn = document.getElementById('btnModoNoturno');
          if (btn) btn.classList.add('ativo');
        }
        if (p.transmitirServidor !== undefined) estado.transmitirServidor = p.transmitirServidor;
      }
    } catch (_) {}
  }

  function salvarPreferencias() {
    try {
      const p = {
        unidadeVel: estado.unidadeVel,
        formatoCoord: estado.formatoCoord,
        modoNoturno: estado.modoNoturno,
        transmitirServidor: estado.transmitirServidor
      };
      localStorage.setItem('vigilante_gps_prefs', JSON.stringify(p));
    } catch (_) {}
  }

})();
