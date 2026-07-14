// ============================================================
// app.js — 画面まわりの処理(タブ・接続・チャット・Blockly・ミッション)
// ============================================================
"use strict";

// ---------- 小道具 ----------
const $ = (id) => document.getElementById(id);

let toastTimer = null;
function toast(text, warn = false) {
  const el = $("toast");
  el.textContent = text;
  el.className = "toast" + (warn ? " warn" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

function addMsg(container, { name, text, self = false, test = false, memo = false, sys = false }) {
  const div = document.createElement("div");
  div.className = "msg" + (self ? " self" : "") + (test ? " test" : "") + (memo ? " memo" : "") + (sys ? " sys" : "");
  if (!sys && !memo) {
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = test ? name + "(テスト)" : name;
    div.appendChild(who);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = memo ? "📝 " + text : text;
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  // ふくらみすぎ防止
  while (container.children.length > 200) container.removeChild(container.firstChild);
}

// ---------- タブ切りかえ ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "tab-program" && window.workspace) {
      setTimeout(() => Blockly.svgResize(window.workspace), 50);
    }
  });
});

// ---------- モード表示 ----------
{
  const badge = $("mode-badge");
  if (Net.mode === "firebase") {
    badge.textContent = "🌐 ネットワークモード";
    $("setup-status").textContent = "✅ Firebase設定済み。クラス全員での本物の通信ができます。";
  } else {
    badge.textContent = "🏝 練習モード(通信なし)";
    badge.classList.add("practice");
    $("setup-status").textContent =
      "⚠ 練習モードで動作中(js/firebase-config.js が未設定)。この端末の中だけで「れんしゅうボット」と練習できます。クラスで通信するには docs/teacher-guide.md の手順でFirebaseを設定してください。";
  }
}

// ---------- 接続バー ----------
$("inp-name").value = localStorage.getItem("tws-name") || "";
$("inp-room").value = localStorage.getItem("tws-room") || "";

Net.onStatus((joined) => {
  const st = $("conn-status");
  st.textContent = joined ? Net.room + " に接続中" : "未接続";
  st.className = "conn-status " + (joined ? "on" : "off");
  $("btn-connect").textContent = joined ? "切断" : "せつぞく";
  $("inp-name").disabled = joined;
  $("inp-room").disabled = joined;
  if (!joined) Runtime.stop();
});

$("btn-connect").addEventListener("click", async () => {
  if (Net.joined) {
    await Net.leave();
    toast("切断しました");
    return;
  }
  try {
    $("btn-connect").disabled = true;
    await Net.join($("inp-room").value, $("inp-name").value);
    localStorage.setItem("tws-name", $("inp-name").value);
    localStorage.setItem("tws-room", $("inp-room").value);
    addMsg($("chat-log"), { sys: true, text: "── 部屋「" + Net.room + "」に接続しました ──" });
    addMsg($("phone-log"), { sys: true, text: "── 接続しました ──" });
    toast("部屋「" + Net.room + "」に接続しました");
    if (Net.mode === "practice") {
      addMsg($("chat-log"), { sys: true, text: "練習モード: 「こんにちは」「じゃんけん」「おみくじ」と送るとボットが返事するよ" });
    }
  } catch (e) {
    toast(e.message || String(e), true);
  } finally {
    $("btn-connect").disabled = false;
  }
});

// ---------- メッセージ受信(共通) ----------
Net.onMessage((msg) => {
  if (!msg.test) addMsg($("chat-log"), msg);   // チャット体験画面
  addMsg($("phone-log"), msg);                 // プログラミングのプレビュー
  Runtime.handleIncoming(msg);                 // 生徒のプログラムへ
});

// ---------- チャット体験 送信 ----------
$("chat-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const t = $("chat-input").value.trim();
  if (!t) return;
  try {
    await Net.send(t);
    $("chat-input").value = "";
  } catch (e) {
    toast(e.message, true);
  }
});

// ---------- プレビューの送信フォーム ----------
$("phone-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const t = $("phone-input").value.trim();
  if (!t) return;
  try {
    await Net.send(t);
    $("phone-input").value = "";
  } catch (e) {
    toast(e.message, true);
  }
});

