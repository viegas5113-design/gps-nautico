/**
 * Leitor de Antena GPS USB via Web Serial API (NMEA 0183)
 * Suporta $GPRMC, $GNRMC, $GPGGA e $GNGGA com validação de checksum.
 */
(() => {
  'use strict';

  const ESTADOS = {
    DESLIGADO: 'desligado',
    AGUARDAR: 'aguardar',
    ATIVO: 'ativo'
  };

  let portaSerial = null;
  let leitorSerial = null;
  let leituraAtiva = false;
  let estadoAtual = ESTADOS.DESLIGADO;
  let ultimoPonto = null; // { lat, lon, sog, cog, horaMs }
  let ultimoRumoValido = 0;
  let ultimaAltitude = 0;
  let ultimaPrecisao = 5;

  function mostrarAviso(mensagem, duracaoMs = 4000) {
    const toast = document.getElementById('toastNotificacao');
    if (toast) {
      toast.textContent = mensagem;
      toast.classList.add('visivel');
      clearTimeout(toast.__nmeaUsbTimer);
      toast.__nmeaUsbTimer = setTimeout(() => {
        toast.classList.remove('visivel');
      }, duracaoMs);
    } else {
      console.warn('[GPS NMEA USB]', mensagem);
    }
  }

  function atualizarEstadoUI(novoEstado) {
    estadoAtual = novoEstado;
    const btn = document.getElementById('btnGpsNmeaUsb');
    const indicador = document.getElementById('statusGpsNmeaUsb');
    const selectBaud = document.getElementById('selectBaudNmeaUsb');

    if (indicador) {
      if (novoEstado === ESTADOS.ATIVO) {
        indicador.textContent = 'Posição ativa';
        indicador.style.background = 'rgba(16, 185, 129, 0.18)';
        indicador.style.borderColor = '#10b981';
        indicador.style.color = '#34d399';
      } else if (novoEstado === ESTADOS.AGUARDAR) {
        indicador.textContent = 'A aguardar sinal';
        indicador.style.background = 'rgba(245, 158, 11, 0.18)';
        indicador.style.borderColor = '#f59e0b';
        indicador.style.color = '#fbbf24';
      } else {
        indicador.textContent = 'Desligado';
        indicador.style.background = 'rgba(148, 163, 184, 0.15)';
        indicador.style.borderColor = '#64748b';
        indicador.style.color = '#cbd5e1';
      }
    }

    if (btn) {
      const ligado = novoEstado !== ESTADOS.DESLIGADO;
      btn.textContent = ligado ? '📡 Desligar Antena GPS (USB)' : '📡 Ligar Antena GPS (USB)';
      btn.style.background = ligado ? '#047857' : '#0369a1';
      btn.style.borderColor = ligado ? '#34d399' : '#38bdf8';
    }

    if (selectBaud) {
      selectBaud.disabled = novoEstado !== ESTADOS.DESLIGADO;
    }
  }

  // ==========================================
  // VALIDAÇÃO E DESCODIFICAÇÃO NMEA 0183
  // ==========================================
  function validarChecksumNmea(frase) {
    if (!frase || frase[0] !== '$') return false;
    const idxAsterisco = frase.indexOf('*');
    if (idxAsterisco === -1 || idxAsterisco + 3 > frase.length) return false;

    const corpo = frase.slice(1, idxAsterisco);
    const checksumEsperado = frase.slice(idxAsterisco + 1, idxAsterisco + 3).toUpperCase();
    if (!/^[0-9A-F]{2}$/.test(checksumEsperado)) return false;

    let xor = 0;
    for (let i = 0; i < corpo.length; i++) {
      xor ^= corpo.charCodeAt(i);
    }
    const checksumCalculado = (xor & 0xFF).toString(16).toUpperCase().padStart(2, '0');
    return checksumCalculado === checksumEsperado;
  }

  function converterCoordenadaNmea(valorStr, hemisferio, ehLongitude) {
    if (!valorStr || !hemisferio) return null;
    const num = parseFloat(valorStr);
    if (!Number.isFinite(num)) return null;

    const digitosGraus = ehLongitude ? 3 : 2;
    if (valorStr.length < digitosGraus + 2) return null;

    const graus = parseInt(valorStr.slice(0, digitosGraus), 10);
    const minutos = parseFloat(valorStr.slice(digitosGraus));
    if (!Number.isFinite(graus) || !Number.isFinite(minutos)) return null;

    let decimal = graus + (minutos / 60);
    const hemi = hemisferio.toUpperCase();
    if (hemi === 'S' || hemi === 'W') {
      decimal = -decimal;
    } else if (hemi !== 'N' && hemi !== 'E') {
      return null;
    }

    const limite = ehLongitude ? 180 : 90;
    if (Math.abs(decimal) > limite) return null;
    return decimal;
  }

  function descodificarFraseNmea(linha) {
    const frase = linha.trim();
    if (!validarChecksumNmea(frase)) return null;

    const semChecksum = frase.slice(1, frase.indexOf('*'));
    const campos = semChecksum.split(',');
    const tipo = campos[0];

    if (tipo === 'GPRMC' || tipo === 'GNRMC') {
      // $GxRMC,hora,status,lat,N/S,lon,E/W,sog,cog,data,...
      if (campos.length < 9 || campos[2] !== 'A') return null;

      const lat = converterCoordenadaNmea(campos[3], campos[4], false);
      const lon = converterCoordenadaNmea(campos[5], campos[6], true);
      if (lat === null || lon === null) return null;

      const sog = campos[7] ? parseFloat(campos[7]) : 0;
      const cog = campos[8] ? parseFloat(campos[8]) : ultimoRumoValido;

      return {
        tipo,
        lat,
        lon,
        sog: Number.isFinite(sog) && sog >= 0 ? sog : 0,
        cog: Number.isFinite(cog) && cog >= 0 ? cog % 360 : ultimoRumoValido,
        altitude: ultimaAltitude,
        precisao: ultimaPrecisao
      };
    }

    if (tipo === 'GPGGA' || tipo === 'GNGGA') {
      // $GxGGA,hora,lat,N/S,lon,E/W,qualidade,sats,hdop,alt,M,...
      if (campos.length < 10) return null;
      const qualidade = parseInt(campos[6], 10);
      if (!qualidade || qualidade <= 0) return null;

      const lat = converterCoordenadaNmea(campos[2], campos[3], false);
      const lon = converterCoordenadaNmea(campos[4], campos[5], true);
      if (lat === null || lon === null) return null;

      const hdop = campos[8] ? parseFloat(campos[8]) : NaN;
      const alt = campos[9] ? parseFloat(campos[9]) : NaN;
      if (Number.isFinite(hdop) && hdop > 0) {
        ultimaPrecisao = Math.max(2, Math.round(hdop * 5));
      }
      if (Number.isFinite(alt)) {
        ultimaAltitude = alt;
      }

      const sogAtual = ultimoPonto ? ultimoPonto.sog : 0;
      return {
        tipo,
        lat,
        lon,
        sog: sogAtual,
        cog: ultimoRumoValido,
        altitude: ultimaAltitude,
        precisao: ultimaPrecisao
      };
    }

    return null;
  }

  // ==========================================
  // ATUALIZAÇÃO DO MAPA E COORDENADAS EM TEMPO REAL
  // ==========================================
  function obterPontoCardeal(graus) {
    const direcoes = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return direcoes[Math.round((((graus % 360) + 360) % 360) / 22.5) % 16];
  }

  function formatarDdmHtml(lat, lon) {
    const fmt = (val, pos, neg) => {
      const hemi = val >= 0 ? pos : neg;
      const abs = Math.abs(val);
      const deg = Math.floor(abs);
      const min = (abs - deg) * 60;
      return `${deg}° ${min.toFixed(3).padStart(6, '0')}' ${hemi}`;
    };
    return `<div>${fmt(lat, 'N', 'S')}</div><div>${fmt(lon, 'E', 'W')}</div>`;
  }

  function formatarDms(lat, lon) {
    const fmt = (val, pos, neg) => {
      const hemi = val >= 0 ? pos : neg;
      const abs = Math.abs(val);
      const deg = Math.floor(abs);
      const minFull = (abs - deg) * 60;
      const min = Math.floor(minFull);
      const seg = (minFull - min) * 60;
      return `${deg}°${min}'${seg.toFixed(1)}"${hemi}`;
    };
    return `${fmt(lat, 'N', 'S')} ${fmt(lon, 'E', 'W')}`;
  }

  function calcularPontoDestino(lat, lon, distNm, rumoGraus) {
    const R = 3440.065; // Raio da Terra em milhas náuticas
    const d = distNm / R;
    const brng = rumoGraus * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
  }

  function aplicarPosicaoNmea(dados) {
    const agoraMs = Date.now();
    const { lat, lon, sog, cog, altitude, precisao } = dados;

    // Evitar atualizações redundantes para pontos idênticos consecutivos (ex: GGA + RMC no mesmo segundo)
    const mesmaPosicao = ultimoPonto &&
      Math.abs(ultimoPonto.lat - lat) < 1e-7 &&
      Math.abs(ultimoPonto.lon - lon) < 1e-7;
    const mesmoMovimento = ultimoPonto &&
      Math.abs(ultimoPonto.sog - sog) < 0.05 &&
      Math.abs(ultimoPonto.cog - cog) < 0.5;

    if (mesmaPosicao && mesmoMovimento && (agoraMs - ultimoPonto.horaMs) < 900) {
      return;
    }

    ultimoRumoValido = cog;
    ultimoPonto = { lat, lon, sog, cog, horaMs: agoraMs };

    if (estadoAtual !== ESTADOS.ATIVO) {
      atualizarEstadoUI(ESTADOS.ATIVO);
    }

    const estado = window.__vigilanteEstadoGps;
    if (estado) {
      // Pausar watchPosition do navegador para não sobrepor a antena USB
      if (estado.watchGpsId && navigator.geolocation) {
        navigator.geolocation.clearWatch(estado.watchGpsId);
        estado.watchGpsId = null;
      }

      estado.gpsHardwareAtivo = true;
      estado.posicao = {
        lat,
        lon,
        sog,
        sogKmh: sog * 1.852,
        cog,
        altitude,
        precisao,
        hora: new Date(agoraMs).toLocaleTimeString()
      };

      try {
        localStorage.setItem('vigilante_ultima_posicao', JSON.stringify({ lat, lon }));
      } catch (e) {}

      // Atualizar marcador único do barco (sem criar marcadores duplicados)
      if (estado.marcadorBarco) {
        estado.marcadorBarco.setLatLng([lat, lon]);
        const elemSvg = document.getElementById('iconeBarcoRotativo');
        if (elemSvg) {
          elemSvg.style.transform = `rotate(${Math.round(cog)}deg)`;
        }
      }

      if (estado.circuloPrecisao) {
        estado.circuloPrecisao.setLatLng([lat, lon]);
        estado.circuloPrecisao.setRadius(Math.max(precisao, 5));
      }

      if (estado.linhaProa) {
        const ponta = calcularPontoDestino(lat, lon, 0.5, cog);
        estado.linhaProa.setLatLngs([[lat, lon], [ponta.lat, ponta.lon]]);
      }

      if (estado.modoSeguir && estado.mapa && !mesmaPosicao) {
        estado.mapa.setView([lat, lon], estado.mapa.getZoom() < 15 ? 16 : estado.mapa.getZoom());
      }
    }

    // Atualizar Badge principal
    const badge = document.getElementById('gpsBadge');
    const badgeTxt = document.getElementById('gpsBadgeTxt');
    if (badge && badgeTxt) {
      badge.className = 'gps-badge';
      badgeTxt.textContent = `USB GPS ±${Math.round(precisao)}m`;
    }

    // Atualizar HUD numérico
    const formatoCoord = estado ? estado.formatoCoord : 'ddm';
    const unidadeVel = estado ? estado.unidadeVel : 'nos';

    const elVel = document.getElementById('hudVelocidade');
    const elVelUnid = document.getElementById('hudVelUnidade');
    if (elVel) {
      if (unidadeVel === 'nos') {
        elVel.textContent = sog.toFixed(1);
        if (elVelUnid) elVelUnid.textContent = 'KTS';
      } else {
        elVel.textContent = (sog * 1.852).toFixed(1);
        if (elVelUnid) elVelUnid.textContent = 'KM/H';
      }
    }

    const elRumo = document.getElementById('hudRumo');
    const elRumoCard = document.getElementById('hudRumoCardeal');
    if (elRumo) {
      elRumo.textContent = `${Math.round(cog).toString().padStart(3, '0')}°`;
      if (elRumoCard) elRumoCard.textContent = obterPontoCardeal(cog);
    }

    const elCoords = document.getElementById('hudCoordenadas');
    if (elCoords) {
      if (formatoCoord === 'ddm') {
        elCoords.innerHTML = formatarDdmHtml(lat, lon);
      } else if (formatoCoord === 'dms') {
        elCoords.textContent = formatarDms(lat, lon);
      } else {
        elCoords.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
      }
    }

    const elPrecisao = document.getElementById('hudPrecisao');
    if (elPrecisao) elPrecisao.textContent = `±${Math.round(precisao)}m`;

    const elAlt = document.getElementById('hudAltitude');
    if (elAlt) elAlt.textContent = `${Math.round(altitude)}m`;

    if (typeof window.atualizarPainelAorus === 'function') {
      window.atualizarPainelAorus();
    }
  }

  // ==========================================
  // LEITURA CONTÍNUA DA PORTA SÉRIE (WEB SERIAL API)
  // ==========================================
  async function lerFluxoSerial() {
    if (!portaSerial || !portaSerial.readable) return;

    const descodificador = new TextDecoder('ascii', { fatal: false });
    let buffer = '';

    try {
      leitorSerial = portaSerial.readable.getReader();
      while (leituraAtiva) {
        const { value, done } = await leitorSerial.read();
        if (done) break;
        if (!value) continue;

        buffer += descodificador.decode(value, { stream: true });
        const linhas = buffer.split('\n');
        buffer = linhas.pop() || '';

        for (let i = 0; i < linhas.length; i++) {
          const linha = linhas[i].trim();
          if (!linha) continue;
          const dados = descodificarFraseNmea(linha);
          if (dados) {
            aplicarPosicaoNmea(dados);
          }
        }
      }
    } catch (erro) {
      if (leituraAtiva) {
        mostrarAviso('Antena GPS USB desligada ou ligação série interrompida.');
      }
    } finally {
      if (leitorSerial) {
        try {
          leitorSerial.releaseLock();
        } catch (e) {}
        leitorSerial = null;
      }
    }
  }

  async function desligarAntenaUsb(silencioso = false) {
    leituraAtiva = false;

    if (leitorSerial) {
      try {
        await leitorSerial.cancel();
      } catch (e) {}
      leitorSerial = null;
    }

    if (portaSerial) {
      try {
        await portaSerial.close();
      } catch (e) {}
      portaSerial = null;
    }

    atualizarEstadoUI(ESTADOS.DESLIGADO);
    if (!silencioso) {
      mostrarAviso('Antena GPS USB desligada.');
    }
  }

  async function ligarAntenaUsb() {
    if (!('serial' in navigator)) {
      const msg = 'O teu navegador não suporta porta série USB (Web Serial API). Usa Chrome, Edge ou Opera.';
      mostrarAviso(msg, 6000);
      alert(msg);
      return;
    }

    if (portaSerial || leituraAtiva) {
      await desligarAntenaUsb(false);
      return;
    }

    const selectBaud = document.getElementById('selectBaudNmeaUsb');
    const baudRate = selectBaud ? parseInt(selectBaud.value, 10) || 4800 : 4800;

    try {
      portaSerial = await navigator.serial.requestPort();
      await portaSerial.open({ baudRate });

      leituraAtiva = true;
      ultimoPonto = null;
      atualizarEstadoUI(ESTADOS.AGUARDAR);
      mostrarAviso(`Antena GPS USB ligada (${baudRate} bps). A aguardar sinal...`);

      await lerFluxoSerial();

      if (leituraAtiva) {
        await desligarAntenaUsb(true);
        mostrarAviso('A antena GPS USB foi desligada.');
      }
    } catch (erro) {
      await desligarAntenaUsb(true);
      if (erro && erro.name === 'NotFoundError') {
        mostrarAviso('Nenhuma antena GPS USB foi selecionada.');
      } else if (erro && erro.name === 'SecurityError') {
        mostrarAviso('Permissão recusada para aceder à porta série USB.');
      } else {
        mostrarAviso('Não foi possível ligar à antena GPS USB. Verifica se está ligada.');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnGpsNmeaUsb');
    if (btn) {
      btn.addEventListener('click', ligarAntenaUsb);
    }

    if ('serial' in navigator) {
      navigator.serial.addEventListener('disconnect', (ev) => {
        if (portaSerial && ev.target === portaSerial) {
          desligarAntenaUsb(true);
          mostrarAviso('Antena GPS USB desligada fisicamente.');
        }
      });
    } else if (btn) {
      btn.title = 'Navegador sem suporte para porta série USB (Web Serial API)';
    }

    atualizarEstadoUI(ESTADOS.DESLIGADO);
  });

  window.GpsNmeaUsb = {
    ligar: ligarAntenaUsb,
    desligar: () => desligarAntenaUsb(false),
    validarChecksumNmea,
    descodificarFraseNmea
  };
})();
