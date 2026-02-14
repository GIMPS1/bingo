
(() => {
  const $ = (q, el=document) => el.querySelector(q);
  const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

  // ---------- Teams UI (matches your project look) ----------
  function makeTeamCard(n) {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.borderRadius = "16px";
    wrap.style.marginBottom = "10px";

    wrap.innerHTML = `
      <div class="body">
        <div style="display:grid; grid-template-columns: 1fr 1.2fr auto; gap:10px; align-items:end;">
          <div>
            <label class="small" style="display:block; margin-bottom:6px;">Team name</label>
            <input data-team-name="1" value="Team ${n}" placeholder="Team ${n}">
          </div>
          <div>
            <label class="small" style="display:block; margin-bottom:6px;">Roster (comma separated IGNs)</label>
            <input data-team-members="1" placeholder="e.g. SwaggyKat, Barry, Rebecca">
          </div>
          <button type="button" class="btn secondary" style="height:42px;">Remove</button>
        </div>
      </div>
    `;
    wrap.querySelector("button").addEventListener("click", () => wrap.remove());
    return wrap;
  }

  function initTeams() {
    const teams = $("#teams");
    if (!teams) return;
    // seed 3 teams
    for (let i=1;i<=3;i++) teams.appendChild(makeTeamCard(i));

    $("#add-team")?.addEventListener("click", () => {
      const n = $$("#teams .card").length + 1;
      teams.appendChild(makeTeamCard(n));
    });
    $("#add-3-teams")?.addEventListener("click", () => {
      for (let i=0;i<3;i++) {
        const n = $$("#teams .card").length + 1;
        teams.appendChild(makeTeamCard(n));
      }
    });
  }

  // ---------- Icons (no backend): RuneScape Wiki API thumbnails ----------
  const iconCache = new Map();
  async function getIconUrl(itemName, size=56) {
    if (iconCache.has(itemName)) return iconCache.get(itemName);
    const url = "https://runescape.wiki/api.php?" + new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      titles: itemName,
      prop: "pageimages",
      pithumbsize: String(size)
    });
    try {
      const res = await fetch(url);
      const json = await res.json();
      const pages = json?.query?.pages;
      const firstKey = pages ? Object.keys(pages)[0] : null;
      const src = firstKey ? pages[firstKey]?.thumbnail?.source : "";
      iconCache.set(itemName, src || "");
      return src || "";
    } catch {
      iconCache.set(itemName, "");
      return "";
    }
  }

  // ---------- Picker ----------
  const state = {
    selectedBosses: new Set(),
    selectedDrops: new Map(), // key boss||drop -> {boss,name,points}
  };

  function norm(s){ return String(s ?? "").toLowerCase(); }
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function getCatalog() {
    const raw = window.BOSS_CATALOG;
    if (!Array.isArray(raw)) return [];
    return raw.map(b => ({
      boss: b.boss ?? b.name ?? "",
      drops: Array.isArray(b.drops) ? b.drops : []
    })).filter(b => b.boss);
  }

  function renderSummary() {
    const s = $("#pickerSummary");
    if (!s) return;
    s.textContent = `${state.selectedBosses.size} boss(es) selected • ${state.selectedDrops.size} drop(s) selected.`;
  }

  function renderPayloadPreview() {
    const out = $("#payloadPreview");
    if (!out) return;

    const grouped = {};
    for (const v of state.selectedDrops.values()) {
      grouped[v.boss] ||= [];
      grouped[v.boss].push({ name: v.name, points: v.points });
    }

    // illustrative auto set-bonus per boss
    const setBonuses = Object.keys(grouped).map(boss => ({
      boss,
      rule_type: "set_bonus",
      any_n: null,
      required_items: grouped[boss].map(x => x.name)
    }));

    out.textContent = JSON.stringify({ picker: { picks: grouped, set_bonuses: setBonuses } }, null, 2);
  }

  function renderBossList(catalog) {
    const host = $("#bossList");
    if (!host) return;

    const q = norm($("#bossFilter")?.value || "");
    const bosses = catalog.map(x => x.boss).sort((a,b)=>a.localeCompare(b));

    host.innerHTML = "";
    const frag = document.createDocumentFragment();

    let shown = 0;
    for (const b of bosses) {
      if (q && !norm(b).includes(q)) continue;
      shown++;
      const row = document.createElement("label");
      row.className = "picker-row";
      row.style.cursor = "pointer";
      row.style.display = "flex";
      row.style.gap = "10px";
      row.style.alignItems = "center";
      row.style.padding = "8px 10px";
      row.style.borderRadius = "10px";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "boss-cb";
      cb.dataset.boss = b;
      cb.checked = state.selectedBosses.has(b);

      const name = document.createElement("div");
      name.className = "pname";
      name.textContent = b;

      const count = document.createElement("div");
      count.className = "mono";
      count.style.opacity = ".8";
      count.style.fontSize = "12px";
      const dropCount = (catalog.find(x => x.boss === b)?.drops || []).length;
      count.textContent = String(dropCount);

      cb.addEventListener("change", () => {
        if (cb.checked) state.selectedBosses.add(b);
        else {
          state.selectedBosses.delete(b);
          for (const key of Array.from(state.selectedDrops.keys())) {
            if (key.startsWith(b + "||")) state.selectedDrops.delete(key);
          }
        }
        renderDropList(catalog);
        renderSummary();
        renderPayloadPreview();
      });

      row.append(cb, name, count);
      frag.appendChild(row);
    }

    if (!shown) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.style.padding = "8px 10px";
      empty.style.color = "rgba(147,164,182,.95)";
      empty.textContent = "No bosses match.";
      frag.appendChild(empty);
    }

    host.appendChild(frag);
  }

  async function renderDropList(catalog) {
    const host = $("#dropList");
    if (!host) return;

    const q = norm($("#dropFilter")?.value || "");
    const bosses = Array.from(state.selectedBosses).sort((a,b)=>a.localeCompare(b));

    host.innerHTML = "";
    const frag = document.createDocumentFragment();

    if (!bosses.length) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.style.padding = "8px 10px";
      empty.style.color = "rgba(147,164,182,.95)";
      empty.textContent = "Select one or more bosses to see drops.";
      frag.appendChild(empty);
      host.appendChild(frag);
      return;
    }

    for (const boss of bosses) {
      const hdr = document.createElement("div");
      hdr.className = "small";
      hdr.style.padding = "10px 10px 6px";
      hdr.style.color = "rgba(214,178,94,.95)";
      hdr.style.fontWeight = "750";
      hdr.textContent = boss;
      frag.appendChild(hdr);

      const drops = (catalog.find(x => x.boss === boss)?.drops || []);
      let anyShown = 0;

      for (const d of drops) {
        const name = d?.name ?? d?.drop_name ?? d?.drop ?? "";
        const points = Number(d?.points ?? d?.base_points ?? 0) || 0;
        if (!name) continue;
        if (q && !norm(name).includes(q)) continue;
        anyShown++;

        const key = `${boss}||${name}`;
        const row = document.createElement("label");
        row.className = "picker-row";
        row.style.cursor = "pointer";
        row.style.display = "flex";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.padding = "8px 10px";
        row.style.borderRadius = "10px";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "drop-cb";
        cb.checked = state.selectedDrops.has(key);

        cb.addEventListener("change", () => {
          if (cb.checked) state.selectedDrops.set(key, { boss, name, points });
          else state.selectedDrops.delete(key);
          renderSummary();
          renderPayloadPreview();
        });

        const iconWrap = document.createElement("div");
        iconWrap.className = "picker-icon";
        const img = document.createElement("img");
        img.alt = "";
        img.loading = "lazy";
        img.style.width = "22px";
        img.style.height = "22px";
        img.style.borderRadius = "6px";
        iconWrap.appendChild(img);

        // async icon
        getIconUrl(name, 56).then(url => {
          if (url) img.src = url;
          else img.style.display = "none";
        });

        const pname = document.createElement("div");
        pname.className = "pname";
        pname.textContent = name;

        const pill = document.createElement("div");
        pill.className = "pillpts";
        pill.textContent = `${points} pts`;

        row.append(cb, iconWrap, pname, pill);
        frag.appendChild(row);
      }

      if (!anyShown) {
        const empty = document.createElement("div");
        empty.className = "small";
        empty.style.padding = "6px 10px 10px";
        empty.style.color = "rgba(147,164,182,.95)";
        empty.textContent = "No drops match your filter for this boss.";
        frag.appendChild(empty);
      }
    }

    host.appendChild(frag);
  }

  function bindPicker(catalog) {
    $("#bossFilter")?.addEventListener("input", () => renderBossList(catalog));
    $("#dropFilter")?.addEventListener("input", () => renderDropList(catalog));

    $("#clearPicker")?.addEventListener("click", () => {
      state.selectedBosses.clear();
      state.selectedDrops.clear();
      $("#bossFilter").value = "";
      $("#dropFilter").value = "";
      renderBossList(catalog);
      renderDropList(catalog);
      renderSummary();
      renderPayloadPreview();
    });
  }

  window.addEventListener("boss_catalog_ready", async () => {
    initTeams();
    const catalog = getCatalog();
    renderBossList(catalog);
    await renderDropList(catalog);
    renderSummary();
    renderPayloadPreview();
    bindPicker(catalog);
  });
})();
