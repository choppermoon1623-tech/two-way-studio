// ============================================================
// runtime.js — 生徒のプログラムを動かす実行エンジン
//   ブロックから生成された JavaScript を安全に実行する。
//   ・送信しすぎ(無限ループ)の自動停止
//   ・受け取ったメッセージをイベントとしてプログラムに渡す
// ============================================================
"use strict";

const Runtime = (() => {

  let running = false;
  let gen = 0;                 // 実行世代(停止後の残り処理を無効化する)
  let startHandlers = [];
  let messageHandlers = [];
  let lastSender = "";
  let lastText = "";
  let sendTimes = [];          // 送信時刻の記録(送りすぎ検知)
  let queue = Promise.resolve(); // 受信イベントは順番に処理

  // UIへの通知(app.js が設定する)
  const cb = {
    memo: (t) => console.log("[memo]", t),
    warn: (t) => console.warn("[warn]", t),
    state: (r) => {},
  };

  const SEND_LIMIT = 12;       // 10秒あたりの最大送信数
  const SEND_WINDOW = 10000;

  class StoppedError extends Error {}

  function assertRunning(myGen) {
    if (!running || myGen !== gen) throw new StoppedError("stopped");
  }

  // ---------- 生徒プログラムから使える命令(runtime.◯◯) ----------
  function makeApi(myGen) {
    return {
      onStart: (fn) => { if (myGen === gen) startHandlers.push(fn); },
      onMessage: (fn) => { if (myGen === gen) messageHandlers.push(fn); },

      get lastText() { return lastText; },
      get lastSender() { return lastSender; },
      get myName() { return Net.myName || "じぶん"; },

      async send(text) {
        assertRunning(myGen);
        const now = Date.now();
        sendTimes = sendTimes.filter((t) => now - t < SEND_WINDOW);
        if (sendTimes.length >= SEND_LIMIT) {
          stop();
          cb.warn("⚠ 短い時間に送信しすぎたので停止しました。「送り合いの無限ループ」になっていないかな?");
          throw new StoppedError("too many sends");
        }
        sendTimes.push(now);
        await Net.send(text);
        // 連続送信の間かくを少しあけて、動きを見やすくする
        await new Promise((ok) => setTimeout(ok, 200));
        assertRunning(myGen);
      },

      memo(text) {
        if (myGen !== gen) return;
        cb.memo(String(text));
      },

      async wait(sec) {
        assertRunning(myGen);
        const ms = Math.min(30, Math.max(0, Number(sec) || 0)) * 1000;
        await new Promise((ok) => setTimeout(ok, ms));
        assertRunning(myGen);
      },

      pickRandom(s) {
        const items = String(s).split(/[,、]/).map((x) => x.trim()).filter((x) => x);
        if (items.length === 0) return "";
        return items[Math.floor(Math.random() * items.length)];
      },

      jankenHand() {
        return ["グー", "チョキ", "パー"][Math.floor(Math.random() * 3)];
      },

      jankenJudge(a, b) {
        const norm = (h) => {
          h = String(h).trim();
          if (/グー|ぐー|✊/.test(h)) return 0;
          if (/チョキ|ちょき|✌/.test(h)) return 1;
          if (/パー|ぱー|✋/.test(h)) return 2;
          return -1;
        };
        const x = norm(a), y = norm(b);
        if (x < 0 || y < 0) return "はんていできない";
        if (x === y) return "あいこ";
        return (x - y + 3) % 3 === 2 ? "かち" : "まけ";
      },
    };
  }

  function reportError(e) {
    if (e instanceof StoppedError) return; // 停止による中断は正常
    console.error(e);
    stop();
    cb.warn("⚠ プログラムでエラーが起きたので停止しました: " + (e && e.message ? e.message : e));
  }

  // ---------- 実行 ----------
  function run(code) {
    stop();
    gen++;
    const myGen = gen;
    startHandlers = [];
    messageHandlers = [];
    sendTimes = [];
    window.LoopTrap = 200000;

    let program;
    try {
      program = new Function("runtime", '"use strict";\n' + code);
    } catch (e) {
      cb.warn("⚠ プログラムに文法エラーがあります: " + e.message);
      return false;
    }

    running = true;
    cb.state(true);

    try {
      program(makeApi(myGen)); // イベントハンドラの登録
    } catch (e) {
      reportError(e);
      return false;
    }

    // 「実行したとき」を順に動かす
    for (const fn of startHandlers) {
      queue = queue.then(() => (running && myGen === gen) ? fn() : null).catch(reportError);
    }
    return true;
  }

  function stop() {
    if (!running) return;
    running = false;
    gen++;
    cb.state(false);
  }

  // ---------- 受信メッセージをプログラムへ ----------
  function handleIncoming(msg) {
    if (!running) return;
    if (msg.self) return; // 自分が送ったメッセージでは動かない(無限ループ防止)
    const myGen = gen;
    for (const fn of messageHandlers) {
      queue = queue
        .then(() => {
          if (!running || myGen !== gen) return null;
          lastSender = msg.name;
          lastText = msg.text;
          return fn();
        })
        .catch(reportError);
    }
  }

  return {
    run, stop, handleIncoming,
    get running() { return running; },
    callbacks: cb,
  };
})();
