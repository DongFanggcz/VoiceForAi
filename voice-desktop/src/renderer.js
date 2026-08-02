(function () {
  "use strict";

  var collapsedEl = document.getElementById("collapsed");
  var cbtn = document.getElementById("cbtn");
  var cbtnIcon = document.getElementById("cbtn-icon");
  var widgetEl = document.getElementById("widget");
  var dot = document.getElementById("dot");
  var micBtn = document.getElementById("btn-mic");
  var statusEl = document.getElementById("status");
  var output = document.getElementById("output");
  var hint = document.getElementById("hint");
  var topToggle = document.getElementById("chk-top");
  var langSelect = document.getElementById("lang");
  var engineSelect = document.getElementById("engine");
  var btnCopy = document.getElementById("btn-copy");
  var btnClear = document.getElementById("btn-clear");
  var btnMin = document.getElementById("btn-min");
  var btnClose = document.getElementById("btn-close");
  var btnSettings = document.getElementById("btn-settings");
  var settingsPanel = document.getElementById("settings");
  var rngOpacity = document.getElementById("rng-opacity");
  var opacityVal = document.getElementById("opacity-val");
  var copiedEl = document.getElementById("copied");
  var micRing = document.getElementById("mic-ring");
  var hotkeyInfo = document.getElementById("hotkey-info");

  var listening = false;
  var expanded = false;
  var finalText = "";
  var partialText = "";
  var audioContext = null;
  var mediaStream = null;
  var sourceNode = null;
  var processorNode = null;
  var sessionActive = false;

  var voskModel = null;
  var voskRecognizer = null;
  var voskReady = false;
  var copiedTimer = null;
  var expandTimer = null;
  var collapseTimer = null;
  var autoStopTimer = null;
  var lastVoiceTime = 0;
  var audioSampleRate = 48000;
  var dragState = null;
  var pressTimer = null;
  var currentHotkey = "";
  var pendingCopy = false;

  function formatHotkey(accel) {
    return (accel || "Ctrl+Shift+V")
      .replace(/CommandOrControl\+/g, "Ctrl+")
      .replace(/\+/g, " + ");
  }

  function loadHotkeyDisplay() {
    window.desktop.getHotkey().then(function (accel) {
      currentHotkey = accel;
      var row = document.getElementById("hotkey-row");
      if (row) row.textContent = formatHotkey(accel);
    });
  }

  function beginHotkeyRecord(row) {
    if (row.dataset.recording === "1") return;
    row.dataset.recording = "1";
    var orig = row.textContent;
    row.textContent = "按下新快捷键…";
    var done = false;

    var finish = function (accel) {
      if (done) return;
      done = true;
      row.dataset.recording = "0";
      document.removeEventListener("keydown", onKey, true);
      if (accel) {
        window.desktop.setHotkey(accel).then(function (ok) {
          if (ok) {
            currentHotkey = accel;
            row.textContent = formatHotkey(accel);
            hint.textContent = "快捷键已更新";
            setTimeout(function () { hint.textContent = ""; }, 1500);
          } else {
            row.textContent = orig;
            hint.textContent = "快捷键被占用或无效";
            setTimeout(function () { hint.textContent = ""; }, 2000);
          }
        });
      } else {
        row.textContent = orig;
      }
    };

    var onKey = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { finish(null); return; }
      var parts = [];
      if (e.ctrlKey) parts.push("CommandOrControl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Super");
      var key = e.key;
      if (key === "Control" || key === "Alt" || key === "Shift" || key === "Meta") return;
      if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
      if (/^[A-Z]$/.test(key)) parts.push(key);
      else if (/^F\d{1,2}$/i.test(key)) parts.push(key.toUpperCase());
      else if (key.length === 1) parts.push(key.toUpperCase());
      else return;
      if (parts.length < 2) { hint.textContent = "需要组合键（如 Alt+C）"; setTimeout(function () { hint.textContent = ""; }, 1500); return; }
      finish(parts.join("+"));
    };
    document.addEventListener("keydown", onKey, true);
  }

  function loadPrefs() {
    var lang = localStorage.getItem("vi_lang");
    if (lang) langSelect.value = lang;
    var engine = localStorage.getItem("vi_engine");
    if (engine) engineSelect.value = engine;
    var top = localStorage.getItem("vi_top");
    if (top !== null) topToggle.checked = top === "1";
    var opacity = localStorage.getItem("vi_opacity");
    if (opacity !== null) {
      rngOpacity.value = opacity;
      opacityVal.textContent = opacity + "%";
      applyOpacity(parseInt(opacity, 10) / 100);
    }
  }

  function getEngine() {
    return engineSelect.value;
  }

  function applyOpacity(alpha) {
    document.documentElement.style.setProperty("--alpha", String(alpha));
  }

  function setStatus(text, listening_) {
    statusEl.textContent = text;
    setListeningVisual(!!listening_);
  }

  function renderText() {
    output.innerHTML = "";
    output.appendChild(document.createTextNode(finalText));
    if (partialText) {
      var span = document.createElement("span");
      span.className = "interim";
      span.textContent = partialText;
      output.appendChild(span);
    }
    output.scrollTop = output.scrollHeight;
  }

  function copyText(text) {
    if (!text) return;
    var done = function () { showCopied(); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function showCopied() {
    copiedEl.classList.add("show");
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(function () {
      copiedEl.classList.remove("show");
    }, 1800);
  }

  function setListeningVisual(on) {
    cbtn.classList.toggle("listening", on);
    micBtn.classList.toggle("listening", on);
    micRing.classList.toggle("ringing", on);
    dot.classList.toggle("listening", on);
    statusEl.classList.toggle("listening", on);
  }

  function expand() {
    if (expanded) return;
    expanded = true;
    collapsedEl.classList.add("hidden");
    widgetEl.classList.remove("hidden");
    window.desktop.expand();
  }

  function collapse() {
    if (!expanded) return;
    if (listening) return;
    expanded = false;
    widgetEl.classList.add("hidden");
    collapsedEl.classList.remove("hidden");
    window.desktop.collapse();
  }

  function initVosk() {
    if (voskReady || !window.Vosk) {
      if (!window.Vosk) setStatus("vosk 库未加载");
      return;
    }
    setStatus("正在加载本地模型（首次解压较慢）…");
    Vosk.createModel("/model.tar.gz", -2)
      .then(function (m) {
        voskModel = m;
        voskReady = true;
        setStatus("本地模型就绪，点击麦克风开始");
      })
      .catch(function (err) {
        setStatus("本地模型加载失败: " + (err && err.message ? err.message : err));
      });
  }

  function voskStartListening() {
    var sampleRate = 16000;
    voskRecognizer = new voskModel.KaldiRecognizer(sampleRate);
    voskRecognizer.setWords(false);

    voskRecognizer.on("result", function (message) {
      var text = (message.result && message.result.text) || "";
      if (text) {
        finalText += text;
        partialText = "";
        renderText();
      }
    });

    voskRecognizer.on("partialresult", function (message) {
      partialText = (message.result && message.result.partial) || "";
      renderText();
    });

    voskRecognizer.on("error", function (message) {
      setStatus("识别错误: " + (message.error || ""));
    });
  }

  async function startListening() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        }
      });
    } catch (e) {
      setStatus("麦克风权限被拒绝");
      return;
    }

    var engine = getEngine();
    if (engine === "aliyun") {
      setStatus("连接语音服务…");
      var startRes = await window.desktop.nlsStart({ sampleRate: 16000 });
      if (!startRes.ok) {
        setStatus("连接失败: " + (startRes.error || ""));
        mediaStream.getTracks().forEach(function (t) { t.stop(); });
        mediaStream = null;
        return;
      }
      sessionActive = true;
    } else {
      if (!voskReady) {
        setStatus("本地模型未就绪，请等待加载");
        mediaStream.getTracks().forEach(function (t) { t.stop(); });
        mediaStream = null;
        return;
      }
      voskStartListening();
    }

    audioContext = new AudioContext();
    audioSampleRate = audioContext.sampleRate;
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = function (event) {
      var ch = event.inputBuffer.getChannelData(0);
      var rms = computeRms(ch);
      if (rms > 0.01) lastVoiceTime = Date.now();
      if (engine === "aliyun") {
        if (!sessionActive) return;
        window.desktop.nlsAudio({ data: ch, sampleRate: audioSampleRate });
      } else {
        if (voskRecognizer) {
          try { voskRecognizer.acceptWaveformFloat(ch, audioSampleRate); } catch (e) {}
        }
      }
    };
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    listening = true;
    lastVoiceTime = Date.now();
    setStatus("正在聆听…", true);
    armAutoStop();
  }

  function computeRms(data) {
    var sum = 0;
    for (var i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / data.length);
  }

  function armAutoStop() {
    if (autoStopTimer) clearInterval(autoStopTimer);
    autoStopTimer = setInterval(function () {
      if (!listening) return;
      if (Date.now() - lastVoiceTime > 4000) {
        clearInterval(autoStopTimer);
        autoStopTimer = null;
        stopListening();
        setStatus("静音超时，已自动停止");
      }
    }, 500);
  }

  function stopListening() {
    listening = false;
    if (autoStopTimer) { clearInterval(autoStopTimer); autoStopTimer = null; }
    if (processorNode) { try { processorNode.disconnect(); } catch (e) {} processorNode = null; }
    if (sourceNode) { try { sourceNode.disconnect(); } catch (e) {} sourceNode = null; }
    if (audioContext) { try { audioContext.close(); } catch (e) {} audioContext = null; }
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) { t.stop(); });
      mediaStream = null;
    }
    if (voskRecognizer) {
      try { voskRecognizer.remove(); } catch (e) {}
      voskRecognizer = null;
    }
    if (getEngine() === "aliyun" && sessionActive) {
      window.desktop.nlsStop();
      sessionActive = false;
      pendingCopy = true;
      setStatus("正在结束识别…");
    } else {
      copyText(finalText);
      setStatus("已停止");
    }
  }

  function toggleListening() {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // 常态按钮：点击只切换识别，不展开；按下可拖动；长按有特效
  cbtn.addEventListener("mousedown", function (e) {
    dragState = { sx: e.screenX, sy: e.screenY, moved: false };
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = setTimeout(function () {
      cbtn.classList.add("pressed");
    }, 300);
  });

  document.addEventListener("mousemove", function (e) {
    if (!dragState) return;
    var dx = e.screenX - dragState.sx;
    var dy = e.screenY - dragState.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
    if (dragState.moved) {
      window.desktop.moveWindow(dx, dy);
      dragState.sx = e.screenX;
      dragState.sy = e.screenY;
    }
  });

  document.addEventListener("mouseup", function () {
    dragState = null;
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    cbtn.classList.remove("pressed");
  });

  cbtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (dragState && dragState.moved) return;
    if (expandTimer) { clearTimeout(expandTimer); expandTimer = null; }
    toggleListening();
  });

  // 悬停 2 秒才展开
  cbtn.addEventListener("mouseenter", function () {
    if (expandTimer) clearTimeout(expandTimer);
    expandTimer = setTimeout(expand, 2000);
  });

  cbtn.addEventListener("mouseleave", function () {
    if (expandTimer) { clearTimeout(expandTimer); expandTimer = null; }
  });

  // 面板鼠标移出后收起
  widgetEl.addEventListener("mouseleave", function () {
    if (collapseTimer) clearTimeout(collapseTimer);
    collapseTimer = setTimeout(collapse, 1200);
  });

  widgetEl.addEventListener("mouseenter", function () {
    if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
  });

  micBtn.addEventListener("click", function () {
    toggleListening();
  });

  btnClose.addEventListener("click", function () {
    window.desktop && window.desktop.close();
  });

  btnMin.addEventListener("click", function () {
    window.desktop && window.desktop.minimize();
  });

  btnClear.addEventListener("click", function () {
    finalText = "";
    partialText = "";
    renderText();
    hint.textContent = "已清空";
    setTimeout(function () { hint.textContent = ""; }, 1200);
  });

  btnCopy.addEventListener("click", function () {
    var text = output.textContent || "";
    if (text.trim()) copyText(text);
  });

  output.addEventListener("input", function () {
    finalText = output.textContent;
  });

  langSelect.addEventListener("change", function () {
    localStorage.setItem("vi_lang", langSelect.value);
  });

  engineSelect.addEventListener("change", function () {
    localStorage.setItem("vi_engine", engineSelect.value);
    if (engineSelect.value === "vosk" && !voskReady) {
      initVosk();
    }
  });

  topToggle.addEventListener("change", function () {
    localStorage.setItem("vi_top", topToggle.checked ? "1" : "0");
    window.desktop && window.desktop.toggleTop(topToggle.checked);
  });

  btnSettings.addEventListener("click", function () {
    settingsPanel.classList.toggle("hidden");
  });

  var hotkeyRow = document.getElementById("hotkey-row");
  if (hotkeyRow) {
    hotkeyRow.addEventListener("click", function () {
      beginHotkeyRecord(hotkeyRow);
    });
  }

  rngOpacity.addEventListener("input", function () {
    var v = parseInt(rngOpacity.value, 10);
    opacityVal.textContent = v + "%";
    applyOpacity(v / 100);
    localStorage.setItem("vi_opacity", String(v));
  });

  window.addEventListener("beforeunload", function () {
    if (listening) stopListening();
  });

  window.desktop.onNlsPartial(function (t) {
    partialText = t;
    renderText();
  });
  window.desktop.onNlsResult(function (t) {
    if (t) {
      finalText += t;
      partialText = "";
      renderText();
    }
  });
  window.desktop.onNlsError(function (m) {
    hint.textContent = "识别错误: " + m;
  });
  window.desktop.onNlsCompleted(function () {
    sessionActive = false;
    if (pendingCopy) {
      pendingCopy = false;
      copyText(finalText);
      setStatus("已停止");
    }
  });

  window.desktop.onHotkey(function () {
    toggleListening();
  });

  loadPrefs();
  loadHotkeyDisplay();
  widgetEl.classList.add("hidden");
  collapsedEl.classList.remove("hidden");
  window.desktop.collapse();
  if (getEngine() === "vosk") {
    initVosk();
  }
})();