// ---------- 受信テスト ----------
$("test-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const t = $("test-input").value.trim();
  if (!t) return;
  if (!Runtime.running) toast("プログラムが動いていないよ(▶実行を押してから試そう)", true);
  Net.injectTest(t);
  $("test-input").value = "";
});

// ---------- ①しくみ デモアニメ ----------
function flyPacket(id, back = false) {
  const p = $(id);
  p.classList.remove("fly", "fly-back");
  void p.offsetWidth; // アニメをリセット
  p.classList.add(back ? "fly-back" : "fly");
}
$("btn-demo-one").addEventListener("click", () => flyPacket("pk-one"));
$("btn-demo-two").addEventListener("click", async () => {
  const log = $("demo-two-log");
  log.textContent = "";
  flyPacket("pk-a");
  await new Promise((ok) => setTimeout(ok, 1000));
  log.textContent = "サーバーが相手に転送…";
  flyPacket("pk-b");
  await new Promise((ok) => setTimeout(ok, 1200));
  log.textContent = "相手から返事が来た!";
  flyPacket("pk-b", true);
  await new Promise((ok) => setTimeout(ok, 1000));
  flyPacket("pk-a", true);
});

// ---------- Blockly ----------
const workspace = Blockly.inject("blockly-div", {
  toolbox: window.TOOLBOX,
  renderer: "zelos",
  trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.6, minScale: 0.5 },
  move: { scrollbars: true, drag: true, wheel: false },
  grid: { spacing: 24, length: 3, colour: "#dde4ea", snap: true },
});
window.workspace = workspace;

// 自動保存(localStorage)
let saveTimer = null;
workspace.addChangeListener((ev) => {
  if (ev.isUiEvent) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const json = Blockly.serialization.workspaces.save(workspace);
    localStorage.setItem("tws-workspace", JSON.stringify(json));
  }, 600);
});

// 前回の続きを復元
try {
  const saved = localStorage.getItem("tws-workspace");
  if (saved) Blockly.serialization.workspaces.load(JSON.parse(saved), workspace);
} catch (e) {
  console.warn("復元失敗", e);
}

// ---------- 実行・停止 ----------
Runtime.callbacks.memo = (t) => addMsg($("phone-log"), { memo: true, text: t });
Runtime.callbacks.warn = (t) => { toast(t, true); addMsg($("phone-log"), { memo: true, text: t }); };
Runtime.callbacks.state = (running) => {
  $("btn-run").disabled = running;
  $("btn-stop").disabled = !running;
  const st = $("phone-run-state");
  st.textContent = running ? "実行中" : "停止中";
  st.className = "run-state " + (running ? "running" : "stopped");
};

function generateCode() {
  return Blockly.JavaScript.workspaceToCode(workspace);
}

$("btn-run").addEventListener("click", () => {
  if (!Net.joined) {
    toast("先に上の「せつぞく」ボタンで部屋に入ろう", true);
    return;
  }
  const code = generateCode();
  if (!code.trim()) {
    toast("ブロックがまだ置かれていないよ", true);
    return;
  }
  if (Runtime.run(code)) {
    addMsg($("phone-log"), { sys: true, text: "▶ プログラムを実行" });
  }
});

$("btn-stop").addEventListener("click", () => {
  Runtime.stop();
  addMsg($("phone-log"), { sys: true, text: "■ 停止しました" });
});

// ---------- コード表示・改造モード ----------
$("btn-show-code").addEventListener("click", () => {
  const code = generateCode() || "(ブロックがまだありません)";
  $("code-view").textContent = code;
  $("code-edit").value = code;
  $("code-modal").classList.remove("hidden");
});
$("btn-close-code").addEventListener("click", () => $("code-modal").classList.add("hidden"));
$("code-modal").addEventListener("click", (ev) => {
  if (ev.target === $("code-modal")) $("code-modal").classList.add("hidden");
});
$("btn-run-hacked").addEventListener("click", () => {
  if (!Net.joined) {
    toast("先に上の「せつぞく」ボタンで部屋に入ろう", true);
    return;
  }
  window.LoopTrap = 200000;
  if (Runtime.run($("code-edit").value)) {
    $("code-modal").classList.add("hidden");
    addMsg($("phone-log"), { sys: true, text: "▶ 改造コードを実行" });
    toast("改造コードを実行中!");
  }
});

