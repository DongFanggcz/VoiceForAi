(function () {
  "use strict";

  var dot = document.getElementById("dot");
  var micBtn = document.getElementById("btn-mic");
  var statusEl = document.getElementById("status");
  var output = document.getElementById("output");
  var hint = document.getElementById("hint");
  var autoCopy = document.getElementById("chk-autocopy");
  var topToggle = document.getElementById("chk-top");
  var langSelect = document.getElementById("lang");
  var btnCopy = document.getElementById("btn-copy");
  var btnClear = document.getElementById("btn-clear");
  var btnMin = document.getElementById("btn-min");
  var btnClose = document.getElementById("btn-close");

  var listening = false;
  var modelReady = false;
  var finalText = "";
  var audioContext = null;
  var mediaStream = null;
  var sourceNode = null;
  var processorNode = null;
  var pendingChunks = [];
  var partialText = "";

  var LANG_MAP = {
    "zh-CN": "chinese",
    "zh-TW": "chinese",
    "en-US": "english",
    "ja-JP": "japanese",
    "ko-KR": "korean"
  };

  function loadPrefs() {
    var auto = localStorage.getItem("vi_autocopy");
    if (auto !== null) autoCopy.checked = auto === "1";
    var lang = localStorage.getItem("vi_lang");
    if (lang) langSelect.value = lang;
  }

  function setStatus(text, listening_) {
    statusEl.textContent = text;
    statusEl.classList.toggle("listening", !!listening_);
    micBtn.classList.toggle("listening", !!listening_);
    dot.classList.toggle("listening", !!listening_);
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
    var done = function () {
      hint.textContent = "已复制到剪贴板";
      setTimeout(function () { hint.textContent = ""; }, 1500);
    };
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

  function initModel() {
    setStatus("正在加载 Whisper 模型…");
    window.desktop.loadWhisper("base").then(function () {
      modelReady = true;
      setStatus("模型就绪，点击麦克风开始");
    }).catch(function (e) {
      setStatus("模型加载失败: " + (e && e.message ? e.message : e));
    });
  }

  async function startListening() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });
    } catch (e) {
      setStatus("麦克风权限被拒绝");
      return;
    }
    audioContext = new AudioContext();
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = function (event) {
      var ch = event.inputBuffer.getChannelData(0);
      pendingChunks.push(new Float32Array(ch));
      flushIfLong();
    };
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    listening = true;
    setStatus("正在聆听…", true);
  }

  function stopListening() {
    listening = false;
    if (processorNode) { try { processorNode.disconnect(); } catch (e) {} processorNode = null; }
    if (sourceNode) { try { sourceNode.disconnect(); } catch (e) {} sourceNode = null; }
    if (audioContext) { try { audioContext.close(); } catch (e) {} audioContext = null; }
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) { t.stop(); });
      mediaStream = null;
    }
    flushChunks();
    setStatus("已停止。点击麦克风继续");
  }

  function flushIfLong() {
    var samples = 0;
    for (var i = 0; i < pendingChunks.length; i++) samples += pendingChunks[i].length;
    if (samples >= 16000 * 3) flushChunks();
  }

  function flushChunks() {
    if (!pendingChunks.length) return;
    var samples = 0;
    for (var i = 0; i < pendingChunks.length; i++) samples += pendingChunks[i].length;
    var buf = new Float32Array(samples);
    var off = 0;
    for (var j = 0; j < pendingChunks.length; j++) {
      buf.set(pendingChunks[j], off);
      off += pendingChunks[j].length;
    }
    pendingChunks = [];
    var lang = LANG_MAP[langSelect.value] || "chinese";
    window.desktop.transcribe({ data: buf, sampleRate: 16000, language: lang })
      .then(function (text) {
        if (text) {
          finalText += text;
          partialText = "";
          renderText();
          if (autoCopy.checked) copyText(finalText);
        }
      })
      .catch(function (e) {
        hint.textContent = "识别失败: " + (e && e.message ? e.message : e);
      });
  }

  micBtn.addEventListener("click", function () {
    if (!modelReady) {
      setStatus("模型还未就绪，请稍候");
      return;
    }
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
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

  autoCopy.addEventListener("change", function () {
    localStorage.setItem("vi_autocopy", autoCopy.checked ? "1" : "0");
  });

  langSelect.addEventListener("change", function () {
    localStorage.setItem("vi_lang", langSelect.value);
  });

  topToggle.addEventListener("change", function () {
    window.desktop && window.desktop.toggleTop(topToggle.checked);
  });

  window.addEventListener("beforeunload", function () {
    if (listening) stopListening();
  });

  window.desktop.onWhisperProgress(function () {});
  window.desktop.onWhisperPartial(function (t) {
    partialText = t;
    renderText();
  });

  loadPrefs();
  initModel();
})();
