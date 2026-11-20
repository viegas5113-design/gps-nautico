/**
 * Modo GPS Aorus — Painel de Navegação Tático (100% JS Puro)
 * Partilha o mesmo sinal GPS, bússola, waypoints e navegação ativa do GPS Náutico.
 */
(() => {
  const MODO_STORAGE_KEY = 'vigilante_gps_modo_ui_v1';
  let modoAtual = 'nautico';

  function obterPontoCardeal(graus) {
    const direcoes = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(((graus % 360) + 360) % 360 / 45) % 8;
    return direcoes[idx];
  }

  function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calcularAzimute(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dLambda = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLambda) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  function formatarDdm(valor, eLat) {
    const hem = eLat ? (valor >= 0 ? 'N' : 'S') : (valor >= 0 ? 'E' : 'W');
    const abs = Math.abs(valor);
    const graus = Math.floor(abs);
    const min = ((abs - graus) * 60).toFixed(3).padStart(6, '0');
    const pad = eLat ? 2 : 3;
    return `${String(graus).padStart(pad, '0')}° ${min}' ${hem}`;
  }

  function formatarDms(valor, eLat) {
    const hem = eLat ? (valor >= 0 ? 'N' : 'S') : (valor >= 0 ? 'E' : 'W');
    const abs = Math.abs(valor);
    const g = Math.floor(abs);
    const mFloat = (abs - g) * 60;
    const m = Math.floor(mFloat);
    const s = ((mFloat - m) * 60).toFixed(1).padStart(4, '0');
    const pad = eLat ? 2 : 3;
    return `${String(g).padStart(pad, '0')}° ${String(m).padStart(2, '0')}' ${s}" ${hem}`;
  }

  window.alternarModoGps = function alternarModoGps(novoModo) {
    modoAtual = novoModo === 'aorus' ? 'aorus' : 'nautico';
    try {
      localStorage.setItem(MODO_STORAGE_KEY, modoAtual);
    } catch (_) {}

    const painelAorus = document.getElementById('aorusPanel');
    const btnAorus = document.getElementById('btnModoAorus');
    const btnNautico = document.getElementById('btnModoNautico');

    if (painelAorus) {
      painelAorus.style.display = modoAtual === 'aorus' ? 'flex' : 'none';
    }
    if (btnAorus) btnAorus.classList.toggle('ativo', modoAtual === 'aorus');
    if (btnNautico) btnNautico.classList.toggle('ativo', modoAtual === 'nautico');

    if (modoAtual === 'nautico' && window.mapaGpsNautico) {
      setTimeout(() => window.mapaGpsNautico.invalidateSize(), 120);
    }

    window.atualizarPainelAorus();
  };

  window.atualizarPainelAorus = function atualizarPainelAorus() {
    const estado = window.__vigilanteEstadoGps;
    if (!estado) return;

    const pos = estado.posicao;
    const elVel = document.getElementById('aorusVelNos');
    const elVelKmh = document.getElementById('aorusVelKmh');
    const elRumo = document.getElementById('aorusRumoGraus');
    const elCardeal = document.getElementById('aorusRumoCardeal');
    const elAgulha = document.getElementById('aorusBussolaRosa');
    const elAlvoAgulha = document.getElementById('aorusBussolaAlvo');
    const elLat = document.getElementById('aorusLat');
    const elLon = document.getElementById('aorusLon');
    const elPrec = document.getElementById('aorusPrecisao');
    const elSonda = document.getElementById('aorusSonda');
    const elAlvoNome = document.getElementById('aorusAlvoNome');
    const elAlvoDtw = document.getElementById('aorusAlvoDtw');
    const elAlvoBtw = document.getElementById('aorusAlvoBtw');
    const elAlvoEta = document.getElementById('aorusAlvoEta');
    const elAlvoSteer = document.getElementById('aorusAlvoSteer');
    const btnCancelar = document.getElementById('aorusBtnCancelarNav');

    const rumoAtivo = (pos && pos.sog > 0.5)
      ? pos.cog
      : (estado.rumoBussola !== null && estado.rumoBussola !== undefined
          ? estado.rumoBussola
          : (pos ? pos.cog : 0));

    if (pos) {
      if (elVel) elVel.textContent = pos.sog.toFixed(1);
      if (elVelKmh) elVelKmh.textContent = `${pos.sogKmh.toFixed(1)} km/h`;
      if (elRumo) elRumo.textContent = `${Math.round(rumoAtivo).toString().padStart(3, '0')}°`;
      if (elCardeal) elCardeal.textContent = obterPontoCardeal(rumoAtivo);
      if (elAgulha) elAgulha.style.transform = `rotate(${-Math.round(rumoAtivo)}deg)`;

      if (elLat && elLon) {
        if (estado.formatoCoord === 'dms') {
          elLat.textContent = formatarDms(pos.lat, true);
          elLon.textContent = formatarDms(pos.lon, false);
        } else if (estado.formatoCoord === 'decimal') {
          elLat.textContent = `${pos.lat.toFixed(6)}°`;
          elLon.textContent = `${pos.lon.toFixed(6)}°`;
        } else {
          elLat.textContent = formatarDdm(pos.lat, true);
          elLon.textContent = formatarDdm(pos.lon, false);
        }
      }
      if (elPrec) elPrec.textContent = `±${Math.round(pos.precisao)}m`;
    }

    const hudBat = document.getElementById('hudBatimetria');
    if (elSonda && hudBat) {
      elSonda.textContent = hudBat.textContent || '-- braças';
    }

    const wpt = estado.waypointAtivo;
    if (wpt && pos) {
      const distM = calcularDistanciaMetros(pos.lat, pos.lon, wpt.lat, wpt.lon);
      const distNm = distM / 1852.0;
      const btw = calcularAzimute(pos.lat, pos.lon, wpt.lat, wpt.lon);

      let desvio = (btw - rumoAtivo + 360) % 360;
      if (desvio > 180) desvio -= 360;

      let etaTxt = '--:--';
      if (pos.sog > 0.3) {
        const chegada = new Date(Date.now() + (distNm / pos.sog) * 3600 * 1000);
        etaTxt = chegada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      if (elAlvoNome) elAlvoNome.textContent = `🎯 ${wpt.nome}`;
      if (elAlvoDtw) {
        elAlvoDtw.textContent = distNm < 0.15 ? `${Math.round(distM)} m` : `${distNm.toFixed(2)} NM`;
      }
      if (elAlvoBtw) {
        elAlvoBtw.textContent = `${Math.round(btw).toString().padStart(3, '0')}° ${obterPontoCardeal(btw)}`;
      }
      if (elAlvoEta) elAlvoEta.textContent = etaTxt;

      if (elAlvoSteer) {
        const absDesv = Math.abs(Math.round(desvio));
        if (absDesv <= 3) {
          elAlvoSteer.className = 'aorus-steer steer-ok';
          elAlvoSteer.textContent = 'NO RUMO (0°)';
        } else if (desvio < 0) {
          elAlvoSteer.className = 'aorus-steer steer-port';
          elAlvoSteer.textContent = `◄ ${absDesv}° BB`;
        } else {
          elAlvoSteer.className = 'aorus-steer steer-stbd';
          elAlvoSteer.textContent = `${absDesv}° EB ►`;
        }
      }

      if (elAlvoAgulha) {
        elAlvoAgulha.style.display = 'block';
        elAlvoAgulha.style.transform = `rotate(${Math.round(btw - rumoAtivo)}deg)`;
      }
      if (btnCancelar) btnCancelar.style.display = 'inline-flex';
    } else {
      if (elAlvoNome) elAlvoNome.textContent = 'Sem pesqueiro selecionado';
      if (elAlvoDtw) elAlvoDtw.textContent = '-- NM';
      if (elAlvoBtw) elAlvoBtw.textContent = '---°';
      if (elAlvoEta) elAlvoEta.textContent = '--:--';
      if (elAlvoSteer) {
        elAlvoSteer.className = 'aorus-steer';
        elAlvoSteer.textContent = 'Escolhe um pesqueiro';
      }
      if (elAlvoAgulha) elAlvoAgulha.style.display = 'none';
      if (btnCancelar) btnCancelar.style.display = 'none';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const coordsBox = document.getElementById('aorusCoordsBox');
    if (coordsBox) {
      coordsBox.addEventListener('click', () => {
        const hudCoords = document.getElementById('hudCoordenadas');
        if (hudCoords) hudCoords.click();
        window.atualizarPainelAorus();
      });
    }

    const btnEscolher = document.getElementById('aorusBtnEscolherAlvo');
    if (btnEscolher) {
      btnEscolher.addEventListener('click', () => {
        const btnWpt = document.getElementById('btnAbrirWaypoints');
        if (btnWpt) btnWpt.click();
      });
    }

    const btnMarcar = document.getElementById('aorusBtnMarcarPonto');
    if (btnMarcar) {
      btnMarcar.addEventListener('click', () => {
        const btnMob = document.getElementById('btnMarcarPonto');
        if (btnMob) btnMob.click();
      });
    }

    try {
      const salvo = localStorage.getItem(MODO_STORAGE_KEY);
      if (salvo === 'aorus' || salvo === 'nautico') {
        window.alternarModoGps(salvo);
      } else {
        window.alternarModoGps('nautico');
      }
    } catch (_) {
      window.alternarModoGps('nautico');
    }
  });
})();
