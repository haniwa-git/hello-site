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

function textNode(t) {
  return document.createTextNode(t ?? "");
}

function renderRuby(rubyObj) {
  // <ruby>base<rt>rt</rt></ruby>
  const r = document.createElement("ruby");
  r.appendChild(textNode(rubyObj.base ?? ""));
  const rt = document.createElement("rt");
  rt.appendChild(textNode(rubyObj.rt ?? ""));
  r.appendChild(rt);
  return r;
}

function renderInlineParts(parent, parts, tokenToClass) {
  for (const p of parts) {
    // plain text
    if (typeof p === "string") {
      parent.appendChild(textNode(p));
      continue;
    }

    if (p.t) {
      parent.appendChild(textNode(p.t));
      continue;
    }

    // ruby
    if (p.ruby) {
      parent.appendChild(renderRuby(p.ruby));
      continue;
    }

    // token (colored/marked word)
    if (p.token) {
      const span = el("span", { "data-token": p.token }, []);
      const cls = tokenToClass.get(p.token);
      if (cls) span.classList.add(cls);

      if (p.ruby) span.appendChild(renderRuby(p.ruby));
      else span.appendChild(textNode(p.t ?? ""));

      parent.appendChild(span);
      continue;
    }

    // blank (穴埋め)
    if (p.blank) {
      const label = el("label", { class: "fill-label" }, []);
      const input = el("input", { type: "checkbox" }, []);
      const placeholder = el("span", { class: "fill-placeholder" }, []);

      // 答え
      const ansOuter = el("span", { class: "fill-answer" }, []);
      const ansInner = el("span", {}, []);
      if (p.blank.answerWrapClass) ansInner.classList.add(p.blank.answerWrapClass);

      // answer parts（rubyもOK）
      renderInlineParts(ansInner, p.blank.answer ?? [], tokenToClass);

      ansOuter.appendChild(ansInner);

      // token付け（後からstylesで色変え可能）
      if (p.blank.id) {
        ansInner.setAttribute("data-token", p.blank.id);
        const cls = tokenToClass.get(p.blank.id);
        if (cls) ansInner.classList.add(cls);
      }

      label.appendChild(input);
      label.appendChild(placeholder);
      label.appendChild(ansOuter);
      parent.appendChild(label);
      continue;
    }
  }
}

function buildTokenToClass(styles) {
  const map = new Map();
  for (const [cls, tokens] of Object.entries(styles ?? {})) {
    for (const tk of tokens ?? []) map.set(tk, cls);
  }
  return map;
}

function renderNav(app, nav) {
  const box = el("div", { class: "jump-nav box2" }, []);
  box.appendChild(textNode("▶ "));
  const frag = document.createDocumentFragment();
  for (let i = 0; i < nav.length; i++) {
    const n = nav[i];
    const a = el("a", { href: n.href }, [textNode(n.label)]);
    frag.appendChild(a);
    if (i !== nav.length - 1) frag.appendChild(el("br", {}, []));
  }
  box.appendChild(frag);
  app.appendChild(box);
}

function renderSection(app, section, tokenToClass) {
  const sec = document.createElement("section");

  const h2 = el("h2", { id: section.id }, [textNode(section.h2)]);
  sec.appendChild(h2);

  for (const g of section.groups ?? []) {
    if (g.h3) sec.appendChild(el("h3", {}, [textNode(g.h3)]));

    const ul = el("ul", { class: g.ulClass ?? "" }, []);
    for (const item of g.items ?? []) {
      const li = el("li", { class: item.liClass ?? "" }, []);

      // year
      if (item.year) {
        const strong = el("strong", {}, [textNode(item.year + "：")]);
        li.appendChild(strong);
      }

      // term (blue etc)
      if (item.term?.length) {
        const termWrap = document.createDocumentFragment();
        // 例：<span class="blue-bold">...</span>
        // tokenがあれば classを自動付与する
        const span = el("span", {}, []);
        renderInlineParts(span, item.term, tokenToClass);
        termWrap.appendChild(span);
        li.appendChild(termWrap);
      }

      // parts
      if (item.parts?.length) {
        renderInlineParts(li, item.parts, tokenToClass);
      }

      ul.appendChild(li);
    }

    sec.appendChild(ul);
  }

  app.appendChild(sec);
}

async function main() {
  const app = document.getElementById("app");
  app.textContent = "読み込み中…";

  const res = await fetch("./bakumatsu.json", { cache: "no-store" });
  const data = await res.json();

  const tokenToClass = buildTokenToClass(data.styles);

  app.textContent = "";
  renderNav(app, data.page?.nav ?? []);

  for (const section of data.sections ?? []) {
    renderSection(app, section, tokenToClass);
  }

  // 下のナビ（任意：上と同じのをもう一回）
  renderNav(app, data.page?.nav ?? []);

  // 次リンク（任意：ここは好きに）
  const p = el("p", {}, []);
  p.appendChild(el("a", { href: "#" }, [textNode("→【次】（ここにリンク）")]));
  app.appendChild(p);
}

main().catch((e) => {
  const app = document.getElementById("app");
  app.textContent = "エラー: " + (e?.message ?? e);
  console.error(e);
});

document.querySelectorAll(".fill-placeholder").forEach(el => {
  el.addEventListener("click", () => {
    el.closest(".fill-label").classList.add("show-answer");
  });
});
document.querySelectorAll(".blank-box").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const wrap = btn.closest(".blank");
    wrap.classList.add("show");
    btn.disabled = true;               // 2回目以降押せないように（任意）
    btn.style.cursor = "default";
  });
});
