// --- 基礎関数 ---
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("data-")) node.setAttribute(k, v);
    else node[k] = v;
  }
  for (const c of children) node.appendChild(c);
  return node;
}

function textNode(t) { return document.createTextNode(t ?? ""); }

function renderRuby(rubyObj) {
  const r = document.createElement("ruby");
  r.appendChild(textNode(rubyObj.base ?? ""));
  const rt = document.createElement("rt");
  rt.appendChild(textNode(rubyObj.rt ?? ""));
  r.appendChild(rt);
  return r;
}

function renderInlineParts(parent, parts, tokenToClass) {
  for (const p of parts) {
    if (typeof p === "string") { parent.appendChild(textNode(p)); continue; }
    if (p.t) { parent.appendChild(textNode(p.t)); continue; }
    if (p.ruby) { parent.appendChild(renderRuby(p.ruby)); continue; }
    if (p.token) {
      const span = el("span", {}, []);
      const cls = tokenToClass.get(p.token);
      if (cls) span.classList.add(cls);
      if (p.ruby) span.appendChild(renderRuby(p.ruby));
      else span.appendChild(textNode(p.t ?? ""));
      parent.appendChild(span);
      continue;
    }
    if (p.blank) {
      const blankBox = el("span", { class: "q-blank" }, []);
      const ansOuter = el("span", { class: "q-answer" }, []);
      renderInlineParts(ansOuter, p.blank.answer ?? [], tokenToClass);
      parent.appendChild(blankBox);
      parent.appendChild(ansOuter);
      continue;
    }
  }
}

// チェックがない時のメッセージを表示
function showEmptyMessage() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div style="padding:40px 20px; text-align:center;">
      <p style="font-size:1.1rem; color:#666;">現在、チェックをつけている問題はありません。</p>
      <p><a href="index.html" style="color:#007bff;">一覧ページに戻ってチェックを入れる</a></p>
    </div>`;
}

// 全消去
window.clearAllChecked = function() {
  if (confirm("チェックをすべて消去しますか？")) {
    localStorage.removeItem("checked-questions");
    showEmptyMessage();
  }
};

function renderSection(app, section, tokenToClass) {
  const sec = el("section", { id: section.id }, [el("h2", {}, [textNode(section.h2)])]);
  for (const g of section.groups ?? []) {
    const ul = el("ul", { class: "q-list" }, []);
    for (const item of g.items ?? []) {
      const li = el("li", { class: "q-item" }, []);
      const checkbox = el("input", { type: "checkbox", class: "q-remember-check", checked: true }, []);
      
      checkbox.addEventListener("change", (e) => {
        let ids = JSON.parse(localStorage.getItem("checked-questions") || "[]");
        ids = ids.filter(id => id !== item.id);
        localStorage.setItem("checked-questions", JSON.stringify(ids));
        li.style.opacity = e.target.checked ? "1" : "0.3";
        if (ids.length === 0) showEmptyMessage();
      });

      const card = el("div", { class: "q-card" }, []);
      card.addEventListener("click", () => card.classList.toggle("is-open"));
      const content = el("div", { class: "q-card-content" }, []);
      if (item.year) content.appendChild(el("strong", { class: "q-year" }, [textNode(item.year + "：")]));
      if (item.term) {
        const span = el("span", { class: "q-term" }, []);
        renderInlineParts(span, item.term, tokenToClass);
        content.appendChild(span);
      }
      if (item.parts) renderInlineParts(content, item.parts, tokenToClass);
      card.appendChild(content);
      li.appendChild(el("label", { class: "q-check-label" }, [checkbox]));
      li.appendChild(card);
      ul.appendChild(li);
    }
    sec.appendChild(ul);
  }
  app.appendChild(sec);
}

async function main() {
  const app = document.getElementById("app");
  if (!app) return;

  try {
    const res = await fetch("./bakumatsu.json");
    const data = await res.json();
    const tokenToClass = new Map();
    for (const [cls, tokens] of Object.entries(data.styles ?? {})) {
      tokens.forEach(tk => tokenToClass.set(tk, cls));
    }

    const checkedIds = JSON.parse(localStorage.getItem("checked-questions") || "[]");
    
    // 画面構築
    app.innerHTML = "";
    
    // 上部ボタン
    const nav = el("div", { class: "review-nav", style: "display:flex; gap:10px; padding:10px; border-bottom:1px solid #ddd; margin-bottom:15px;" }, [
      el("button", { onclick: "location.href='index.html'" }, [textNode("一覧に戻る")]),
      el("button", { onclick: "clearAllChecked()", style: "color:red; margin-left:auto;" }, [textNode("全消去")])
    ]);
    app.appendChild(nav);

    if (checkedIds.length === 0) {
      showEmptyMessage();
      return;
    }

    // コンテンツ描画
    const contentArea = el("div", { id: "review-content" }, []);
    app.appendChild(contentArea);

    for (const section of data.sections) {
      const filteredGroups = section.groups.map(g => ({
        ...g,
        items: g.items.filter(item => checkedIds.includes(item.id))
      })).filter(g => g.items.length > 0);

      if (filteredGroups.length > 0) {
        renderSection(contentArea, { ...section, groups: filteredGroups }, tokenToClass);
      }
    }
  } catch (e) {
    app.textContent = "読み込みエラー: " + e.message;
  }
}

main();