// ============================================================
// blocks.js — 双方向プログラミング用のカスタムブロック定義
//   ブロック → JavaScript のコード生成(Blockly)
// ============================================================
"use strict";

(() => {
  const COLOR_EVENT = "#f6a821"; // イベント(きっかけ)
  const COLOR_COMM  = "#4c97ff"; // つうしん
  const COLOR_UTIL  = "#2ec27e"; // べんり

  // ---------- ブロックの見た目の定義 ----------
  Blockly.defineBlocksWithJsonArray([
    // ▶ 実行したとき
    {
      type: "event_start",
      message0: "▶ 実行ボタンがおされたとき %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "DO" },
      ],
      colour: COLOR_EVENT,
      tooltip: "プログラムを実行した最初に1回だけ動くよ",
    },
    // ✉ メッセージを受け取ったとき
    {
      type: "event_message",
      message0: "✉ メッセージを受け取ったとき %1 %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "DO" },
      ],
      colour: COLOR_EVENT,
      tooltip: "ほかの人からメッセージが届くたびに動くよ(自分が送ったものでは動かない)",
    },
    // 受け取った内容
    {
      type: "msg_text",
      message0: "受け取った内容",
      output: "String",
      colour: COLOR_COMM,
      tooltip: "いちばん最近受け取ったメッセージの文章",
    },
    // 送ってきた人の名前
    {
      type: "msg_sender",
      message0: "送ってきた人の名前",
      output: "String",
      colour: COLOR_COMM,
      tooltip: "いちばん最近メッセージを送ってきた人の名前",
    },
    // 自分の名前
    {
      type: "my_name",
      message0: "自分の名前",
      output: "String",
      colour: COLOR_COMM,
      tooltip: "接続するときに入力した自分の名前",
    },
    // メッセージを送信する
    {
      type: "net_send",
      message0: "✉ %1 を送信する",
      args0: [{ type: "input_value", name: "TEXT" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR_COMM,
      tooltip: "同じ部屋のみんなにメッセージを送るよ",
    },
    // 画面にメモ表示(相手には送られない)
    {
      type: "show_memo",
      message0: "📝 %1 を画面にメモ表示(自分だけ)",
      args0: [{ type: "input_value", name: "TEXT" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR_UTIL,
      tooltip: "自分の画面にだけ表示するよ。プログラムの動きの確認に便利",
    },
    // 〜がふくまれている
    {
      type: "text_contains",
      message0: "%1 に %2 がふくまれている",
      args0: [
        { type: "input_value", name: "HAY", check: "String" },
        { type: "input_value", name: "NEEDLE", check: "String" },
      ],
      inputsInline: true,
      output: "Boolean",
      colour: COLOR_UTIL,
      tooltip: "文章の中にことばが入っているか調べるよ(条件に使える)",
    },
    // ランダムに選ぶ
    {
      type: "pick_random_text",
      message0: "%1 からランダムに1つえらぶ",
      args0: [{ type: "input_value", name: "LIST", check: "String" }],
      output: "String",
      colour: COLOR_UTIL,
      tooltip: "「,(カンマ)」で区切ったことばの中から1つえらぶよ。れい: 大吉,中吉,凶",
    },
    // ◯秒待つ
    {
      type: "wait_seconds",
      message0: "⏱ %1 秒まつ",
      args0: [{ type: "input_value", name: "SEC", check: "Number" }],
      previousStatement: null,
      nextStatement: null,
      colour: COLOR_UTIL,
      tooltip: "指定した秒数だけ止まるよ(最大30秒)",
    },
    // じゃんけんの手
    {
      type: "janken_hand",
      message0: "✊ じゃんけんの手をランダムに出す",
      output: "String",
      colour: COLOR_UTIL,
      tooltip: "グー・チョキ・パーのどれかになるよ",
    },
    // じゃんけん判定
    {
      type: "janken_judge",
      message0: "自分の手 %1 と 相手の手 %2 のじゃんけん結果",
      args0: [
        { type: "input_value", name: "A", check: "String" },
        { type: "input_value", name: "B", check: "String" },
      ],
      inputsInline: true,
      output: "String",
      colour: COLOR_UTIL,
      tooltip: "「かち」「まけ」「あいこ」のどれかになるよ(自分から見た結果)",
    },
  ]);

  // ---------- JavaScript コード生成 ----------
  const JS = Blockly.JavaScript;               // javascript.javascriptGenerator と同じもの
  const Order = javascript.Order;

  JS.addReservedWords("runtime");

  // くりかえしすぎ(無限ループ)対策
  JS.INFINITE_LOOP_TRAP =
    'if (--window.LoopTrap < 0) throw new Error("くりかえしの回数が多すぎます(無限ループかも?)");\n';

  JS.forBlock["event_start"] = (block, gen) => {
    const body = gen.statementToCode(block, "DO");
    return "runtime.onStart(async () => {\n" + body + "});\n";
  };

  JS.forBlock["event_message"] = (block, gen) => {
    const body = gen.statementToCode(block, "DO");
    return "runtime.onMessage(async () => {\n" + body + "});\n";
  };

  JS.forBlock["msg_text"]   = () => ["runtime.lastText", Order.MEMBER];
  JS.forBlock["msg_sender"] = () => ["runtime.lastSender", Order.MEMBER];
  JS.forBlock["my_name"]    = () => ["runtime.myName", Order.MEMBER];

  JS.forBlock["net_send"] = (block, gen) => {
    const v = gen.valueToCode(block, "TEXT", Order.NONE) || "''";
    return "await runtime.send(" + v + ");\n";
  };

  JS.forBlock["show_memo"] = (block, gen) => {
    const v = gen.valueToCode(block, "TEXT", Order.NONE) || "''";
    return "runtime.memo(" + v + ");\n";
  };

  JS.forBlock["text_contains"] = (block, gen) => {
    const hay = gen.valueToCode(block, "HAY", Order.NONE) || "''";
    const needle = gen.valueToCode(block, "NEEDLE", Order.NONE) || "''";
    return ["String(" + hay + ").includes(String(" + needle + "))", Order.FUNCTION_CALL];
  };

  JS.forBlock["pick_random_text"] = (block, gen) => {
    const list = gen.valueToCode(block, "LIST", Order.NONE) || "''";
    return ["runtime.pickRandom(" + list + ")", Order.FUNCTION_CALL];
  };

  JS.forBlock["wait_seconds"] = (block, gen) => {
    const sec = gen.valueToCode(block, "SEC", Order.NONE) || "1";
    return "await runtime.wait(" + sec + ");\n";
  };

  JS.forBlock["janken_hand"] = () => ["runtime.jankenHand()", Order.FUNCTION_CALL];

  JS.forBlock["janken_judge"] = (block, gen) => {
    const a = gen.valueToCode(block, "A", Order.NONE) || "''";
    const b = gen.valueToCode(block, "B", Order.NONE) || "''";
    return ["runtime.jankenJudge(" + a + ", " + b + ")", Order.FUNCTION_CALL];
  };

  // ---------- ツールボックス(ブロックパレット) ----------
  const shadowText = (t) => ({ shadow: { type: "text", fields: { TEXT: t } } });
  const shadowNum = (n) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

  window.TOOLBOX = {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category", name: "⚡ イベント", colour: COLOR_EVENT,
        contents: [
          { kind: "block", type: "event_start" },
          { kind: "block", type: "event_message" },
        ],
      },
      {
        kind: "category", name: "✉ つうしん", colour: COLOR_COMM,
        contents: [
          { kind: "block", type: "net_send", inputs: { TEXT: shadowText("こんにちは!") } },
          { kind: "block", type: "msg_text" },
          { kind: "block", type: "msg_sender" },
          { kind: "block", type: "my_name" },
        ],
      },
      {
        kind: "category", name: "🔧 べんり", colour: COLOR_UTIL,
        contents: [
          { kind: "block", type: "text_contains",
            inputs: { HAY: { block: { type: "msg_text" } }, NEEDLE: shadowText("こんにちは") } },
          { kind: "block", type: "pick_random_text", inputs: { LIST: shadowText("大吉,中吉,小吉,凶") } },
          { kind: "block", type: "janken_hand" },
          { kind: "block", type: "janken_judge",
            inputs: { A: shadowText("グー"), B: shadowText("パー") } },
          { kind: "block", type: "wait_seconds", inputs: { SEC: shadowNum(1) } },
          { kind: "block", type: "show_memo", inputs: { TEXT: shadowText("ここまで動いた") } },
        ],
      },
      {
        kind: "category", name: "🔀 もし〜なら", categorystyle: "logic_category",
        contents: [
          { kind: "block", type: "controls_if" },
          { kind: "block", type: "logic_compare" },
          { kind: "block", type: "logic_operation" },
          { kind: "block", type: "logic_negate" },
        ],
      },
      {
        kind: "category", name: "🔁 くりかえし", categorystyle: "loop_category",
        contents: [
          { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: shadowNum(3) } },
        ],
      },
      {
        kind: "category", name: "🔢 計算", categorystyle: "math_category",
        contents: [
          { kind: "block", type: "math_number" },
          { kind: "block", type: "math_arithmetic",
            inputs: { A: shadowNum(1), B: shadowNum(1) } },
          { kind: "block", type: "math_random_int",
            inputs: { FROM: shadowNum(1), TO: shadowNum(6) } },
        ],
      },
      {
        kind: "category", name: "🔤 テキスト", categorystyle: "text_category",
        contents: [
          { kind: "block", type: "text" },
          { kind: "block", type: "text_join" },
          { kind: "block", type: "text_length", inputs: { VALUE: shadowText("あいうえお") } },
        ],
      },
      {
        kind: "category", name: "📦 変数", categorystyle: "variable_category", custom: "VARIABLE",
      },
    ],
  };
})();
