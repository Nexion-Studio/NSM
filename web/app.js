/**
 * NSM - Nexion Studio Macro
 * Frontend Application Controller
 * Handles UI events, Web Audio synthetic soundscapes, state syncing & API calls.
 */

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playStart() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playStop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.14);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playPanic() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.08;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(200, t + 0.07);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }
}

class NSMApp {
  constructor() {
    this.api = null;
    this.sound = new SoundSynthesizer();
    this.macros = [];
    this.activeMacroIds = new Set();
    this.currentFilter = 'all';
    this.panicHotkey = 'f10';
    this.alwaysOnTop = false;
    this.totalActions = 0;
    this.isRecording = false;

    this.initDOM();
    this.initEvents();
    this.waitForApi();
  }

  initDOM() {
    // Top Bar
    this.soundIcon = document.getElementById('soundIcon');
    this.pinIcon = document.getElementById('pinIcon');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.btnPinToggle = document.getElementById('btnPinToggle');
    this.btnMinimize = document.getElementById('btnMinimize');
    this.btnClose = document.getElementById('btnClose');

    // Telemetry
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    this.activeMacrosCount = document.getElementById('activeMacrosCount');
    this.totalActionsCount = document.getElementById('totalActionsCount');
    this.liveCPS = document.getElementById('liveCPS');
    this.btnPanicKill = document.getElementById('btnPanicKill');
    this.panicKeyBadge = document.getElementById('panicKeyBadge');

    // Filters & Actions
    this.filterBtns = document.querySelectorAll('.filter-btn');
    this.countAll = document.getElementById('countAll');
    this.countSpam = document.getElementById('countSpam');
    this.countHold = document.getElementById('countHold');
    this.countActive = document.getElementById('countActive');
    this.btnResetPresets = document.getElementById('btnResetPresets');
    this.btnNewMacro = document.getElementById('btnNewMacro');
    this.macrosGrid = document.getElementById('macrosGrid');
    this.emptyState = document.getElementById('emptyState');
    this.btnEmptyCreate = document.getElementById('btnEmptyCreate');

    // Macro Modal
    this.macroModal = document.getElementById('macroModal');
    this.macroForm = document.getElementById('macroForm');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalModeTag = document.getElementById('modalModeTag');
    this.btnModalClose = document.getElementById('btnModalClose');
    this.btnModalCancel = document.getElementById('btnModalCancel');
    this.macroId = document.getElementById('macroId');
    this.macroName = document.getElementById('macroName');
    this.macroColor = document.getElementById('macroColor');
    this.colorCode = document.getElementById('colorCode');

    // Macro Form inputs
    this.typeSpamRadio = document.getElementById('typeSpamRadio');
    this.typeHoldRadio = document.getElementById('typeHoldRadio');
    this.targetType = document.getElementById('targetType');
    this.mouseKeyGroup = document.getElementById('mouseKeyGroup');
    this.keyboardKeyGroup = document.getElementById('keyboardKeyGroup');
    this.mouseButtonSelect = document.getElementById('mouseButtonSelect');
    this.keyboardKeyInput = document.getElementById('keyboardKeyInput');

    this.spamSettingsGroup = document.getElementById('spamSettingsGroup');
    this.holdSettingsGroup = document.getElementById('holdSettingsGroup');
    this.intervalSlider = document.getElementById('intervalSlider');
    this.intervalMs = document.getElementById('intervalMs');
    this.cpsPreviewBadge = document.getElementById('cpsPreviewBadge');
    this.jitterSlider = document.getElementById('jitterSlider');
    this.jitterValBadge = document.getElementById('jitterValBadge');
    this.spamModeSelect = document.getElementById('spamModeSelect');
    this.repeatCountGroup = document.getElementById('repeatCountGroup');
    this.repeatCountInput = document.getElementById('repeatCountInput');
    this.timeLimitGroup = document.getElementById('timeLimitGroup');
    this.timeLimitInput = document.getElementById('timeLimitInput');

    this.holdSlider = document.getElementById('holdSlider');
    this.holdDurationMs = document.getElementById('holdDurationMs');
    this.holdDurationHint = document.getElementById('holdDurationHint');
    this.releaseDelayMs = document.getElementById('releaseDelayMs');
    this.holdLoopCheckbox = document.getElementById('holdLoopCheckbox');

    // Hotkey recording
    this.currentHotkeyDisplay = document.getElementById('currentHotkeyDisplay');
    this.btnRecordHotkey = document.getElementById('btnRecordHotkey');
    this.recordBtnText = document.getElementById('recordBtnText');
    this.macroHotkey = document.getElementById('macroHotkey');

    // Panic Modal
    this.panicModal = document.getElementById('panicModal');
    this.btnPanicModalClose = document.getElementById('btnPanicModalClose');
    this.currentPanicDisplay = document.getElementById('currentPanicDisplay');
    this.btnRecordPanicKey = document.getElementById('btnRecordPanicKey');
    this.recordPanicBtnText = document.getElementById('recordPanicBtnText');
  }

