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
  var engineSelect = document.getElementById("engine");
  var btnCopy = document.getElementById("btn-copy");
  var btnClear = document.getElementById("btn-clear");
  var btnMin = document.getElementById("btn-min");
  var btnClose = document.getElementById("btn-close");

  var listening = false;
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

  function loadPrefs() {
    var auto = localStorage.getItem("vi_autocopy");
    if (auto !== null) autoCopy.checked = auto === "1";
    var lang = localStorage.getItem("vi_lang");
    if (lang) langSelect.value = lang;
    var engine = localStorage.getItem("vi_engine");
    if (engine) engineSelect.value = engine;
  }

  function getEngine() {
    return engineSelect.value;
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
        if (autoCopy.checked) copyText(finalText);
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
          channelCount: 1,
          sampleRate: 16000
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

    audioContext = new AudioContext({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = function (event) {
      var ch = event.inputBuffer.getChannelData(0);
      if (engine === "aliyun") {
        if (!sessionActive) return;
        window.desktop.nlsAudio({ data: ch, sampleRate: 16000 });
      } else {
        if (voskRecognizer) {
          try { voskRecognizer.acceptWaveformFloat(ch, 16000); } catch (e) {}
        }
      }
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
    if (getEngine() === "aliyun" && sessionActive) {
      window.desktop.nlsStop();
      sessionActive = false;
    }
    if (voskRecognizer) {
      try { voskRecognizer.remove(); } catch (e) {}
      voskRecognizer = null;
    }
    if (autoCopy.checked && finalText.trim()) copyText(finalText);
    setStatus("已停止。点击麦克风继续");
  }

  micBtn.addEventListener("click", function () {
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

  engineSelect.addEventListener("change", function () {
    localStorage.setItem("vi_engine", engineSelect.value);
    if (engineSelect.value === "vosk" && !voskReady) {
      initVosk();
    }
  });

  topToggle.addEventListener("change", function () {
    window.desktop && window.desktop.toggleTop(topToggle.checked);
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
      if (autoCopy.checked) copyText(finalText);
    }
  });
  window.desktop.onNlsError(function (m) {
    hint.textContent = "识别错误: " + m;
  });
  window.desktop.onNlsCompleted(function () {
    sessionActive = false;
  });

  loadPrefs();
  if (getEngine() === "vosk") {
    initVosk();
  } else {
    setStatus("就绪，点击麦克风开始");
  }
})();