// ---------- 保存 / 読み込み ----------
$("btn-save-file").addEventListener("click", () => {
  const json = Blockly.serialization.workspaces.save(workspace);
  const blob = new Blob([JSON.stringify(json, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  a.download = `program_${d.getMonth() + 1}-${d.getDate()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("ファイルに保存しました");
});
$("btn-load-file").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    Blockly.serialization.workspaces.load(json, workspace);
    toast("読み込みました");
  } catch (e) {
    toast("読み込めませんでした: " + e.message, true);
  }
  ev.target.value = "";
});

// ============================================================
// ミッション
// ============================================================
const MISSIONS = [
  {
    title: "1. あいさつを送ろう",
    tag: "順次処理",
    goal: "実行ボタンを押したら、部屋のみんなに「こんにちは!」とあいさつが送られるようにしよう。",
    hints: [
      "「⚡イベント」の《実行ボタンがおされたとき》を置く",
      "その中に「✉つうしん」の《◯を送信する》を入れる",
      "文字を書きかえて、▶実行!",
    ],
    example: {
      blocks: { languageVersion: 0, blocks: [
        { type: "event_start", x: 30, y: 30, inputs: { DO: { block: {
          type: "net_send", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "こんにちは!" } } } },
        } } } },
      ] },
    },
  },
  {
    title: "2. 自動で返事をしよう",
    tag: "イベント",
    goal: "だれかからメッセージを受け取ったら、自動で「◯◯さん、メッセージありがとう!」と返事するボットを作ろう。",
    hints: [
      "《メッセージを受け取ったとき》のブロックを使う",
      "「🔤テキスト」の《つなげる》で、《送ってきた人の名前》と文字をくっつける",
      "「🧪受信テスト」を使うと、ひとりでも動きを確かめられるよ",
    ],
    example: {
      blocks: { languageVersion: 0, blocks: [
        { type: "event_message", x: 30, y: 30, inputs: { DO: { block: {
          type: "net_send", inputs: { TEXT: { block: {
            type: "text_join",
            extraState: { itemCount: 2 },
            inputs: {
              ADD0: { block: { type: "msg_sender" } },
              ADD1: { shadow: { type: "text", fields: { TEXT: "さん、メッセージありがとう!" } } },
            },
          } } },
        } } } },
      ] },
    },
  },
  {
    title: "3. ことばに反応するボット",
    tag: "条件分岐",
    goal: "「おはよう」ということばが入ったメッセージが来たときだけ、「おはよう!今日もがんばろう!」と返すボットを作ろう。",
    hints: [
      "「🔀もし〜なら」の《もし〜なら》ブロックを使う",
      "条件には「🔧べんり」の《◯に◯がふくまれている》を入れる",
      "調べる文章は《受け取った内容》にする",
    ],
    example: {
      blocks: { languageVersion: 0, blocks: [
        { type: "event_message", x: 30, y: 30, inputs: { DO: { block: {
          type: "controls_if",
          inputs: {
            IF0: { block: {
              type: "text_contains",
              inputs: {
                HAY: { block: { type: "msg_text" } },
                NEEDLE: { shadow: { type: "text", fields: { TEXT: "おはよう" } } },
              },
            } },
            DO0: { block: {
              type: "net_send",
              inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "おはよう!今日もがんばろう!" } } } },
            } },
          },
        } } } },
      ] },
    },
  },
  {
    title: "4. おみくじボット",
    tag: "乱数",
    goal: "「おみくじ」と送られてきたら、「大吉・中吉・小吉・凶」の中からランダムに1つえらんで返すボットを作ろう。",
    hints: [
      "ミッション3のプログラムが土台になるよ",
      "《◯からランダムに1つえらぶ》と《つなげる》を組み合わせる",
      "運勢のことばは「,(カンマ)」で区切って自由に増やせる",
    ],
    example: {
      blocks: { languageVersion: 0, blocks: [
        { type: "event_message", x: 30, y: 30, inputs: { DO: { block: {
          type: "controls_if",
          inputs: {
            IF0: { block: {
              type: "text_contains",
              inputs: {
                HAY: { block: { type: "msg_text" } },
                NEEDLE: { shadow: { type: "text", fields: { TEXT: "おみくじ" } } },
              },
            } },
            DO0: { block: {
              type: "net_send",
              inputs: { TEXT: { block: {
                type: "text_join",
                extraState: { itemCount: 2 },
                inputs: {
                  ADD0: { shadow: { type: "text", fields: { TEXT: "今日の運勢は…" } } },
                  ADD1: { block: {
                    type: "pick_random_text",
                    inputs: { LIST: { shadow: { type: "text", fields: { TEXT: "大吉,中吉,小吉,凶" } } } },
                  } },
                },
              } } },
            } },
          },
        } } } },
      ] },
    },
  },
  {
    title: "5. じゃんけん対戦!",
    tag: "総合・ゲーム",
    goal: "相手が「グー」「チョキ」「パー」のどれかを送ってきたら、自分もランダムに手を出して、勝ち負けを判定して返すゲームを作ろう。ペアの相手と対戦だ!",
    hints: [
      "《じゃんけんの手をランダムに出す》を「📦変数」に覚えさせる(同じ手で判定するため)",
      "《自分の手◯と相手の手◯のじゃんけん結果》の「相手の手」には《受け取った内容》を入れる",
      "できたら、勝敗の回数を数える「スコア」に挑戦してみよう",
    ],
    example: {
      variables: [{ name: "自分の手", id: "varMyHand" }],
      blocks: { languageVersion: 0, blocks: [
        { type: "event_message", x: 30, y: 30, inputs: { DO: { block: {
          type: "controls_if",
          inputs: {
            IF0: { block: {
              type: "text_contains",
              inputs: {
                HAY: { block: { type: "msg_text" } },
                NEEDLE: { shadow: { type: "text", fields: { TEXT: "じゃんけん" } } },
              },
            } },
            DO0: { block: {
              type: "net_send",
              inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "じゃんけんしよう!グー・チョキ・パーを送ってね" } } } },
            } },
          },
          next: { block: {
            type: "controls_if",
            inputs: {
              IF0: { block: {
                type: "logic_operation",
                fields: { OP: "OR" },
                inputs: {
                  A: { block: {
                    type: "text_contains",
                    inputs: {
                      HAY: { block: { type: "msg_text" } },
                      NEEDLE: { shadow: { type: "text", fields: { TEXT: "グー" } } },
                    },
                  } },
                  B: { block: {
                    type: "logic_operation",
                    fields: { OP: "OR" },
                    inputs: {
                      A: { block: {
                        type: "text_contains",
                        inputs: {
                          HAY: { block: { type: "msg_text" } },
                          NEEDLE: { shadow: { type: "text", fields: { TEXT: "チョキ" } } },
                        },
                      } },
                      B: { block: {
                        type: "text_contains",
                        inputs: {
                          HAY: { block: { type: "msg_text" } },
                          NEEDLE: { shadow: { type: "text", fields: { TEXT: "パー" } } },
                        },
                      } },
                    },
                  } },
                },
              } },
              DO0: { block: {
                type: "variables_set",
                fields: { VAR: { id: "varMyHand" } },
                inputs: { VALUE: { block: { type: "janken_hand" } } },
                next: { block: {
                  type: "net_send",
                  inputs: { TEXT: { block: {
                    type: "text_join",
                    extraState: { itemCount: 4 },
                    inputs: {
                      ADD0: { shadow: { type: "text", fields: { TEXT: "ぼくの手は" } } },
                      ADD1: { block: { type: "variables_get", fields: { VAR: { id: "varMyHand" } } } },
                      ADD2: { shadow: { type: "text", fields: { TEXT: "!けっかは…" } } },
                      ADD3: { block: {
                        type: "janken_judge",
                        inputs: {
                          A: { block: { type: "variables_get", fields: { VAR: { id: "varMyHand" } } } },
                          B: { block: { type: "msg_text" } },
                        },
                      } },
                    },
                  } } },
                } },
              } },
            },
          } },
        } } } },
      ] },
    },
  },
];

// ミッション一覧の表示
const missionList = $("mission-list");
MISSIONS.forEach((m, i) => {
  const btn = document.createElement("button");
  btn.className = "mission-item";
  btn.textContent = m.title;
  btn.addEventListener("click", () => showMission(i));
  missionList.appendChild(btn);
});

function showMission(i) {
  const m = MISSIONS[i];
  document.querySelectorAll(".mission-item").forEach((b, j) => b.classList.toggle("active", i === j));
  const el = $("mission-detail");
  el.innerHTML = "";

  const h = document.createElement("h4");
  h.textContent = "🚩 " + m.title + "(" + m.tag + ")";
  el.appendChild(h);

  const goal = document.createElement("div");
  goal.className = "goal";
  goal.textContent = m.goal;
  el.appendChild(goal);

  const det = document.createElement("details");
  const sum = document.createElement("summary");
  sum.textContent = "💡 ヒントを見る";
  det.appendChild(sum);
  const ul = document.createElement("ul");
  m.hints.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ul.appendChild(li);
  });
  det.appendChild(ul);
  el.appendChild(det);

  if (m.example) {
    const det2 = document.createElement("details");
    const sum2 = document.createElement("summary");
    sum2.textContent = "🆘 どうしてもできないとき(見本を読み込む)";
    det2.appendChild(sum2);
    const btn = document.createElement("button");
    btn.className = "btn btn-sm";
    btn.textContent = "見本プログラムを読み込む";
    btn.style.margin = "6px 0";
    btn.addEventListener("click", () => {
      if (workspace.getAllBlocks(false).length > 0 &&
          !confirm("今作っているブロックは消えます。見本を読み込みますか?")) return;
      try {
        Blockly.serialization.workspaces.load(m.example, workspace);
        toast("見本を読み込みました。▶実行で動かしてみよう");
      } catch (e) {
        console.error(e);
        toast("見本の読み込みに失敗しました", true);
      }
    });
    det2.appendChild(btn);
    el.appendChild(det2);
  }
}
showMission(0);

// ============================================================
// ④ 先生用
// ============================================================
let teacherUnwatch = null;
const teacherEntries = [];

$("btn-teacher-watch").addEventListener("click", async () => {
  try {
    if (teacherUnwatch) { teacherUnwatch(); teacherUnwatch = null; }
    $("teacher-log").innerHTML = "";
    teacherEntries.length = 0;
    teacherUnwatch = await Net.watchRoom($("teacher-room").value, (m) => {
      teacherEntries.push(m);
      const time = m.time ? new Date(m.time).toLocaleTimeString("ja-JP") : "";
      addMsg($("teacher-log"), { name: m.name + "  " + time, text: m.text });
    });
    $("btn-teacher-export").disabled = false;
    $("btn-teacher-clear").disabled = Net.mode !== "firebase";
    toast("部屋「" + $("teacher-room").value + "」をモニター中");
  } catch (e) {
    toast(e.message, true);
  }
});

$("btn-teacher-export").addEventListener("click", () => {
  const lines = teacherEntries.map((m) =>
    (m.time ? new Date(m.time).toLocaleString("ja-JP") : "") + "\t" + m.name + "\t" + m.text);
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chat_log_" + ($("teacher-room").value || "room") + ".txt";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("btn-teacher-clear").addEventListener("click", async () => {
  const r = $("teacher-room").value;
  if (!confirm("部屋「" + r + "」のメッセージをすべて消去します。よろしいですか?")) return;
  try {
    await Net.clearRoom(r);
    $("teacher-log").innerHTML = "";
    teacherEntries.length = 0;
    toast("消去しました");
  } catch (e) {
    toast(e.message, true);
  }
});
