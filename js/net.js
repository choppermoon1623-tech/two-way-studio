// ============================================================
// net.js — 通信層
//   Firebase設定があれば → 本物のネットワーク通信(クラス全員)
//   なければ            → 練習モード(端末内のみ+れんしゅうボット)
// ============================================================
"use strict";

const Net = (() => {

  // ---- 設定チェック ----
  const cfg = window.FIREBASE_CONFIG || {};
  const configured =
    typeof cfg.apiKey === "string" &&
    cfg.apiKey.length > 10 &&
    !/ここに/.test(cfg.apiKey) &&
    typeof cfg.databaseURL === "string" &&
    /^https:\/\//.test(cfg.databaseURL);

  const mode = configured ? "firebase" : "practice";

  // ---- 内部状態 ----
  const clientId = "c" + Math.random().toString(36).slice(2, 10);
  let joined = false;
  let room = "";
  let myName = "";
  const msgHandlers = [];     // (msg) => void   msg: {name, text, self, test}
  const statusHandlers = [];  // (joined) => void

  let fbApp = null, fbDb = null, fbQuery = null, fbCallback = null;
  let bc = null;              // BroadcastChannel(練習モード)

  // ---- ユーティリティ ----
  const sanitizeRoom = (r) => (r || "").replace(/[^0-9a-zA-Z\-_ぁ-んァ-ヶ一-龠]/g, "").slice(0, 12);
  const sanitizeName = (n) => (n || "").trim().slice(0, 10);
  const sanitizeText = (t) => String(t == null ? "" : t).slice(0, 100);

  function dispatch(msg) {
    msgHandlers.forEach((h) => { try { h(msg); } catch (e) { console.error(e); } });
  }
  function setJoined(v) {
    joined = v;
    statusHandlers.forEach((h) => { try { h(joined); } catch (e) { console.error(e); } });
  }

  // ---- Firebase 読み込み(必要時のみ) ----
  let fbLoading = null;
  function loadScript(src) {
    return new Promise((ok, ng) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => ng(new Error("読み込み失敗: " + src));
      document.head.appendChild(s);
    });
  }
  function loadFirebase() {
    if (window.firebase && window.firebase.database) return Promise.resolve();
    if (!fbLoading) {
      const v = "10.14.1";
      fbLoading = loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`)
        .then(() => loadScript(`https://www.gstatic.com/firebasejs/${v}/firebase-database-compat.js`));
    }
    return fbLoading;
  }
  async function getDb() {
    await loadFirebase();
    if (!fbApp) {
      fbApp = firebase.initializeApp(cfg);
      fbDb = firebase.database();
    }
    return fbDb;
  }

  // ---- れんしゅうボット(練習モード専用) ----
  const OMIKUJI = ["大吉", "中吉", "小吉", "吉", "凶"];
  const HANDS = ["グー", "チョキ", "パー"];
  function botReply(text) {
    if (/こんにちは|こんにちわ/.test(text)) return "こんにちは!ぼくは れんしゅうボット だよ。";
    if (/おはよう/.test(text)) return "おはよう!今日もがんばろう。";
    if (/じゃんけん/.test(text)) return "じゃんけん…" + HANDS[Math.floor(Math.random() * 3)] + "!";
    if (/おみくじ/.test(text)) return "今日の運勢は…【" + OMIKUJI[Math.floor(Math.random() * OMIKUJI.length)] + "】!";
    if (/ありがとう/.test(text)) return "どういたしまして!";
    if (/\?|？/.test(text)) return "いい質問だね!";
    return null; // 反応しない
  }
  let botTimer = null;
  function maybeBotReply(text) {
    const reply = botReply(text);
    if (reply == null) return;
    clearTimeout(botTimer);
    botTimer = setTimeout(() => {
      if (!joined) return;
      dispatch({ name: "れんしゅうボット", text: reply, self: false, test: false });
    }, 900);
  }

  // ---- 参加/退出 ----
  async function join(roomIn, nameIn) {
    const r = sanitizeRoom(roomIn);
    const n = sanitizeName(nameIn);
    if (!r) throw new Error("部屋コードを入力してね");
    if (!n) throw new Error("なまえを入力してね");
    await leave();
    room = r;
    myName = n;

    if (mode === "firebase") {
      const db = await getDb();
      // サーバー時刻とのズレを取得し、「接続した後」のメッセージだけ受信する
      const offsetSnap = await db.ref(".info/serverTimeOffset").once("value");
      const offset = offsetSnap.val() || 0;
      const since = Date.now() + offset - 1500;
      fbQuery = db.ref("rooms/" + room + "/messages").orderByChild("t").startAt(since);
      fbCallback = fbQuery.on("child_added", (snap) => {
        const v = snap.val() || {};
        dispatch({
          name: sanitizeName(v.n) || "?",
          text: sanitizeText(v.x),
          self: v.c === clientId,
          test: false,
        });
      });
    } else {
      bc = new BroadcastChannel("tws-room-" + room);
      bc.onmessage = (ev) => {
        const v = ev.data || {};
        dispatch({ name: sanitizeName(v.n) || "?", text: sanitizeText(v.x), self: false, test: false });
      };
    }
    setJoined(true);
  }

  async function leave() {
    if (fbQuery) { fbQuery.off("child_added", fbCallback); fbQuery = null; fbCallback = null; }
    if (bc) { bc.close(); bc = null; }
    if (joined) setJoined(false);
  }

  // ---- 送信 ----
  async function send(text) {
    const t = sanitizeText(text);
    if (!joined) throw new Error("まだ接続していないよ(上の「せつぞく」ボタン)");
    if (!t) return;

    if (mode === "firebase") {
      await fbDb.ref("rooms/" + room + "/messages").push({
        n: myName, x: t, c: clientId,
        t: firebase.database.ServerValue.TIMESTAMP,
      });
      // 自分のメッセージは child_added で self:true として戻ってくる
    } else {
      if (bc) bc.postMessage({ n: myName, x: t });
      dispatch({ name: myName, text: t, self: true, test: false });
      maybeBotReply(t);
    }
  }

  // ---- 受信テスト(ネットワークには流れない) ----
  function injectTest(text) {
    const t = sanitizeText(text);
    if (!t) return;
    dispatch({ name: "テストくん", text: t, self: false, test: true });
  }

  // ---- 先生用: 部屋モニター ----
  // cb(msg) を呼び続ける。戻り値は解除関数。
  async function watchRoom(roomIn, cb) {
    const r = sanitizeRoom(roomIn);
    if (!r) throw new Error("部屋コードを入力してください");

    if (mode === "firebase") {
      const db = await getDb();
      const q = db.ref("rooms/" + r + "/messages").orderByChild("t").limitToLast(100);
      const fn = q.on("child_added", (snap) => {
        const v = snap.val() || {};
        cb({ name: sanitizeName(v.n) || "?", text: sanitizeText(v.x), time: v.t || 0 });
      });
      return () => q.off("child_added", fn);
    } else {
      const ch = new BroadcastChannel("tws-room-" + r);
      ch.onmessage = (ev) => {
        const v = ev.data || {};
        cb({ name: sanitizeName(v.n) || "?", text: sanitizeText(v.x), time: Date.now() });
      };
      return () => ch.close();
    }
  }

  // ---- 先生用: 部屋のメッセージ全消去 ----
  async function clearRoom(roomIn) {
    const r = sanitizeRoom(roomIn);
    if (!r) throw new Error("部屋コードを入力してください");
    if (mode !== "firebase") throw new Error("練習モードでは消去する保存データがありません");
    const db = await getDb();
    await db.ref("rooms/" + r).remove();
  }

  return {
    mode, clientId,
    get joined() { return joined; },
    get room() { return room; },
    get myName() { return myName; },
    join, leave, send, injectTest,
    watchRoom, clearRoom,
    onMessage: (h) => msgHandlers.push(h),
    onStatus: (h) => statusHandlers.push(h),
  };
})();
