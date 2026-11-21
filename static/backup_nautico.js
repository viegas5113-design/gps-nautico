(() => {
  'use strict';

  const CHAVE_URL_VIGILANTE = 'gps_nautico_vigilante_url';
  const URL_PADRAO = 'http://192.168.1.195:8765';
  const CHAVE_EVENTOS = 'gps_nautico_pasta_eventos_v1';
  const CHAVE_FICHEIRO = 'gps_nautico_ficheiro_ativo_v1';
  const CHAVE_DIARIO = 'gps_nautico_diario_pesca_v1';

  let timerSilencioso = null;
  let envioEmCurso = false;

  function obterBaseUrl() {
    try {
      const val = localStorage.getItem(CHAVE_URL_VIGILANTE);
      const limpa = (val && val.trim() ? val.trim() : URL_PADRAO).replace(/\/+$/, '');
      return limpa.endsWith('/api/chat') ? limpa.slice(0, -9) : limpa;
    } catch (_) {
      return URL_PADRAO;
    }
  }

  function notificar(msg) {
    const toast = document.getElementById('toastNotificacao');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visivel');
      clearTimeout(window.__toastBackupNauticoTimer);
      window.__toastBackupNauticoTimer = setTimeout(() => toast.classList.remove('visivel'), 3400);
    }
  }

  function lerListaStorage(chave) {
    try {
      const bruto = localStorage.getItem(chave);
      if (!bruto) return [];
      const parsed = JSON.parse(bruto);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function recolherPayload() {
    let ficheiroAtivo = 'pesqueiros.gpx';
    try {
      ficheiroAtivo = localStorage.getItem(CHAVE_FICHEIRO) || 'pesqueiros.gpx';
    } catch (_) {}

    return {
      versao: 1,
      origem: 'gps-nautico',
      guardado_em: new Date().toISOString(),
      ficheiro_ativo: ficheiroAtivo,
      pasta_eventos: lerListaStorage(CHAVE_EVENTOS),
      diario_pesca: lerListaStorage(CHAVE_DIARIO),
    };
  }

  async function enviarBackupPc({ silencioso = false } = {}) {
    if (envioEmCurso) return false;
    const payload = recolherPayload();

    if (silencioso && payload.pasta_eventos.length === 0 && payload.diario_pesca.length === 0) {
      return false;
    }

    const baseUrl = obterBaseUrl();
    const endpoint = `${baseUrl}/api/backup_nautico`;
    const controller = new AbortController();
    const timeoutMs = silencioso ? 3500 : 7000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    envioEmCurso = true;
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        if (!silencioso) notificar(`⚠️ Erro do servidor ao guardar backup (${resp.status}).`);
        return false;
      }
      const res = await resp.json();
      if (res && res.sucesso) {
        if (!silencioso) {
          notificar(`☁️ Backup guardado no PC (${payload.pasta_eventos.length} pontos, ${payload.diario_pesca.length} registos)!`);
        }
        return true;
      }
      if (!silencioso) notificar('⚠️ Não foi possível confirmar o backup no PC.');
      return false;
    } catch (_) {
      clearTimeout(timer);
      if (!silencioso) {
        notificar(`⚠️ Sem ligação ao PC de casa (${baseUrl}).`);
      }
      return false;
    } finally {
      envioEmCurso = false;
    }
  }

  function agendarSilencioso(atrasoMs = 2500) {
    clearTimeout(timerSilencioso);
    timerSilencioso = setTimeout(() => {
      enviarBackupPc({ silencioso: true });
    }, atrasoMs);
  }

  async function restaurarManual() {
    const baseUrl = obterBaseUrl();
    const endpoint = `${baseUrl}/api/restaurar_nautico`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

    try {
      const resp = await fetch(endpoint, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) {
        let msg = `⚠️ Sem backup disponível no PC (${resp.status}).`;
        try {
          const errJson = await resp.json();
          if (errJson && errJson.erro) msg = `⚠️ ${errJson.erro}`;
        } catch (_) {}
        notificar(msg);
        return false;
      }
      const res = await resp.json();
      const dados = res && res.dados ? res.dados : null;
      if (!res || !res.sucesso || !dados) {
        notificar('⚠️ Resposta inválida ao restaurar backup do PC.');
        return false;
      }

      const eventos = Array.isArray(dados.pasta_eventos) ? dados.pasta_eventos : [];
      const diario = Array.isArray(dados.diario_pesca) ? dados.diario_pesca : [];
      const dataStr = dados.servidor_guardado_em || dados.guardado_em || 'desconhecida';

      if (
        !confirm(
          `Restaurar backup do PC (${dataStr})?\n\n` +
            `• Pontos na Pasta de Eventos: ${eventos.length}\n` +
            `• Registos no Diário de Pesca: ${diario.length}\n\n` +
            `Isto substitui os dados atuais neste dispositivo.`
        )
      ) {
        return false;
      }

      localStorage.setItem(CHAVE_EVENTOS, JSON.stringify(eventos));
      if (dados.ficheiro_ativo) {
        localStorage.setItem(CHAVE_FICHEIRO, String(dados.ficheiro_ativo));
      }
      localStorage.setItem(CHAVE_DIARIO, JSON.stringify(diario));

      if (typeof window.recarregarPastaEventosLocal === 'function') {
        window.recarregarPastaEventosLocal();
      }
      if (window.DiarioPesca && typeof window.DiarioPesca.recarregarLocal === 'function') {
        window.DiarioPesca.recarregarLocal();
      }

      notificar(`📥 Backup restaurado do PC (${eventos.length} pontos, ${diario.length} registos)!`);
      return true;
    } catch (_) {
      clearTimeout(timer);
      notificar(`⚠️ Sem ligação ao PC de casa (${baseUrl}).`);
      return false;
    }
  }

  window.BackupNautico = {
    guardarManual: () => enviarBackupPc({ silencioso: false }),
    restaurarManual,
    agendarSilencioso,
  };

  // Backup silencioso automático ao abrir (se estiver no Wi-Fi de casa)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => agendarSilencioso(4500));
  } else {
    agendarSilencioso(4500);
  }
})();
