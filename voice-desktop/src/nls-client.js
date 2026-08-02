const crypto = require("crypto");
const WS = require("ws");

function uuid() {
  return crypto.randomUUID();
}

function randomId() {
  return crypto.randomBytes(16).toString("hex");
}

class NlsClient {
  constructor({ token, appkey }) {
    if (!token) throw new Error("missing token");
    if (!appkey) throw new Error("missing appkey");
    this.token = token;
    this.appkey = appkey;
    this.ws = null;
    this.taskId = null;
    this.started = false;
    this.finished = false;
    this.handlers = { raw: null, started: null, result: null, partial: null, error: null, completed: null };
  }

  on(event, fn) {
    if (event in this.handlers) this.handlers[event] = fn;
  }

  start({ sampleRate }) {
    return new Promise((resolve, reject) => {
      this.taskId = randomId();
      this.finished = false;
      const url = `wss://nls-gateway.cn-shanghai.aliyuncs.com/ws/v1?token=${encodeURIComponent(this.token)}`;
      const ws = new WS(url);
      this.ws = ws;
      this._resolveStart = resolve;
      this._rejectStart = reject;

      ws.on("open", () => {
        const msg = {
          header: {
            message_id: randomId(),
            task_id: this.taskId,
            namespace: "SpeechTranscriber",
            name: "StartTranscription",
            appkey: this.appkey
          },
          payload: {
            format: "pcm",
            sample_rate: sampleRate || 16000,
            enable_intermediate_result: true,
            enable_punctuation_prediction: true,
            enable_inverse_text_normalization: true,
            enable_semantic_sentence_detection: false
          }
        };
        ws.send(JSON.stringify(msg));
      });

      ws.on("message", (data) => {
        let parsed;
        try {
          parsed = JSON.parse(data.toString());
        } catch (e) {
          return;
        }
        this.handleMessage(parsed);
      });

      ws.on("error", (err) => {
        if (this._rejectStart) { this._rejectStart(new Error("WebSocket 连接失败: " + (err && err.message))); this._rejectStart = null; }
        if (this.handlers.error) this.handlers.error(new Error("WebSocket 连接失败: " + (err && err.message)));
      });

      ws.on("close", () => {
        this.started = false;
      });
    });
  }

  handleMessage(data) {
    const header = data.header || {};
    const name = header.name;
    const status = header.status;

    if (this.handlers.raw) this.handlers.raw(data);
    if (name === "TranscriptionStarted") {
      this.started = true;
      if (this._resolveStart) { this._resolveStart(); this._resolveStart = null; }
      if (this.handlers.started) this.handlers.started();
      return;
    }
    if (name === "TaskFailed") {
      if (this._rejectStart) { this._rejectStart(new Error(header.status_message || `错误码 ${status}`)); this._rejectStart = null; }
      if (this.handlers.error) {
        this.handlers.error(new Error(header.status_message || `错误码 ${status}`));
      }
      return;
    }
    if (name === "SentenceBegin") {
      return;
    }
    if (name === "TranscriptionResultChanged") {
      const payload = data.payload || {};
      if (this.handlers.partial && payload.result) this.handlers.partial(payload.result);
      return;
    }
    if (name === "SentenceEnd") {
      const payload = data.payload || {};
      if (this.handlers.result && payload.result) this.handlers.result(payload.result);
      return;
    }
    if (name === "TranscriptionCompleted") {
      this.finished = true;
      if (this.handlers.completed) this.handlers.completed();
      return;
    }
    if (status && status !== 20000000) {
      if (this.handlers.error) {
        this.handlers.error(new Error(header.status_message || `错误码 ${status}`));
      }
    }
  }

  sendPcm(int16Buffer) {
    if (!this.ws || this.ws.readyState !== WS.OPEN) return;
    this.ws.send(int16Buffer);
  }

  stop() {
    if (!this.ws || this.ws.readyState !== WS.OPEN) return;
    this.ws.send(
      JSON.stringify({
        header: {
          message_id: randomId(),
          task_id: this.taskId,
          namespace: "SpeechTranscriber",
          name: "StopTranscription",
          appkey: this.appkey
        }
      })
    );
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.ws = null;
    this.started = false;
  }
}

module.exports = NlsClient;
