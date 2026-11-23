/**
 * Sincronização Automática de Pontos (Waypoints) via GitHub
 * Sincroniza pontos criados manualmente entre telemóvel e computador
 * usando o ficheiro dados_sync/pontos_novos.json no repositório GitHub.
 */
(() => {
  'use strict';

  const KEY_REPO = 'gps_nautico_sync_github_repo_v1';
  const KEY_PAT = 'gps_nautico_sync_github_pat_v1';
  const KEY_ENVIADOS = 'gps_nautico_sync_enviados_v1';
  const KEY_ULTIMA_SYNC = 'gps_nautico_sync_ultima_v1';
  const DEFAULT_REPO = 'viegas5113-design/gps-nautico';
  const SYNC_PATH = 'dados_sync/pontos_novos.json';
  const STORAGE_EVENTOS = 'gps_nautico_pasta_eventos_v1';

  let sincronizando = false;
  let timerAutoSync = null;

  function notificar(msg) {
    const toast = document.getElementById('toastNotificacao');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visivel');
      clearTimeout(window.__toastSyncGithubTimer);
      window.__toastSyncGithubTimer = setTimeout(() => toast.classList.remove('visivel'), 3500);
    }
  }

  function chaveUnica(p) {
    if (!p) return '';
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return `${lat.toFixed(5)}|${lon.toFixed(5)}`;
  }

  function ehPontoManual(p) {
    if (!p) return false;
    if (p.manual === true || p.origem === 'Manual') return true;
    const idStr = String(p.id || '');
    return idStr.startsWith('mob_') || idStr.startsWith('ev-') || idStr.startsWith('ev_');
  }

  function normalizarRepo(repo) {
    let limpo = String(repo || '').trim();
    limpo = limpo.replace(/^https?:\/\/github\.com\//i, '');
    limpo = limpo.replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '').trim();
    if (!limpo || !limpo.includes('/')) return DEFAULT_REPO;
    return limpo;
  }

  function obterConfig() {
    let repo = DEFAULT_REPO;
    let pat = '';
    try {
      const r = localStorage.getItem(KEY_REPO);
      if (r !== null) {
        repo = normalizarRepo(r);
        if (repo !== r) localStorage.setItem(KEY_REPO, repo);
      }
      const t = localStorage.getItem(KEY_PAT);
      if (t !== null) {
        pat = String(t).trim();
        if (pat !== t) {
          if (pat) localStorage.setItem(KEY_PAT, pat);
          else localStorage.removeItem(KEY_PAT);
        }
      }
    } catch (_) {}
    return { repo, pat };
  }

  function guardarConfig(repo, pat) {
    const repoLimpo = normalizarRepo(repo);
    const patLimpo = String(pat || '').trim();
    try {
      localStorage.setItem(KEY_REPO, repoLimpo);
      if (patLimpo) {
        localStorage.setItem(KEY_PAT, patLimpo);
      } else {
        localStorage.removeItem(KEY_PAT);
      }
    } catch (_) {}
    atualizarIndicadorUI();
  }

  function obterChavesEnviadas() {
    try {
      const bruto = localStorage.getItem(KEY_ENVIADOS);
      const arr = bruto ? JSON.parse(bruto) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) {
      return new Set();
    }
  }

  function guardarChavesEnviadas(setChaves) {
    try {
      localStorage.setItem(KEY_ENVIADOS, JSON.stringify(Array.from(setChaves)));
    } catch (_) {}
  }

  function obterPontosManuaisLocais() {
    const mapa = new Map();

    const adicionar = (p) => {
      if (!ehPontoManual(p)) return;
      const lat = Number(p.lat);
      const lon = Number(p.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const chave = chaveUnica(p);
      if (!chave || mapa.has(chave)) return;
      mapa.set(chave, {
        id: p.id || `sync_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        nome: String(p.nome || 'Ponto').trim(),
        tipo: p.tipo || 'geral',
        simbolo: p.simbolo || p.sym || '',
        cor: p.cor || '',
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        ele: p.ele ?? null,
        nota: p.nota || p.desc || '',
        manual: true,
        origem: 'Manual',
        criadoEmTs: Number(p.criadoEmTs) || Date.now(),
        criado_em: p.criado_em || new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    };

    try {
      const bruto = localStorage.getItem(STORAGE_EVENTOS);
      const lista = bruto ? JSON.parse(bruto) : [];
      if (Array.isArray(lista)) lista.forEach(adicionar);
    } catch (_) {}

    const estGps = window.__vigilanteEstadoGps;
    if (estGps && Array.isArray(estGps.waypoints)) {
      estGps.waypoints.forEach(adicionar);
    }

    return Array.from(mapa.values()).sort((a, b) => (b.criadoEmTs || 0) - (a.criadoEmTs || 0));
  }

  function contarPendentes() {
    const manuais = obterPontosManuaisLocais();
    if (manuais.length === 0) return 0;
    const enviadas = obterChavesEnviadas();
    let pendentes = 0;
    for (const p of manuais) {
      if (!enviadas.has(chaveUnica(p))) pendentes++;
    }
    return pendentes;
  }

  function atualizarIndicadorUI() {
    const { pat } = obterConfig();
    const pendentes = contarPendentes();

    let cor = '#94a3b8'; // Cinzento = Sem configuração
    let titulo = 'Sincronização GitHub sem configuração (clica para configurar)';
    let textoCurto = 'Sincronizar';

    if (sincronizando) {
      cor = '#38bdf8';
      titulo = 'A sincronizar pontos com o GitHub...';
      textoCurto = 'A sincronizar...';
    } else if (pat) {
      if (pendentes > 0) {
        cor = '#facc15'; // Amarelo = Pontos pendentes para enviar
        titulo = `${pendentes} ponto(s) pendente(s) para enviar para o GitHub`;
        textoCurto = `Sincronizar (${pendentes})`;
      } else {
        cor = '#22c55e'; // Verde = Sincronizado
        let ultimaTxt = '';
        try {
          const u = localStorage.getItem(KEY_ULTIMA_SYNC);
          if (u) ultimaTxt = ` · Última: ${u}`;
        } catch (_) {}
        titulo = `Sincronizado com o GitHub${ultimaTxt}`;
        textoCurto = 'Sincronizar';
      }
    }

    const botoes = [
      { btn: 'btnSincronizarPontos', dot: 'syncDotPontos', lbl: 'syncLblPontos' },
      { btn: 'btnSincronizarGaveta', dot: 'syncDotGaveta', lbl: 'syncLblGaveta' },
    ];

    botoes.forEach(({ btn, dot, lbl }) => {
      const btnEl = document.getElementById(btn);
      const dotEl = document.getElementById(dot);
      const lblEl = document.getElementById(lbl);
      if (dotEl) dotEl.style.background = cor;
      if (lblEl) lblEl.textContent = textoCurto;
      if (btnEl) btnEl.title = titulo;
    });

    const statusConfigEl = document.getElementById('syncGithubConfigStatus');
    if (statusConfigEl) {
      if (!pat) {
        statusConfigEl.textContent = '⚪ Sem token configurado.';
        statusConfigEl.style.color = '#94a3b8';
      } else if (pendentes > 0) {
        statusConfigEl.textContent = `🟡 ${pendentes} ponto(s) pendente(s) para sincronizar.`;
        statusConfigEl.style.color = '#fde047';
      } else {
        statusConfigEl.textContent = '🟢 Configurado e sincronizado.';
        statusConfigEl.style.color = '#4ade80';
      }
    }
  }

  function base64ParaUtf8(b64) {
    const bin = atob(String(b64 || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function utf8ParaBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function integrarPontosRemotosLocalmente(pontosRemotos) {
    if (!Array.isArray(pontosRemotos) || pontosRemotos.length === 0) return 0;

    const existentes = new Set();
    try {
      const bruto = localStorage.getItem(STORAGE_EVENTOS);
      const lista = bruto ? JSON.parse(bruto) : [];
      if (Array.isArray(lista)) {
        lista.forEach((e) => {
          const c = chaveUnica(e);
          if (c) existentes.add(c);
        });
      }
    } catch (_) {}

    const estGps = window.__vigilanteEstadoGps;
    if (estGps && Array.isArray(estGps.waypoints)) {
      estGps.waypoints.forEach((w) => {
        const c = chaveUnica(w);
        if (c) existentes.add(c);
      });
    }

    const novos = [];
    for (const rp of pontosRemotos) {
      const lat = Number(rp.lat);
      const lon = Number(rp.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const chave = chaveUnica(rp);
      if (!chave || existentes.has(chave)) continue;
      existentes.add(chave);
      novos.push({
        id: rp.id || `sync_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        nome: String(rp.nome || 'Ponto').trim(),
        tipo: rp.tipo || 'geral',
        simbolo: rp.simbolo || rp.sym || '',
        cor: rp.cor || '',
        lat: Number(lat.toFixed(6)),
        lon: Number(lon.toFixed(6)),
        ele: rp.ele ?? null,
        desc: rp.nota || rp.desc || '',
        nota: rp.nota || rp.desc || '',
        sym: rp.simbolo || rp.sym || 'Waypoint',
        manual: true,
        origem: 'Manual',
        criadoEmTs: Number(rp.criadoEmTs) || Date.now(),
        criado_em: rp.criado_em || new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
    }

    if (novos.length === 0) return 0;

    // Inserir do mais antigo para o mais recente para manter ordem no topo
    const ordenados = novos.slice().sort((a, b) => (a.criadoEmTs || 0) - (b.criadoEmTs || 0));

    if (typeof window.integrarGpxNaPastaEventos === 'function') {
      window.integrarGpxNaPastaEventos(ordenados);
    }

    if (typeof window.adicionarWaypointPrincipal === 'function') {
      ordenados.forEach((w) => {
        window.adicionarWaypointPrincipal(w, { noTopo: true, renderizarNoMapa: true });
      });
    }

    return novos.length;
  }

  async function lerFicheiroRemoto(repo, pat) {
    const url = `https://api.github.com/repos/${repo}/contents/${SYNC_PATH}?ref=main`;
    const resp = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
      },
    });

    if (resp.status === 404) {
      return { existe: false, sha: null, pontos: [] };
    }

    if (!resp.ok) {
      const textoErro = await resp.text().catch(() => '');
      throw new Error(`GitHub GET ${resp.status}: ${textoErro.slice(0, 120)}`);
    }

    const dados = await resp.json();
    const jsonTexto = base64ParaUtf8(dados.content || '');
    let parsed = {};
    try {
      parsed = jsonTexto ? JSON.parse(jsonTexto) : {};
    } catch (_) {
      parsed = {};
    }
    const pontos = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.pontos) ? parsed.pontos : []);
    return { existe: true, sha: dados.sha, pontos };
  }

  async function gravarFicheiroRemoto(repo, pat, sha, pontosUnificados, qtdNovos) {
    const url = `https://api.github.com/repos/${repo}/contents/${SYNC_PATH}`;
    const conteudoJson = JSON.stringify(
      {
        versao: 1,
        atualizado_em: new Date().toISOString(),
        total: pontosUnificados.length,
        pontos: pontosUnificados,
      },
      null,
      2
    );

    const payload = {
      message: `Sincronização GPS Náutico (${qtdNovos} novo(s), ${pontosUnificados.length} total)`,
      content: utf8ParaBase64(conteudoJson),
      branch: 'main',
    };
    if (sha) payload.sha = sha;

    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const textoErro = await resp.text().catch(() => '');
      throw new Error(`GitHub PUT ${resp.status}: ${textoErro.slice(0, 120)}`);
    }
    return resp.json();
  }

  async function sincronizarAgora({ silencioso = false, criarSeInexistente = false } = {}) {
    const { repo, pat } = obterConfig();
    if (!pat) {
      atualizarIndicadorUI();
      if (!silencioso) {
        abrirConfigSync();
        notificar('⚙️ Configura o Token do GitHub nas Definições para sincronizar.');
      }
      return { sucesso: false, motivo: 'sem_config' };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      atualizarIndicadorUI();
      if (!silencioso) {
        notificar('📡 Sem ligação à internet. Os pontos serão enviados automaticamente quando houver rede.');
      }
      return { sucesso: false, motivo: 'offline' };
    }

    if (sincronizando) return { sucesso: false, motivo: 'em_curso' };
    sincronizando = true;
    atualizarIndicadorUI();

    try {
      const remoto = await lerFicheiroRemoto(repo, pat);
      const chavesRemotas = new Set(remoto.pontos.map(chaveUnica).filter(Boolean));
      const recebidos = integrarPontosRemotosLocalmente(remoto.pontos);

      const locais = obterPontosManuaisLocais();
      const paraEnviar = locais.filter((p) => !chavesRemotas.has(chaveUnica(p)));

      const deveCriarInicial = !remoto.existe && (locais.length > 0 || criarSeInexistente || !silencioso);
      if (paraEnviar.length > 0 || deveCriarInicial) {
        const mapaUnificado = new Map();
        [...locais, ...remoto.pontos].forEach((p) => {
          const c = chaveUnica(p);
          if (c && !mapaUnificado.has(c)) {
            mapaUnificado.set(c, p);
          }
        });
        const unificados = Array.from(mapaUnificado.values()).sort(
          (a, b) => (Number(b.criadoEmTs) || 0) - (Number(a.criadoEmTs) || 0)
        );
        await gravarFicheiroRemoto(repo, pat, remoto.sha, unificados, paraEnviar.length);
      }

      const enviadas = obterChavesEnviadas();
      locais.forEach((p) => enviadas.add(chaveUnica(p)));
      remoto.pontos.forEach((p) => {
        const c = chaveUnica(p);
        if (c) enviadas.add(c);
      });
      guardarChavesEnviadas(enviadas);

      try {
        const agora = new Date();
        const hh = String(agora.getHours()).padStart(2, '0');
        const mm = String(agora.getMinutes()).padStart(2, '0');
        localStorage.setItem(KEY_ULTIMA_SYNC, `${hh}:${mm}`);
      } catch (_) {}

      if (!silencioso || recebidos > 0 || paraEnviar.length > 0) {
        if (recebidos > 0 || paraEnviar.length > 0) {
          notificar(`☁️ Sincronizado! ${paraEnviar.length} enviado(s), ${recebidos} recebido(s).`);
        } else if (!silencioso) {
          notificar('✅ Tudo sincronizado com o GitHub.');
        }
      }

      return { sucesso: true, enviados: paraEnviar.length, recebidos };
    } catch (err) {
      console.warn('Erro na sincronização GitHub:', err);
      if (!silencioso) {
        notificar(`⚠️ Erro na sincronização: ${err.message}`);
      }
      return { sucesso: false, erro: err.message };
    } finally {
      sincronizando = false;
      atualizarIndicadorUI();
    }
  }

  function abrirConfigSync() {
    const { repo, pat } = obterConfig();
    const modalSync = document.getElementById('modalSyncToken');
    const inpModalRepo = document.getElementById('inputSyncModalRepo');
    const inpModalPat = document.getElementById('inputSyncModalToken');
    if (modalSync) {
      if (inpModalRepo) inpModalRepo.value = repo;
      if (inpModalPat) inpModalPat.value = pat;
      modalSync.classList.add('aberta');
      if (inpModalPat) setTimeout(() => inpModalPat.focus(), 120);
      return;
    }

    const modal = document.getElementById('modalDefinicoes');
    if (modal) modal.classList.add('aberta');
    const inp = document.getElementById('inputSyncGithubToken');
    if (inp) {
      setTimeout(() => inp.focus(), 150);
    }
  }

  function notificarPontoNovoLocal() {
    atualizarIndicadorUI();
    const { pat } = obterConfig();
    if (!pat) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    clearTimeout(timerAutoSync);
    timerAutoSync = setTimeout(() => {
      sincronizarAgora({ silencioso: true });
    }, 1500);
  }

  function inicializarUI() {
    const { repo, pat } = obterConfig();
    const inpRepo = document.getElementById('inputSyncGithubRepo');
    const inpPat = document.getElementById('inputSyncGithubToken');
    const btnGuardar = document.getElementById('btnGuardarSyncGithub');
    const inpModalRepo = document.getElementById('inputSyncModalRepo');
    const inpModalPat = document.getElementById('inputSyncModalToken');
    const btnGuardarModal = document.getElementById('btnGuardarSyncModal');

    if (inpRepo) inpRepo.value = repo;
    if (inpPat) inpPat.value = pat;
    if (inpModalRepo) inpModalRepo.value = repo;
    if (inpModalPat) inpModalPat.value = pat;

    const aplicarConfigESincronizar = (novoRepo, novoPat) => {
      guardarConfig(novoRepo, novoPat);
      const repoLimpo = normalizarRepo(novoRepo);
      const patLimpo = String(novoPat || '').trim();
      if (inpRepo) inpRepo.value = repoLimpo;
      if (inpPat) inpPat.value = patLimpo;
      if (inpModalRepo) inpModalRepo.value = repoLimpo;
      if (inpModalPat) inpModalPat.value = patLimpo;

      const modalSync = document.getElementById('modalSyncToken');
      if (modalSync) modalSync.classList.remove('aberta');

      if (patLimpo) {
        notificar('☁️ Token guardado! A sincronizar pontos...');
        sincronizarAgora({ silencioso: false, criarSeInexistente: true });
      } else {
        notificar('Token removido. Sincronização desativada.');
      }
    };

    if (btnGuardar) {
      btnGuardar.addEventListener('click', () => {
        aplicarConfigESincronizar(
          inpRepo ? inpRepo.value : DEFAULT_REPO,
          inpPat ? inpPat.value : ''
        );
      });
    }

    if (btnGuardarModal) {
      btnGuardarModal.addEventListener('click', () => {
        aplicarConfigESincronizar(
          inpModalRepo ? inpModalRepo.value : DEFAULT_REPO,
          inpModalPat ? inpModalPat.value : ''
        );
      });
    }

    atualizarIndicadorUI();

    // Sincronizar automaticamente ao abrir com internet
    if (pat && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      setTimeout(() => {
        sincronizarAgora({ silencioso: true });
      }, 1600);
    }
  }

  window.addEventListener('online', () => {
    atualizarIndicadorUI();
    const { pat } = obterConfig();
    if (pat) {
      sincronizarAgora({ silencioso: true });
    }
  });

  window.addEventListener('offline', () => {
    atualizarIndicadorUI();
  });

  window.SyncGithubNautico = {
    sincronizarAgora,
    notificarPontoNovoLocal,
    atualizarIndicadorUI,
    abrirConfigSync,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarUI);
  } else {
    inicializarUI();
  }
})();
