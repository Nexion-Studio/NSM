/**
 * NSM - Nexion Studio Macro Controller v2.0
 * Multi-tab studio navigation, instant debounce toggle, CPS bench, and GitHub auto-updater.
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
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.14, now);
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
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
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
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.linearRampToValueAtTime(180, t + 0.07);
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
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.025);
  }
}

class NSMApp {
  constructor() {
    this.api = null;
    this.sound = new SoundSynthesizer();
    this.macros = [];
    this.activeMacroIds = new Set();
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.panicHotkey = 'f10';
    this.alwaysOnTop = false;
    this.totalActions = 0;
    this.isRecording = false;

    // Updater state
    this.currentVersion = '1.0.0';
    this.pendingUpdate = null;

    // Click tester state
    this.benchClicks = 0;
    this.benchPeakCPS = 0;
    this.benchRecentClicks = [];

    this.initDOM();
    this.initEvents();
    this.initPresetsLibrary();
    this.waitForApi();
  }

  initDOM() {
    // Header & Titlebar
    this.appVersionBadge = document.getElementById('appVersionBadge');
    this.versionLabel = document.getElementById('versionLabel');
    this.btnHeaderUpdate = document.getElementById('btnHeaderUpdate');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.soundIcon = document.getElementById('soundIcon');
    this.btnPinToggle = document.getElementById('btnPinToggle');
    this.pinIcon = document.getElementById('pinIcon');
    this.btnMinimize = document.getElementById('btnMinimize');
    this.btnClose = document.getElementById('btnClose');

    // Navigation
    this.navTabs = document.querySelectorAll('.nav-tab');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.btnPanicKill = document.getElementById('btnPanicKill');
    this.panicKeyBadge = document.getElementById('panicKeyBadge');

    // Dashboard Telemetry
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    this.activeMacrosCount = document.getElementById('activeMacrosCount');
    this.totalActionsCount = document.getElementById('totalActionsCount');
    this.liveCPS = document.getElementById('liveCPS');

    // Filter Pills & Search
    this.filterPills = document.querySelectorAll('.filter-pill');
    this.countAll = document.getElementById('countAll');
    this.countSpam = document.getElementById('countSpam');
    this.countHold = document.getElementById('countHold');
    this.countActive = document.getElementById('countActive');
    this.macroSearchInput = document.getElementById('macroSearchInput');
    this.btnGoToCreator = document.getElementById('btnGoToCreator');
    this.macrosGrid = document.getElementById('macrosGrid');
    this.emptyState = document.getElementById('emptyState');
    this.btnEmptyCreate = document.getElementById('btnEmptyCreate');

    // Creator Form
    this.macroForm = document.getElementById('macroForm');
    this.creatorTitle = document.getElementById('creatorTitle');
    this.creatorModeTag = document.getElementById('creatorModeTag');
    this.macroId = document.getElementById('macroId');
    this.macroName = document.getElementById('macroName');
    this.macroColor = document.getElementById('macroColor');
    this.colorCode = document.getElementById('colorCode');
    this.typeSpamRadio = document.getElementById('typeSpamRadio');
    this.typeHoldRadio = document.getElementById('typeHoldRadio');
    this.targetType = document.getElementById('targetType');
    this.mouseKeyGroup = document.getElementById('mouseKeyGroup');
    this.keyboardKeyGroup = document.getElementById('keyboardKeyGroup');
    this.mouseButtonSelect = document.getElementById('mouseButtonSelect');
    this.keyboardKeyInput = document.getElementById('keyboardKeyInput');

    // Timing Settings (Spam)
    this.spamSettingsGroup = document.getElementById('spamSettingsGroup');
    this.intervalSlider = document.getElementById('intervalSlider');
    this.intervalValueDisplay = document.getElementById('intervalValueDisplay');
    this.cpsPreviewBadge = document.getElementById('cpsPreviewBadge');
    this.jitterSlider = document.getElementById('jitterSlider');
    this.jitterValBadge = document.getElementById('jitterValBadge');
    this.spamModeSelect = document.getElementById('spamModeSelect');
    this.repeatCountGroup = document.getElementById('repeatCountGroup');
    this.repeatCountInput = document.getElementById('repeatCountInput');
    this.timeLimitGroup = document.getElementById('timeLimitGroup');
    this.timeLimitInput = document.getElementById('timeLimitInput');

    // Timing Settings (Hold)
    this.holdSettingsGroup = document.getElementById('holdSettingsGroup');
    this.holdSlider = document.getElementById('holdSlider');
    this.holdValueDisplay = document.getElementById('holdValueDisplay');
    this.holdDurationHint = document.getElementById('holdDurationHint');
    this.releaseDelayMs = document.getElementById('releaseDelayMs');
    this.holdLoopCheckbox = document.getElementById('holdLoopCheckbox');

    // Hotkey Recording in Creator
    this.currentHotkeyDisplay = document.getElementById('currentHotkeyDisplay');
    this.btnRecordHotkey = document.getElementById('btnRecordHotkey');
    this.recordBtnText = document.getElementById('recordBtnText');
    this.macroHotkey = document.getElementById('macroHotkey');
    this.btnCancelCreator = document.getElementById('btnCancelCreator');

    // Presets Container
    this.presetsCardsContainer = document.getElementById('presetsCardsContainer');
    this.btnRestoreAllPresets = document.getElementById('btnRestoreAllPresets');

    // Tester Bench
    this.clickPad = document.getElementById('clickPad');
    this.benchCurrentCPS = document.getElementById('benchCurrentCPS');
    this.benchPeakCPS = document.getElementById('benchPeakCPS');
    this.benchTotalClicks = document.getElementById('benchTotalClicks');
    this.btnResetBench = document.getElementById('btnResetBench');

    // Settings Tab
    this.settingsCurrentVersion = document.getElementById('settingsCurrentVersion');
    this.settingsLatestVersion = document.getElementById('settingsLatestVersion');
    this.updateStatusPill = document.getElementById('updateStatusPill');
    this.updateStatusText = document.getElementById('updateStatusText');
    this.btnCheckUpdatesNow = document.getElementById('btnCheckUpdatesNow');
    this.updateBtnIcon = document.getElementById('updateBtnIcon');
    this.updateBtnText = document.getElementById('updateBtnText');
    this.settingsPanicDisplay = document.getElementById('settingsPanicDisplay');
    this.btnRecordSettingsPanic = document.getElementById('btnRecordSettingsPanic');
    this.recordSettingsPanicText = document.getElementById('recordSettingsPanicText');
    this.settingSoundToggle = document.getElementById('settingSoundToggle');
    this.settingPinToggle = document.getElementById('settingPinToggle');

    // Update Modal
    this.updateModal = document.getElementById('updateModal');
    this.btnCloseUpdateModal = document.getElementById('btnCloseUpdateModal');
    this.btnCancelUpdate = document.getElementById('btnCancelUpdate');
    this.btnStartAutoUpdate = document.getElementById('btnStartAutoUpdate');
    this.updateVersionHeading = document.getElementById('updateVersionHeading');
    this.updateChangelog = document.getElementById('updateChangelog');
    this.downloadProgressContainer = document.getElementById('downloadProgressContainer');
    this.downloadStatusLabel = document.getElementById('downloadStatusLabel');
    this.downloadPercentLabel = document.getElementById('downloadPercentLabel');
    this.downloadProgressFill = document.getElementById('downloadProgressFill');
  }

  initEvents() {
    // Window Buttons
    this.btnSoundToggle.addEventListener('click', () => this.toggleSound());
    this.btnPinToggle.addEventListener('click', () => this.togglePin());
    this.btnMinimize.addEventListener('click', () => this.api && this.api.minimize_window());
    this.btnClose.addEventListener('click', () => this.api && this.api.close_window());

    // Navigation Tabs
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.sound.playClick();
        this.switchTab(tab.dataset.tab);
      });
    });

    // Panic Killswitch Button
    this.btnPanicKill.addEventListener('click', () => {
      this.sound.playPanic();
      if (this.api) this.api.stop_all();
    });

    // Version Badge click = check updates
    this.appVersionBadge.addEventListener('click', () => {
      this.switchTab('tabSettings');
      this.checkUpdates(true);
    });
    this.btnHeaderUpdate.addEventListener('click', () => this.openUpdateModal());

    // Filter Pills
    this.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.sound.playClick();
        this.filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentFilter = pill.dataset.filter;
        this.renderMacros();
      });
    });

    // Search Input
    this.macroSearchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderMacros();
    });

    // Go to Creator
    this.btnGoToCreator.addEventListener('click', () => this.openCreateMode());
    this.btnEmptyCreate.addEventListener('click', () => this.openCreateMode());
    this.btnCancelCreator.addEventListener('click', () => this.switchTab('tabDashboard'));

    // Creator Form Switching
    this.typeSpamRadio.addEventListener('change', () => this.updateFormType());
    this.typeHoldRadio.addEventListener('change', () => this.updateFormType());
    this.targetType.addEventListener('change', () => this.updateTargetType());

    // Color Swatches
    document.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', () => {
        const c = s.dataset.color;
        this.macroColor.value = c;
        this.colorCode.textContent = c;
        this.sound.playClick();
      });
    });
    this.macroColor.addEventListener('input', (e) => {
      this.colorCode.textContent = e.target.value;
    });

    // Quick Keys
    document.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.keyboardKeyInput.value = chip.dataset.k;
        this.sound.playClick();
      });
    });

    // Sliders & Timings
    this.intervalSlider.addEventListener('input', (e) => {
      const ms = e.target.value;
      this.intervalValueDisplay.textContent = `${ms} ms`;
      const cps = (1000 / Math.max(1, ms)).toFixed(1);
      this.cpsPreviewBadge.textContent = cps;
    });

    document.querySelectorAll('.cps-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cps-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const ms = pill.dataset.interval;
        this.intervalSlider.value = ms;
        this.intervalValueDisplay.textContent = `${ms} ms`;
        const cps = (1000 / Math.max(1, ms)).toFixed(1);
        this.cpsPreviewBadge.textContent = cps;
        this.sound.playClick();
      });
    });

    this.jitterSlider.addEventListener('input', (e) => {
      const v = e.target.value;
      this.jitterValBadge.textContent = v == 0 ? '0% (Cadence Régulière)' : `±${v}% (Fluctuation Anti-Bot)`;
    });

    this.spamModeSelect.addEventListener('change', () => {
      const m = this.spamModeSelect.value;
      this.repeatCountGroup.style.display = m === 'repeat_count' ? 'flex' : 'none';
      this.timeLimitGroup.style.display = m === 'time_limit' ? 'flex' : 'none';
    });

    this.holdSlider.addEventListener('input', (e) => {
      const ms = parseInt(e.target.value);
      this.holdValueDisplay.textContent = `${ms} ms`;
      this.holdDurationHint.textContent = `(${(ms / 1000).toFixed(1)} secondes de maintien)`;
    });

    // Creator Hotkey Recording
    this.btnRecordHotkey.addEventListener('click', () => this.startRecordHotkey());

    // Submit Creator Form
    this.macroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMacro();
    });

    // Presets
    this.btnRestoreAllPresets.addEventListener('click', () => this.restoreAllPresets());

    // CPS Click Bench
    this.clickPad.addEventListener('mousedown', () => this.recordBenchClick());
    this.btnResetBench.addEventListener('click', () => this.resetBench());

    // Settings
    this.btnCheckUpdatesNow.addEventListener('click', () => this.checkUpdates(true));
    this.btnRecordSettingsPanic.addEventListener('click', () => this.startRecordPanicKey());
    this.settingSoundToggle.addEventListener('change', () => this.toggleSound());
    this.settingPinToggle.addEventListener('change', () => this.togglePin());

    // Update Modal
    this.btnCloseUpdateModal.addEventListener('click', () => this.closeUpdateModal());
    this.btnCancelUpdate.addEventListener('click', () => this.closeUpdateModal());
    this.btnStartAutoUpdate.addEventListener('click', () => this.executeAutoUpdate());

    // Global Python Event Handlers
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

    window.onUpdateAvailable = (updateInfo) => {
      this.pendingUpdate = updateInfo;
      this.updateStatusPill.className = 'status-pill yellow';
      this.updateStatusPill.textContent = 'Mise à jour prête';
      this.appVersionBadge.classList.add('has-update');
      this.btnHeaderUpdate.style.display = 'inline-flex';
      this.settingsLatestVersion.textContent = `v${updateInfo.latest_version}`;
      this.updateStatusText.textContent = `Une version plus récente (v${updateInfo.latest_version}) est disponible.`;
    };

    window.onUpdateProgress = (percent, downloaded, total) => {
      this.downloadProgressFill.style.width = `${percent}%`;
      this.downloadPercentLabel.textContent = `${percent}%`;
      const mb = (downloaded / (1024 * 1024)).toFixed(1);
      const totalMb = (total / (1024 * 1024)).toFixed(1);
      this.downloadStatusLabel.textContent = `Téléchargement : ${mb} / ${totalMb} Mo`;
    };

    window.onUpdateDownloaded = () => {
      this.downloadStatusLabel.textContent = 'Téléchargement terminé ! Installation et redémarrage...';
    };

    // Live CPS interval ticker
    setInterval(() => this.updateCPS(), 700);
    // Bench CPS ticker
    setInterval(() => this.benchTick(), 200);
  }

  switchTab(tabId) {
    this.navTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    this.tabPanes.forEach(p => p.classList.toggle('active', p.id === tabId));
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
      this.currentVersion = state.version || '1.0.0';
      this.versionLabel.textContent = `v${this.currentVersion}`;
      this.settingsCurrentVersion.textContent = `v${this.currentVersion}`;

      this.macros = state.macros || [];
      this.activeMacroIds = new Set(state.active_macro_ids || []);
      this.panicHotkey = state.panic_hotkey || 'f10';
      this.alwaysOnTop = Boolean(state.always_on_top);
      this.sound.enabled = Boolean(state.sound_enabled);
      this.totalActions = state.total_actions || 0;

      this.soundIcon.textContent = this.sound.enabled ? '🔊' : '🔇';
      this.settingSoundToggle.checked = this.sound.enabled;
      this.pinIcon.style.color = this.alwaysOnTop ? 'var(--neon-cyan)' : 'var(--text-muted)';
      this.settingPinToggle.checked = this.alwaysOnTop;

      this.panicKeyBadge.textContent = this.panicHotkey.toUpperCase();
      this.settingsPanicDisplay.textContent = this.panicHotkey.toUpperCase();

      this.updateTelemetry();
      this.renderMacros();

      // Check for updates
      this.checkUpdates(false);
    } catch (e) {
      console.error("Failed to load initial state:", e);
    }
  }

  async checkUpdates(manual = false) {
    if (manual) {
      this.updateBtnIcon.style.animation = 'spin 1s linear infinite';
      this.updateBtnText.textContent = 'Recherche en cours...';
      this.sound.playClick();
    }

    try {
      if (!this.api) return;
      const res = await this.api.check_updates();
      if (res && res.update_available) {
        this.pendingUpdate = res;
        this.updateStatusPill.className = 'status-pill yellow';
        this.updateStatusPill.textContent = 'Mise à jour prête';
        this.appVersionBadge.classList.add('has-update');
        this.btnHeaderUpdate.style.display = 'inline-flex';
        this.settingsLatestVersion.textContent = `v${res.latest_version}`;
        this.updateStatusText.textContent = `Une version plus récente (v${res.latest_version}) est disponible.`;
        if (manual) {
          this.openUpdateModal();
        }
      } else {
        this.updateStatusPill.className = 'status-pill green';
        this.updateStatusPill.textContent = 'À jour';
        this.appVersionBadge.classList.remove('has-update');
        this.btnHeaderUpdate.style.display = 'none';
        this.settingsLatestVersion.textContent = `v${this.currentVersion}`;
        this.updateStatusText.textContent = `Vous disposez déjà de la version officielle la plus récente (v${this.currentVersion}).`;
        if (manual) {
          alert(`Félicitations ! Vous disposez déjà de la dernière version officielle de NSM (v${this.currentVersion}).`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (manual) {
        this.updateBtnIcon.style.animation = '';
        this.updateBtnText.textContent = 'Vérifier les mises à jour maintenant';
      }
    }
  }

  openUpdateModal() {
    if (!this.pendingUpdate) return;
    this.updateVersionHeading.textContent = `NSM v${this.pendingUpdate.latest_version} est disponible`;
    this.updateChangelog.textContent = this.pendingUpdate.release_notes || "Améliorations des performances et corrections de bugs.";
    this.downloadProgressContainer.style.display = 'none';
    this.btnStartAutoUpdate.style.display = 'inline-flex';
    this.updateModal.style.display = 'flex';
  }

  closeUpdateModal() {
    this.updateModal.style.display = 'none';
  }

  async executeAutoUpdate() {
    if (!this.pendingUpdate || !this.pendingUpdate.download_url) return;
    this.btnStartAutoUpdate.style.display = 'none';
    this.downloadProgressContainer.style.display = 'flex';
    this.downloadProgressFill.style.width = '0%';
    this.downloadPercentLabel.textContent = '0%';
    this.downloadStatusLabel.textContent = 'Démarrage du téléchargement...';

    if (this.api) {
      await this.api.start_auto_update(this.pendingUpdate.download_url);
    }
  }

  async toggleSound() {
    this.sound.enabled = !this.sound.enabled;
    this.soundIcon.textContent = this.sound.enabled ? '🔊' : '🔇';
    this.settingSoundToggle.checked = this.sound.enabled;
    if (this.api) await this.api.toggle_sound();
  }

  async togglePin() {
    if (this.api) {
      this.alwaysOnTop = await this.api.toggle_always_on_top();
      this.pinIcon.style.color = this.alwaysOnTop ? 'var(--neon-cyan)' : 'var(--text-muted)';
      this.settingPinToggle.checked = this.alwaysOnTop;
    }
  }

  updateTelemetry() {
    const activeCount = this.activeMacroIds.size;
    this.activeMacrosCount.textContent = activeCount;

    if (activeCount > 0) {
      this.statusIndicator.classList.add('active');
      this.statusText.textContent = `${activeCount} ACTIVE(S)`;
      this.statusText.style.color = 'var(--neon-green)';
    } else {
      this.statusIndicator.classList.remove('active');
      this.statusText.textContent = 'PRÊT';
      this.statusText.style.color = 'var(--text-main)';
    }

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
        this.totalActions += Math.round((1000 / interval) * 0.7);
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
      filtered = filtered.filter(m => m.type === 'spam');
    } else if (this.currentFilter === 'hold') {
      filtered = filtered.filter(m => m.type === 'hold');
    } else if (this.currentFilter === 'active') {
      filtered = filtered.filter(m => this.activeMacroIds.has(m.id));
    }

    if (this.searchQuery) {
      filtered = filtered.filter(m => 
        (m.name || '').toLowerCase().includes(this.searchQuery) ||
        (m.hotkey || '').toLowerCase().includes(this.searchQuery)
      );
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
      const badgeText = isSpam ? '⚡ SPAM' : '⏳ MAINTIEN';
      const badgeClass = isSpam ? '' : 'hold';

      let targetLabel = '';
      if (m.target_type === 'mouse') {
        const mouseNames = { left: 'Clic Gauche', right: 'Clic Droit', middle: 'Clic Molette', x1: 'Bouton 4', x2: 'Bouton 5' };
        targetLabel = `🖱️ ${mouseNames[m.target_key] || m.target_key}`;
      } else {
        targetLabel = `⌨️ Touche [${(m.target_key || 'E').toUpperCase()}]`;
      }

      let speedSummary = '';
      if (isSpam) {
        const cps = (1000 / Math.max(1, m.interval_ms || 20)).toFixed(0);
        speedSummary = `${m.interval_ms} ms (${cps} CPS)`;
      } else {
        const s = (m.hold_duration_ms / 1000).toFixed(1);
        speedSummary = `Maintien : ${s}s`;
      }

      card.innerHTML = `
        <div class="macro-card-accent" style="background: ${m.color || 'var(--neon-cyan)'}"></div>
        <div class="card-top-row">
          <div class="card-title-group">
            <div class="card-pills-row">
              <span class="macro-badge ${badgeClass}">${badgeText}</span>
              <span class="keycap trigger">[${(m.hotkey || 'AUCUN').toUpperCase()}]</span>
            </div>
            <h3 class="macro-name">${this.escapeHtml(m.name)}</h3>
          </div>
          <label class="macro-switch" title="Activer / Désactiver">
            <input type="checkbox" ${isActive ? 'checked' : ''} data-action="switch">
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="card-details-box">
          <div class="card-detail-item">
            <span class="card-detail-lbl">CIBLE</span>
            <span class="keycap">${targetLabel}</span>
          </div>
          <div class="card-detail-item">
            <span class="card-detail-lbl">DÉCLENCHEMENT</span>
            <span class="keycap">${m.mode === 'hold_key' ? 'Maintien raccourci' : 'Bascule On/Off'}</span>
          </div>
        </div>

        <div class="card-footer-row">
          <span class="speed-meter-summary">${speedSummary}</span>
          <div class="card-action-btns">
            <button class="card-btn" title="Modifier" data-action="edit">✏️</button>
            <button class="card-btn" title="Dupliquer" data-action="copy">📋</button>
            <button class="card-btn del" title="Supprimer" data-action="del">🗑️</button>
          </div>
        </div>
      `;

      // Switch toggle event
      const sw = card.querySelector('[data-action="switch"]');
      sw.addEventListener('change', (e) => {
        this.sound.playClick();
        if (this.api) {
          this.api.toggle_macro(m.id);
        }
      });

      card.querySelector('[data-action="edit"]').addEventListener('click', () => this.openEditMode(m));
      card.querySelector('[data-action="copy"]').addEventListener('click', () => this.duplicateMacro(m));
      card.querySelector('[data-action="del"]').addEventListener('click', () => this.deleteMacro(m.id));

      this.macrosGrid.appendChild(card);
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    clone.hotkey = '';
    if (this.api) {
      await this.api.save_macro(clone);
      this.macros.push(clone);
      this.updateTelemetry();
      this.renderMacros();
      this.sound.playClick();
    }
  }

  openCreateMode() {
    this.sound.playClick();
    this.creatorTitle.textContent = "Créer une Nouvelle Macro";
    this.creatorModeTag.textContent = "CRÉATION STUDIO";
    this.macroId.value = '';
    this.macroName.value = `Macro #${this.macros.length + 1}`;
    this.macroColor.value = '#00f2fe';
    this.colorCode.textContent = '#00f2fe';

    this.typeSpamRadio.checked = true;
    this.targetType.value = 'mouse';
    this.mouseButtonSelect.value = 'left';
    this.keyboardKeyInput.value = 'e';

    this.intervalSlider.value = 20;
    this.intervalValueDisplay.textContent = '20 ms';
    this.cpsPreviewBadge.textContent = '50.0';
    this.jitterSlider.value = 0;
    this.jitterValBadge.textContent = '0% (Cadence Régulière)';
    this.spamModeSelect.value = 'toggle';

    this.holdSlider.value = 3000;
    this.holdValueDisplay.textContent = '3000 ms';
    this.holdDurationHint.textContent = '(3.0 secondes de maintien)';
    this.releaseDelayMs.value = 50;
    this.holdLoopCheckbox.checked = true;

    this.macroHotkey.value = 'f6';
    this.currentHotkeyDisplay.textContent = 'F6';

    this.updateFormType();
    this.updateTargetType();
    this.switchTab('tabCreator');
  }

  openEditMode(macro) {
    this.sound.playClick();
    this.creatorTitle.textContent = "Modifier la Macro";
    this.creatorModeTag.textContent = "ÉDITION STUDIO";
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

    const interval = macro.interval_ms || 20;
    this.intervalSlider.value = interval;
    this.intervalValueDisplay.textContent = `${interval} ms`;
    this.cpsPreviewBadge.textContent = (1000 / Math.max(1, interval)).toFixed(1);

    this.jitterSlider.value = macro.jitter_percent || 0;
    this.jitterValBadge.textContent = (macro.jitter_percent || 0) == 0 ? '0% (Cadence Régulière)' : `±${macro.jitter_percent}% (Fluctuation Anti-Bot)`;

    this.spamModeSelect.value = macro.mode || 'toggle';
    this.repeatCountInput.value = macro.repeat_count || 100;
    this.timeLimitInput.value = macro.time_limit_sec || 10;

    const holdMs = macro.hold_duration_ms || 3000;
    this.holdSlider.value = holdMs;
    this.holdValueDisplay.textContent = `${holdMs} ms`;
    this.holdDurationHint.textContent = `(${(holdMs / 1000).toFixed(1)} secondes de maintien)`;
    this.releaseDelayMs.value = macro.release_delay_ms || 50;
    this.holdLoopCheckbox.checked = macro.loop !== false;

    this.macroHotkey.value = macro.hotkey || '';
    this.currentHotkeyDisplay.textContent = (macro.hotkey || 'AUCUN').toUpperCase();

    this.updateFormType();
    this.updateTargetType();
    this.switchTab('tabCreator');
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

  async startRecordHotkey() {
    this.sound.playClick();
    this.btnRecordHotkey.classList.add('recording');
    this.recordBtnText.textContent = "Appuyez sur une touche...";

    try {
      if (this.api) {
        const key = await this.api.record_hotkey();
        if (key) {
          this.macroHotkey.value = key;
          this.currentHotkeyDisplay.textContent = key.toUpperCase();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.btnRecordHotkey.classList.remove('recording');
      this.recordBtnText.textContent = "Enregistrer un Raccourci";
    }
  }

  async saveMacro() {
    const isSpam = this.typeSpamRadio.checked;
    const isMouse = this.targetType.value === 'mouse';

    const macroData = {
      id: this.macroId.value || 'macro_' + Date.now(),
      name: this.macroName.value.trim() || 'Macro sans nom',
      color: this.macroColor.value,
      type: isSpam ? 'spam' : 'hold',
      enabled: true,
      hotkey: this.macroHotkey.value.trim().toLowerCase(),
      target_type: this.targetType.value,
      target_key: isMouse ? this.mouseButtonSelect.value : (this.keyboardKeyInput.value.trim().toLowerCase() || 'e')
    };

    if (isSpam) {
      macroData.interval_ms = Math.max(1, parseInt(this.intervalSlider.value) || 20);
      macroData.jitter_percent = parseInt(this.jitterSlider.value) || 0;
      macroData.click_hold_ms = 5;
      macroData.mode = this.spamModeSelect.value;
      macroData.repeat_count = parseInt(this.repeatCountInput.value) || 0;
      macroData.time_limit_sec = parseFloat(this.timeLimitInput.value) || 0;
    } else {
      macroData.hold_duration_ms = Math.max(50, parseInt(this.holdSlider.value) || 3000);
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
      this.switchTab('tabDashboard');
      this.sound.playClick();
    }
  }

  // Presets Library
  initPresetsLibrary() {
    const presets = [
      {
        name: "⚡ Ultra Autoclicker 50 CPS",
        desc: "Clic gauche cadencé à 20ms pour les jeux PvP exigeant un CPS maximal sans aucun temps mort.",
        icon: "⚡",
        details: "Souris Gauche • 20ms • 50 CPS",
        data: {
          name: "⚡ Autoclicker 50 CPS",
          type: "spam",
          target_type: "mouse",
          target_key: "left",
          interval_ms: 20,
          jitter_percent: 0,
          mode: "toggle",
          hotkey: "f6",
          color: "#00f2fe"
        }
      },
      {
        name: "🎯 Rapid Fire Anti-Cheat ~14 CPS",
        desc: "Spam avec fluctuation aléatoire simulant fidèlement la cadence d'un doigt humain.",
        icon: "🎯",
        details: "Souris Gauche • 70ms ±25% Jitter",
        data: {
          name: "🎯 Rapid Fire Anti-Cheat",
          type: "spam",
          target_type: "mouse",
          target_key: "left",
          interval_ms: 70,
          jitter_percent: 25,
          mode: "toggle",
          hotkey: "f7",
          color: "#9d4edd"
        }
      },
      {
        name: "🏃 Maintien Shift Continu (Sprint / Sneak)",
        desc: "Garde la touche Shift constamment enfoncée pour courir ou s'accroupir sans fatigue.",
        icon: "🏃",
        details: "Clavier Shift • Maintien 5s en boucle",
        data: {
          name: "🏃 Maintien Shift Continu",
          type: "hold",
          target_type: "keyboard",
          target_key: "shift",
          hold_duration_ms: 5000,
          release_delay_ms: 50,
          loop: true,
          hotkey: "f8",
          color: "#00f5a0"
        }
      },
      {
        name: "⌨️ Spam Touche E (Loot / Interaction)",
        desc: "Idéal pour ramasser le loot instantanément ou marteler les QTE et portes dans les jeux.",
        icon: "⌨️",
        details: "Clavier E • 30ms",
        data: {
          name: "⌨️ Spam Touche E (Loot)",
          type: "spam",
          target_type: "keyboard",
          target_key: "e",
          interval_ms: 30,
          jitter_percent: 5,
          mode: "toggle",
          hotkey: "f9",
          color: "#f72585"
        }
      },
      {
        name: "🦘 AFK Anti-Kick (Saut 45s)",
        desc: "Saute régulièrement pour éviter d'être expulsé des serveurs lors d'une absence.",
        icon: "🦘",
        details: "Clavier Espace • Toutes les 45s",
        data: {
          name: "🦘 AFK Anti-Kick",
          type: "spam",
          target_type: "keyboard",
          target_key: "space",
          interval_ms: 45000,
          jitter_percent: 10,
          mode: "toggle",
          hotkey: "f4",
          color: "#ffbe0b"
        }
      }
    ];

    this.presetsCardsContainer.innerHTML = '';
    presets.forEach(p => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.innerHTML = `
        <div class="preset-header">
          <span class="preset-icon">${p.icon}</span>
          <span class="preset-name">${p.name}</span>
        </div>
        <p class="preset-desc">${p.desc}</p>
        <span class="preset-details">${p.details}</span>
      `;
      card.addEventListener('click', () => this.injectPreset(p.data));
      this.presetsCardsContainer.appendChild(card);
    });
  }

  async injectPreset(data) {
    this.sound.playClick();
    const newMacro = {
      ...data,
      id: 'macro_' + Date.now(),
      enabled: true
    };
    if (this.api) {
      await this.api.save_macro(newMacro);
      this.macros.push(newMacro);
      this.updateTelemetry();
      this.renderMacros();
      this.switchTab('tabDashboard');
    }
  }

  async restoreAllPresets() {
    if (!confirm("Voulez-vous réinitialiser toutes vos macros avec les modèles par défaut de Nexion Studio ?")) return;
    this.sound.playClick();
    if (this.api) {
      const res = await this.api.reset_default_presets();
      if (res && res.macros) {
        this.macros = res.macros;
        this.activeMacroIds.clear();
        this.updateTelemetry();
        this.renderMacros();
        this.switchTab('tabDashboard');
      }
    }
  }

  // CPS Click Bench
  recordBenchClick() {
    this.benchClicks++;
    this.benchRecentClicks.push(Date.now());
    this.sound.playClick();

    // Trigger visual pulse
    this.clickPad.style.transform = 'scale(0.98)';
    setTimeout(() => { this.clickPad.style.transform = ''; }, 60);
  }

  benchTick() {
    const now = Date.now();
    this.benchRecentClicks = this.benchRecentClicks.filter(t => now - t <= 1000);
    const cps = this.benchRecentClicks.length;
    this.benchCurrentCPS.textContent = cps.toFixed(1);
    this.benchTotalClicks.textContent = this.benchClicks;

    if (cps > this.benchPeakCPS) {
      this.benchPeakCPS = cps;
      this.benchPeakCPS.textContent = this.benchPeakCPS.toFixed(1);
    }
  }

  resetBench() {
    this.benchClicks = 0;
    this.benchPeakCPS = 0;
    this.benchRecentClicks = [];
    this.benchCurrentCPS.textContent = '0.0';
    this.benchPeakCPS.textContent = '0.0';
    this.benchTotalClicks.textContent = '0';
    this.sound.playClick();
  }

  // Panic Hotkey Recording in Settings
  async startRecordPanicKey() {
    this.sound.playClick();
    this.btnRecordSettingsPanic.classList.add('recording');
    this.recordSettingsPanicText.textContent = "Appuyez sur une touche...";

    try {
      if (this.api) {
        const key = await this.api.record_hotkey();
        if (key) {
          await this.api.set_panic_hotkey(key);
          this.panicHotkey = key;
          this.panicKeyBadge.textContent = key.toUpperCase();
          this.settingsPanicDisplay.textContent = key.toUpperCase();
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.btnRecordSettingsPanic.classList.remove('recording');
      this.recordSettingsPanicText.textContent = "Modifier la touche d'arrêt";
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new NSMApp();
});