  initEvents() {
    // Window Controls
    this.btnSoundToggle.addEventListener('click', () => this.toggleSound());
    this.btnPinToggle.addEventListener('click', () => this.togglePin());
    this.btnMinimize.addEventListener('click', () => this.api && this.api.minimize_window());
    this.btnClose.addEventListener('click', () => this.api && this.api.close_window());

    // Panic Button: Click = Abort All, Double Click or Right Click = Edit Panic Key
    this.btnPanicKill.addEventListener('click', (e) => {
      this.sound.playPanic();
      if (this.api) this.api.stop_all();
    });
    this.btnPanicKill.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.openPanicModal();
    });

    // Filters
    this.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.playClick();
        this.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderMacros();
      });
    });

    // Actions
    this.btnResetPresets.addEventListener('click', () => this.resetPresets());
    this.btnNewMacro.addEventListener('click', () => this.openCreateModal());
    this.btnEmptyCreate.addEventListener('click', () => this.openCreateModal());

    // Modal Lifecycle
    this.btnModalClose.addEventListener('click', () => this.closeModal());
    this.btnModalCancel.addEventListener('click', () => this.closeModal());
    this.btnPanicModalClose.addEventListener('click', () => this.closePanicModal());

    // Macro Form Type Switch
    this.typeSpamRadio.addEventListener('change', () => this.updateFormType());
    this.typeHoldRadio.addEventListener('change', () => this.updateFormType());

    // Target Switch
    this.targetType.addEventListener('change', () => this.updateTargetType());

    // Quick Keys
    document.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.keyboardKeyInput.value = chip.dataset.k;
        this.sound.playClick();
      });
    });

    // Color Picker
    this.macroColor.addEventListener('input', (e) => {
      this.colorCode.textContent = e.target.value;
    });

    // Sliders & Number Sync
    this.intervalSlider.addEventListener('input', (e) => {
      this.intervalMs.value = e.target.value;
      this.updateCPSPreview();
    });
    this.intervalMs.addEventListener('input', (e) => {
      this.intervalSlider.value = e.target.value;
      this.updateCPSPreview();
    });

    // Quick CPS buttons
    document.querySelectorAll('.btn-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const interval = btn.dataset.interval;
        this.intervalSlider.value = interval;
        this.intervalMs.value = interval;
        this.updateCPSPreview();
        this.sound.playClick();
      });
    });

    // Jitter slider
    this.jitterSlider.addEventListener('input', (e) => {
      const v = e.target.value;
      this.jitterValBadge.textContent = v == 0 ? '0% (Régulier)' : `±${v}% (Anti-Cheat)`;
    });

    // Spam mode switch
    this.spamModeSelect.addEventListener('change', () => {
      const m = this.spamModeSelect.value;
      this.repeatCountGroup.style.display = m === 'repeat_count' ? 'flex' : 'none';
      this.timeLimitGroup.style.display = m === 'time_limit' ? 'flex' : 'none';
    });

    // Hold Duration Sync
    this.holdSlider.addEventListener('input', (e) => {
      this.holdDurationMs.value = e.target.value;
      this.updateHoldDurationHint();
    });
    this.holdDurationMs.addEventListener('input', (e) => {
      this.holdSlider.value = e.target.value;
      this.updateHoldDurationHint();
    });

    // Record Hotkey
    this.btnRecordHotkey.addEventListener('click', () => this.startRecordHotkey());
    this.btnRecordPanicKey.addEventListener('click', () => this.startRecordPanicKey());

    // Submit Macro Form
    this.macroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMacro();
    });

    // Expose global callback hooks for Python backend
    window.onMacroStateChange = (macroId, isRunning) => {
      if (macroId === '__ALL__') {
        this.activeMacroIds.clear();
      } else {
        if (isRunning) {
          this.activeMacroIds.add(macroId);
          this.sound.playStart();
        } else {
          this.activeMacroIds.delete(macroId);
          this.sound.playStop();
        }
      }
      this.updateTelemetry();
      this.renderMacros();
    };

    window.onPanicTriggered = () => {
      this.sound.playPanic();
      this.activeMacroIds.clear();
      this.updateTelemetry();
      this.renderMacros();
    };

    // Telemetry tick loop for CPS calculation
    setInterval(() => this.updateCPS(), 800);
  }

  waitForApi() {
    const check = () => {
      if (window.pywebview && window.pywebview.api) {
        this.api = window.pywebview.api;
        this.loadInitialState();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  }

  async loadInitialState() {
    try {
      const state = await this.api.get_initial_state();
      this.macros = state.macros || [];
      this.activeMacroIds = new Set(state.active_macro_ids || []);
      this.panicHotkey = state.panic_hotkey || 'f10';
      this.alwaysOnTop = Boolean(state.always_on_top);
      this.sound.enabled = Boolean(state.sound_enabled);
      this.totalActions = state.total_actions || 0;

      this.updateSoundIcon();
      this.updatePinIcon();
      this.panicKeyBadge.textContent = `TOUCHE [${this.panicHotkey.toUpperCase()}]`;
      this.currentPanicDisplay.textContent = this.panicHotkey.toUpperCase();

      this.updateTelemetry();
      this.renderMacros();
    } catch (e) {
      console.error("Failed to load initial state:", e);
    }
  }

  updateSoundIcon() {
    this.soundIcon.textContent = this.sound.enabled ? '🔊' : '🔇';
    this.btnSoundToggle.title = this.sound.enabled ? 'Couper le son' : 'Activer le son';
  }

  async toggleSound() {
    this.sound.enabled = !this.sound.enabled;
    this.updateSoundIcon();
    if (this.api) await this.api.toggle_sound();
  }

  updatePinIcon() {
    this.pinIcon.style.color = this.alwaysOnTop ? 'var(--neon-cyan)' : 'var(--text-muted)';
  }

  async togglePin() {
    if (this.api) {
      this.alwaysOnTop = await this.api.toggle_always_on_top();
      this.updatePinIcon();
    }
  }

  async resetPresets() {
    if (!confirm("Voulez-vous recharger tous les modèles de macro prédéfinis de Nexion Studio ?")) return;
    if (this.api) {
      const res = await this.api.reset_default_presets();
      if (res && res.macros) {
        this.macros = res.macros;
        this.activeMacroIds.clear();
        this.updateTelemetry();
        this.renderMacros();
      }
    }
  }

  updateTelemetry() {
    const activeCount = this.activeMacroIds.size;
    this.activeMacrosCount.textContent = activeCount;

    if (activeCount > 0) {
      this.statusIndicator.classList.add('active');
      this.statusText.textContent = `${activeCount} EN COURS`;
      this.statusText.style.color = 'var(--neon-green)';
    } else {
      this.statusIndicator.classList.remove('active');
      this.statusText.textContent = 'PRÊT';
      this.statusText.style.color = 'var(--text-main)';
    }

    // Counts by category
    const spamCount = this.macros.filter(m => m.type === 'spam').length;
    const holdCount = this.macros.filter(m => m.type === 'hold').length;

    this.countAll.textContent = this.macros.length;
    this.countSpam.textContent = spamCount;
    this.countHold.textContent = holdCount;
    this.countActive.textContent = activeCount;
  }

  updateCPS() {
    let totalCps = 0;
    this.activeMacroIds.forEach(id => {
      const m = this.macros.find(x => x.id === id);
      if (m && m.type === 'spam') {
        const interval = Math.max(1, m.interval_ms || 20);
        totalCps += (1000 / interval);
        this.totalActions += Math.round(totalCps * 0.8);
      } else if (m && m.type === 'hold') {
        totalCps += 1;
        this.totalActions += 1;
      }
    });

    this.liveCPS.textContent = totalCps > 0 ? totalCps.toFixed(1) : '0.0';
    this.totalActionsCount.textContent = this.totalActions.toLocaleString();
  }

  renderMacros() {
    let filtered = this.macros;
    if (this.currentFilter === 'spam') {
      filtered = this.macros.filter(m => m.type === 'spam');
    } else if (this.currentFilter === 'hold') {
      filtered = this.macros.filter(m => m.type === 'hold');
    } else if (this.currentFilter === 'active') {
      filtered = this.macros.filter(m => this.activeMacroIds.has(m.id));
    }

    if (filtered.length === 0) {
      this.macrosGrid.innerHTML = '';
      this.emptyState.style.display = 'flex';
      return;
    }

    this.emptyState.style.display = 'none';
    this.macrosGrid.innerHTML = '';

    filtered.forEach(m => {
      const isActive = this.activeMacroIds.has(m.id);
      const card = document.createElement('div');
      card.className = `macro-card ${isActive ? 'is-active' : ''}`;
      card.dataset.id = m.id;

      const isSpam = m.type === 'spam';
      const typeLabel = isSpam ? '⚡ SPAM' : '⏳ MAINTIEN';
      const typeClass = isSpam ? '' : 'hold';

      let targetLabel = '';
      if (m.target_type === 'mouse') {
        const mouseNames = { left: 'Clic Gauche', right: 'Clic Droit', middle: 'Clic Molette', x1: 'Bouton 4', x2: 'Bouton 5' };
        targetLabel = `🖱️ ${mouseNames[m.target_key] || m.target_key}`;
      } else {
        targetLabel = `⌨️ Touche [${(m.target_key || 'E').toUpperCase()}]`;
      }

      let speedLabel = '';
      if (isSpam) {
        const cps = (1000 / Math.max(1, m.interval_ms || 20)).toFixed(0);
        speedLabel = `${m.interval_ms}ms (${cps} CPS)`;
      } else {
        const s = (m.hold_duration_ms / 1000).toFixed(1);
        speedLabel = `Hold: ${s}s`;
      }

      card.innerHTML = `
        <div class="macro-card-accent" style="background: ${m.color || 'var(--neon-cyan)'}"></div>
        <div class="card-header">
          <div class="card-title-group">
            <span class="macro-type-badge ${typeClass}">${typeLabel}</span>
            <h3 class="macro-name">${this.escapeHtml(m.name)}</h3>
          </div>
          <div class="card-header-actions">
            <button class="card-icon-btn edit" title="Modifier" data-action="edit">✏️</button>
            <button class="card-icon-btn copy" title="Dupliquer" data-action="duplicate">📋</button>
            <button class="card-icon-btn delete" title="Supprimer" data-action="delete">🗑️</button>
          </div>
        </div>

        <div class="card-details">
          <div class="detail-item">
            <span class="detail-label">CIBLE SIMULÉE</span>
            <span class="detail-val key-chip">${targetLabel}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">RACCOURCI CLAVIER</span>
            <span class="detail-val hotkey-chip">[${(m.hotkey || 'NON DÉFINI').toUpperCase()}]</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">VITESSE / TEMPS</span>
            <span class="detail-val">${speedLabel}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">MODE</span>
            <span class="detail-val">${m.mode === 'hold_key' ? 'Maintien raccourci' : 'Bascule (Toggle)'}</span>
          </div>
        </div>

        <button class="macro-toggle-btn ${isActive ? 'running' : ''}" data-action="toggle">
          <span>${isActive ? '⏹️ ARRÊTER LA MACRO' : '▶️ DÉMARRER LA MACRO'}</span>
        </button>
      `;

      // Event handlers
      card.querySelector('[data-action="toggle"]').addEventListener('click', () => this.toggleMacro(m.id));
      card.querySelector('[data-action="edit"]').addEventListener('click', () => this.openEditModal(m));
      card.querySelector('[data-action="duplicate"]').addEventListener('click', () => this.duplicateMacro(m));
      card.querySelector('[data-action="delete"]').addEventListener('click', () => this.deleteMacro(m.id));

      this.macrosGrid.appendChild(card);
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async toggleMacro(macroId) {
    this.sound.playClick();
    if (this.api) {
      await this.api.toggle_macro(macroId);
    }
  }

  async deleteMacro(macroId) {
    if (!confirm("Voulez-vous vraiment supprimer cette macro ?")) return;
    this.sound.playClick();
    if (this.api) {
      await this.api.delete_macro(macroId);
      this.macros = this.macros.filter(m => m.id !== macroId);
      this.activeMacroIds.delete(macroId);
      this.updateTelemetry();
      this.renderMacros();
    }
  }

  async duplicateMacro(macro) {
    const clone = JSON.parse(JSON.stringify(macro));
    clone.id = 'macro_' + Date.now();
    clone.name = `${clone.name} (Copie)`;
    clone.hotkey = ''; // Clear hotkey to avoid collision
    if (this.api) {
      await this.api.save_macro(clone);
      this.macros.push(clone);
      this.updateTelemetry();
      this.renderMacros();
      this.sound.playClick();
    }
  }

  openCreateModal() {
    this.sound.playClick();
    this.modalTitle.textContent = "Nouvelle Macro";
    this.modalModeTag.textContent = "CRÉATION";
    this.macroId.value = '';
    this.macroName.value = `Macro #${this.macros.length + 1}`;
    this.macroColor.value = '#00f2fe';
    this.colorCode.textContent = '#00f2fe';

    this.typeSpamRadio.checked = true;
    this.targetType.value = 'mouse';
    this.mouseButtonSelect.value = 'left';
    this.keyboardKeyInput.value = 'e';

    this.intervalSlider.value = 20;
    this.intervalMs.value = 20;
    this.jitterSlider.value = 0;
    this.jitterValBadge.textContent = '0% (Régulier)';
    this.spamModeSelect.value = 'toggle';

    this.holdSlider.value = 3000;
    this.holdDurationMs.value = 3000;
    this.releaseDelayMs.value = 50;
    this.holdLoopCheckbox.checked = true;

    this.macroHotkey.value = 'f6';
    this.currentHotkeyDisplay.textContent = 'F6';

    this.updateFormType();
    this.updateTargetType();
    this.updateCPSPreview();
    this.updateHoldDurationHint();

    this.macroModal.style.display = 'flex';
  }

  openEditModal(macro) {
    this.sound.playClick();
    this.modalTitle.textContent = "Modifier la Macro";
    this.modalModeTag.textContent = "ÉDITION";
    this.macroId.value = macro.id;
    this.macroName.value = macro.name;
    this.macroColor.value = macro.color || '#00f2fe';
    this.colorCode.textContent = macro.color || '#00f2fe';

    if (macro.type === 'hold') {
      this.typeHoldRadio.checked = true;
    } else {
      this.typeSpamRadio.checked = true;
    }

    this.targetType.value = macro.target_type || 'mouse';
    if (macro.target_type === 'mouse') {
      this.mouseButtonSelect.value = macro.target_key || 'left';
    } else {
      this.keyboardKeyInput.value = macro.target_key || 'e';
    }

    this.intervalSlider.value = macro.interval_ms || 20;
    this.intervalMs.value = macro.interval_ms || 20;
    this.jitterSlider.value = macro.jitter_percent || 0;
    this.jitterValBadge.textContent = (macro.jitter_percent || 0) == 0 ? '0% (Régulier)' : `±${macro.jitter_percent}% (Anti-Cheat)`;
    this.spamModeSelect.value = macro.mode || 'toggle';
    this.repeatCountInput.value = macro.repeat_count || 100;
    this.timeLimitInput.value = macro.time_limit_sec || 10;

    this.holdSlider.value = macro.hold_duration_ms || 3000;
    this.holdDurationMs.value = macro.hold_duration_ms || 3000;
    this.releaseDelayMs.value = macro.release_delay_ms || 50;
    this.holdLoopCheckbox.checked = macro.loop !== false;

    this.macroHotkey.value = macro.hotkey || '';
    this.currentHotkeyDisplay.textContent = (macro.hotkey || 'AUCUN').toUpperCase();

    this.updateFormType();
    this.updateTargetType();
    this.updateCPSPreview();
    this.updateHoldDurationHint();

    this.macroModal.style.display = 'flex';
  }

  closeModal() {
    this.macroModal.style.display = 'none';
    if (this.isRecording && this.api) {
      this.api.cancel_record_hotkey();
      this.isRecording = false;
      this.btnRecordHotkey.classList.remove('recording');
      this.recordBtnText.textContent = "Modifier le raccourci";
    }
  }

  updateFormType() {
    const isSpam = this.typeSpamRadio.checked;
    this.spamSettingsGroup.style.display = isSpam ? 'flex' : 'none';
    this.holdSettingsGroup.style.display = isSpam ? 'none' : 'flex';
  }

  updateTargetType() {
    const isMouse = this.targetType.value === 'mouse';
    this.mouseKeyGroup.style.display = isMouse ? 'flex' : 'none';
    this.keyboardKeyGroup.style.display = isMouse ? 'none' : 'flex';
  }

  updateCPSPreview() {
    const ms = Math.max(1, parseInt(this.intervalMs.value) || 20);
    const cps = (1000 / ms).toFixed(1);
    this.cpsPreviewBadge.textContent = `${cps} CPS`;
  }

  updateHoldDurationHint() {
    const ms = parseInt(this.holdDurationMs.value) || 3000;
    const s = (ms / 1000).toFixed(1);
    this.holdDurationHint.textContent = `${s} seconde(s) d'appui continu`;
  }

  async startRecordHotkey() {
    this.sound.playClick();
    this.isRecording = true;
    this.btnRecordHotkey.classList.add('recording');
    this.recordBtnText.textContent = "Appuyez sur une touche...";

    try {
      const key = await this.api.record_hotkey();
      if (key) {
        this.macroHotkey.value = key;
        this.currentHotkeyDisplay.textContent = key.toUpperCase();
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isRecording = false;
      this.btnRecordHotkey.classList.remove('recording');
      this.recordBtnText.textContent = "Modifier le raccourci";
    }
  }

  async saveMacro() {
    const isSpam = this.typeSpamRadio.checked;
    const isMouse = this.targetType.value === 'mouse';

    const macroData = {
      id: this.macroId.value || 'macro_' + Date.now(),
      name: this.macroName.value.trim() || 'Sans Nom',
      color: this.macroColor.value,
      type: isSpam ? 'spam' : 'hold',
      enabled: true,
      hotkey: this.macroHotkey.value.trim().toLowerCase(),
      target_type: this.targetType.value,
      target_key: isMouse ? this.mouseButtonSelect.value : (this.keyboardKeyInput.value.trim().toLowerCase() || 'e')
    };

    if (isSpam) {
      macroData.interval_ms = Math.max(1, parseInt(this.intervalMs.value) || 20);
      macroData.jitter_percent = parseInt(this.jitterSlider.value) || 0;
      macroData.click_hold_ms = 5;
      macroData.mode = this.spamModeSelect.value;
      macroData.repeat_count = parseInt(this.repeatCountInput.value) || 0;
      macroData.time_limit_sec = parseFloat(this.timeLimitInput.value) || 0;
    } else {
      macroData.hold_duration_ms = Math.max(50, parseInt(this.holdDurationMs.value) || 3000);
      macroData.release_delay_ms = Math.max(10, parseInt(this.releaseDelayMs.value) || 50);
      macroData.loop = this.holdLoopCheckbox.checked;
      macroData.repeat_count = 0;
    }

    if (this.api) {
      await this.api.save_macro(macroData);
      const idx = this.macros.findIndex(m => m.id === macroData.id);
      if (idx >= 0) {
        this.macros[idx] = macroData;
      } else {
        this.macros.push(macroData);
      }
      this.updateTelemetry();
      this.renderMacros();
      this.closeModal();
      this.sound.playClick();
    }
  }

  // Panic Modal
  openPanicModal() {
    this.panicModal.style.display = 'flex';
  }

  closePanicModal() {
    this.panicModal.style.display = 'none';
  }

  async startRecordPanicKey() {
    this.sound.playClick();
    this.btnRecordPanicKey.classList.add('recording');
    this.recordPanicBtnText.textContent = "Appuyez sur une touche...";

    try {
      const key = await this.api.record_hotkey();
      if (key) {
        await this.api.set_panic_hotkey(key);
        this.panicHotkey = key;
        this.currentPanicDisplay.textContent = key.toUpperCase();
        this.panicKeyBadge.textContent = `TOUCHE [${key.toUpperCase()}]`;
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.btnRecordPanicKey.classList.remove('recording');
      this.recordPanicBtnText.textContent = "Modifier la touche";
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new NSMApp();
});
