(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    expression: "",
    sciExpression: "",
    answer: 0,
    sciAnswer: 0,
    angle: "DEG",
    history: loadHistory()
  };

  function loadHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem("calc-history") || "[]");
      return Array.isArray(saved) ? saved.slice(0, 100) : [];
    } catch { return []; }
  }

  function saveHistory() {
    try { localStorage.setItem("calc-history", JSON.stringify(state.history.slice(0, 100))); }
    catch { showToast("Could not save history on this device."); }
    renderHistory();
  }

  function cleanNumber(value) {
    if (!Number.isFinite(value)) throw new Error("Math error");
    if (Object.is(value, -0)) value = 0;
    return Number(value.toPrecision(12)).toString();
  }

  function displayNumber(value) {
    if (!Number.isFinite(value)) return "Error";
    if (Math.abs(value) >= 1e12 || (value !== 0 && Math.abs(value) < 1e-7)) {
      return value.toExponential(6).replace(/\.?0+e/, "e");
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 10 }).format(value);
  }

  function tokenize(input) {
    const s = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/π/g, "pi");
    const tokens = [];
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      const rest = s.slice(i);
      const number = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (number) { tokens.push({ type: "number", value: Number(number[0]) }); i += number[0].length; continue; }
      const name = rest.match(/^[a-zA-Z]+/);
      if (name) { tokens.push({ type: "name", value: name[0].toLowerCase() }); i += name[0].length; continue; }
      if ("+-*/^()%!".includes(s[i])) { tokens.push({ type: s[i] === "(" || s[i] === ")" ? s[i] : "op", value: s[i] }); i++; continue; }
      throw new Error("Invalid character");
    }
    return tokens;
  }

  // Small recursive-descent parser: avoids eval() and only supports defined math operations.
  function calculate(input, angleMode, previousAnswer) {
    const tokens = tokenize(input);
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];
    const match = (value) => peek() && peek().value === value && (take(), true);
    const ensure = (n) => { if (!Number.isFinite(n)) throw new Error("Math error"); return n; };
    const factorial = (n) => {
      if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error("Factorial needs a whole number from 0 to 170");
      let out = 1; for (let k = 2; k <= n; k++) out *= k; return out;
    };
    const funcs = {
      sin: x => Math.sin(angleMode === "DEG" ? x * Math.PI / 180 : x),
      cos: x => Math.cos(angleMode === "DEG" ? x * Math.PI / 180 : x),
      tan: x => Math.tan(angleMode === "DEG" ? x * Math.PI / 180 : x),
      sqrt: x => { if (x < 0) throw new Error("Cannot square-root a negative number"); return Math.sqrt(x); },
      log: x => { if (x <= 0) throw new Error("log requires a positive number"); return Math.log10(x); },
      ln: x => { if (x <= 0) throw new Error("ln requires a positive number"); return Math.log(x); },
      abs: x => Math.abs(x),
      floor: x => Math.floor(x),
      ceil: x => Math.ceil(x)
    };

    function primary() {
      if (match("+")) return unary();
      if (match("-")) return -unary();
      const t = peek();
      if (!t) throw new Error("Incomplete expression");
      if (t.type === "number") { take(); return t.value; }
      if (match("(")) { const v = expression(); if (!match(")")) throw new Error("Missing )"); return v; }
      if (t.type === "name") {
        take();
        if (t.value === "pi") return Math.PI;
        if (t.value === "e") return Math.E;
        if (t.value === "ans") return previousAnswer;
        if (funcs[t.value]) {
          if (!match("(")) throw new Error("Use " + t.value + "(...)");
          const arg = expression();
          if (!match(")")) throw new Error("Missing )");
          return ensure(funcs[t.value](arg));
        }
        throw new Error("Unknown function: " + t.value);
      }
      throw new Error("Check your expression");
    }
    function postfix() {
      let value = primary();
      while (match("!")) value = ensure(factorial(value));
      return value;
    }
    function power() {
      let left = postfix();
      if (match("^")) left = ensure(Math.pow(left, unary()));
      return left;
    }
    function unary() { return power(); }
    function term() {
      let value = unary();
      while (peek() && peek().type === "op" && ["*", "/", "%"].includes(peek().value)) {
        const op = take().value; const right = unary();
        if (op === "*") value *= right;
        else if (op === "/") { if (right === 0) throw new Error("Cannot divide by zero"); value /= right; }
        else value %= right;
        ensure(value);
      }
      return value;
    }
    function expression() {
      let value = term();
      while (peek() && peek().type === "op" && ["+", "-"].includes(peek().value)) {
        const op = take().value; const right = term();
        value = op === "+" ? value + right : value - right;
        ensure(value);
      }
      return value;
    }
    if (!tokens.length) throw new Error("Enter a calculation");
    const result = expression();
    if (pos < tokens.length) throw new Error("Check your expression");
    return ensure(result);
  }

  function prettyExpression(s) {
    return s.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
  }

  function renderMain() {
    $("expression").textContent = state.expression ? prettyExpression(state.expression) : "\u00a0";
    $("result").textContent = state.expression ? preview(state.expression, state.answer) : "0";
    $("scientificExpression").textContent = state.sciExpression ? prettyExpression(state.sciExpression) : "\u00a0";
    $("scientificResult").textContent = state.sciExpression ? preview(state.sciExpression, state.sciAnswer) : "0";
  }

  function preview(expression, answer) {
    try { return displayNumber(calculate(expression, state.angle, answer)); }
    catch { return expression ? "…" : "0"; }
  }

  function appendTo(which, value) {
    const key = which === "sci" ? "sciExpression" : "expression";
    let current = state[key];
    if (value === "Ans") value = "Ans";
    if (value === "^2") value = "^2";
    if (value === "÷100") value = "/100";
    if (value === "π") value = "pi";
    if (value === "×") value = "*";
    if (value === "÷") value = "/";
    if (value === "−") value = "-";

    const last = current.slice(-1);
    if (value === ".") {
      const currentNumber = current.split(/[+\-*/()%^]/).pop();
      if (currentNumber.includes(".")) return;
      if (!currentNumber) value = "0.";
    }
    if (["+", "-", "*", "/"].includes(value)) {
      if (!current && value !== "-") return;
      if (["+", "-", "*", "/"].includes(last)) current = current.slice(0, -1);
    }
    if (value === "^2") current += "^2";
    else current += value;
    state[key] = current;
    renderMain();
  }

  function runCalculation(which) {
    const key = which === "sci" ? "sciExpression" : "expression";
    const answerKey = which === "sci" ? "sciAnswer" : "answer";
    const expr = state[key];
    try {
      const result = calculate(expr, state.angle, state[answerKey]);
      state[answerKey] = result;
      state.history.unshift({ expression: prettyExpression(expr), result: cleanNumber(result), time: Date.now() });
      state.history = state.history.slice(0, 100);
      saveHistory();
      state[key] = cleanNumber(result);
      renderMain();
      showToast("Calculated");
    } catch (error) {
      showToast(error.message || "Could not calculate");
    }
  }

  function clearExpression(which) {
    state[which === "sci" ? "sciExpression" : "expression"] = "";
    renderMain();
  }

  function backspace(which) {
    const key = which === "sci" ? "sciExpression" : "expression";
    state[key] = state[key].slice(0, -1);
    renderMain();
  }

  function renderHistory() {
    const list = $("historyList");
    list.innerHTML = "";
    $("historyCount").textContent = state.history.length;
    $("emptyHistory").style.display = state.history.length ? "none" : "block";
    for (const item of state.history) {
      const row = document.createElement("article");
      row.className = "history-item";
      const content = document.createElement("div");
      const expr = document.createElement("div"); expr.className = "history-expression"; expr.textContent = item.expression;
      const result = document.createElement("div"); result.className = "history-result"; result.textContent = "= " + displayNumber(Number(item.result));
      content.append(expr, result);
      const actions = document.createElement("div"); actions.className = "history-actions";
      const use = document.createElement("button"); use.className = "small-action"; use.textContent = "Use"; use.addEventListener("click", () => { state.expression = item.result; switchView("calculator"); renderMain(); });
      const copy = document.createElement("button"); copy.className = "small-action"; copy.textContent = "Copy"; copy.addEventListener("click", () => copyText(item.result));
      actions.append(use, copy); row.append(content, actions); list.append(row);
    }
  }

  function switchView(view) {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === view));
    document.querySelectorAll(".view").forEach(section => section.classList.toggle("active", section.id === view + "View"));
    if (view === "scientific") $("modeLabel").textContent = "BASIC CALCULATOR";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  let toastTimer;
  function showToast(message) {
    const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(String(text));
      else {
        const area = document.createElement("textarea"); area.value = String(text); area.style.position = "fixed"; area.style.opacity = "0";
        document.body.append(area); area.select(); const ok = document.execCommand("copy"); area.remove();
        if (!ok) throw new Error("Copy unavailable");
      }
      showToast("Copied to clipboard");
    } catch { showToast("Copy failed — select the result manually."); }
  }

  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => switchView(tab.dataset.view)));

  $("basicKeypad").addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    const action = button.dataset.action, value = button.dataset.value;
    if (value !== undefined) appendTo("basic", value);
    else if (action === "clear") clearExpression("basic");
    else if (action === "backspace") backspace("basic");
    else if (action === "equals") runCalculation("basic");
    else if (action === "percent") appendTo("basic", "/100");
    else if (action === "sign") {
      if (!state.expression) state.expression = "-";
      else if (/^-?\d*\.?\d+$/.test(state.expression)) state.expression = String(-Number(state.expression));
      else state.expression = "-(" + state.expression + ")";
      renderMain();
    } else if (action === "history") switchView("history");
  });

  $("scientificKeys").addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    const action = button.dataset.sciAction, value = button.dataset.sci;
    if (value !== undefined) appendTo("sci", value);
    else if (action === "clear") clearExpression("sci");
    else if (action === "backspace") backspace("sci");
    else if (action === "equals") runCalculation("sci");
  });

  document.querySelectorAll(".angle-button").forEach(button => button.addEventListener("click", () => {
    state.angle = button.dataset.angle;
    document.querySelectorAll(".angle-button").forEach(b => b.classList.toggle("active", b === button));
    renderMain();
  }));

  $("copyResult").addEventListener("click", () => {
    try { copyText(cleanNumber(calculate(state.expression || "0", state.angle, state.answer))); }
    catch { copyText(state.answer); }
  });
  $("scientificCopy").addEventListener("click", () => {
    try { copyText(cleanNumber(calculate(state.sciExpression || "0", state.angle, state.sciAnswer))); }
    catch { copyText(state.sciAnswer); }
  });
  $("themeButton").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    try { localStorage.setItem("calc-theme", isDark ? "dark" : "light"); } catch {}
    $("themeButton").textContent = isDark ? "☾" : "☼";
  });
  try {
    if (localStorage.getItem("calc-theme") === "dark") { document.body.classList.add("dark"); $("themeButton").textContent = "☾"; }
  } catch {}

  $("clearHistory").addEventListener("click", () => {
    state.history = []; saveHistory(); showToast("History cleared");
  });
  $("backToCalculator").addEventListener("click", () => switchView("calculator"));

  $("discountButton").addEventListener("click", () => {
    const price = Number($("originalPrice").value), rate = Number($("discountRate").value);
    if ($("originalPrice").value === "" || $("discountRate").value === "" || price < 0 || rate < 0 || rate > 100) {
      $("discountResult").textContent = "Enter a valid price and a discount between 0% and 100%."; return;
    }
    const saved = price * rate / 100, finalPrice = price - saved;
    $("discountResult").innerHTML = `You save <strong>${money(saved)}</strong>Final price: <strong>${money(finalPrice)}</strong>`;
  });
  $("gstButton").addEventListener("click", () => {
    const amount = Number($("gstAmount").value), rate = Number($("gstRate").value);
    if ($("gstAmount").value === "" || amount < 0) { $("gstResult").textContent = "Enter a valid amount."; return; }
    const tax = amount * rate / 100;
    $("gstResult").innerHTML = `GST amount <strong>${money(tax)}</strong>Total including GST: <strong>${money(amount + tax)}</strong>`;
  });
  $("emiButton").addEventListener("click", () => {
    const principal = Number($("loanAmount").value), annual = Number($("interestRate").value), years = Number($("loanYears").value);
    if ($("loanAmount").value === "" || $("interestRate").value === "" || $("loanYears").value === "" || principal <= 0 || annual < 0 || years <= 0) {
      $("emiResult").textContent = "Enter a positive loan amount and term, and a non-negative interest rate."; return;
    }
    const months = years * 12, rate = annual / 1200;
    const emi = rate === 0 ? principal / months : principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1);
    $("emiResult").innerHTML = `Estimated monthly EMI <strong>${money(emi)}</strong>Total repayment: <strong>${money(emi * months)}</strong>Interest: <strong>${money(emi * months - principal)}</strong>`;
  });
  function money(value) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value); }

  document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const active = document.activeElement;
    if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;
    const key = event.key;
    if (/^[0-9.]$/.test(key)) { appendTo("basic", key); switchView("calculator"); }
    else if (key === "+") { appendTo("basic", "+"); switchView("calculator"); }
    else if (key === "-") { appendTo("basic", "-"); switchView("calculator"); }
    else if (key === "*") { appendTo("basic", "*"); switchView("calculator"); }
    else if (key === "/") { event.preventDefault(); appendTo("basic", "/"); switchView("calculator"); }
    else if (key === "(" || key === ")") { appendTo("basic", key); switchView("calculator"); }
    else if (key === "Enter" || key === "=") { event.preventDefault(); runCalculation("basic"); switchView("calculator"); }
    else if (key === "Backspace") backspace("basic");
    else if (key === "Escape") clearExpression("basic");
    else if (key === "%") appendTo("basic", "/100");
  });

  renderMain();
  renderHistory();
})();