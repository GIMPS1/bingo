(() => {
  const $ = (q) => document.querySelector(q);
  const state = { selectedBosses:new Set(), selectedDrops:new Map(), iconCache:new Map() };

  function norm(s){ return String(s||"").toLowerCase(); }

  async function getWikiThumb(name, size=56){
    if(state.iconCache.has(name)) return state.iconCache.get(name);
    const url = "https://runescape.wiki/api.php?" +
      new URLSearchParams({
        action:"query",
        format:"json",
        origin:"*",
        titles:name,
        prop:"pageimages",
        pithumbsize:String(size)
      });
    try{
      const r = await fetch(url);
      const j = await r.json();
      const pages = j?.query?.pages;
      const key = pages ? Object.keys(pages)[0] : null;
      const thumb = key ? pages[key]?.thumbnail?.source : "";
      state.iconCache.set(name, thumb||"");
      return thumb||"";
    }catch{
      state.iconCache.set(name,"");
      return "";
    }
  }

  function renderPayload(){
    const out=$("#payloadOut");
    const grouped={};
    for(const v of state.selectedDrops.values()){
      grouped[v.boss] ||= [];
      grouped[v.boss].push({name:v.name,points:v.points});
    }
    out.textContent = JSON.stringify({picker:{picks:grouped}},null,2);
  }

  function render(catalog){
    const bossList=$("#bossList");
    const dropList=$("#dropList");
    const bf=norm($("#bossFilter").value);
    const df=norm($("#dropFilter").value);

    bossList.innerHTML="";
    catalog.forEach(b=>{
      if(bf && !norm(b.boss).includes(bf)) return;
      const row=document.createElement("div");
      row.innerHTML=`<label><input type="checkbox" data-boss="${b.boss}"> ${b.boss}</label>`;
      row.querySelector("input").checked=state.selectedBosses.has(b.boss);
      row.querySelector("input").onchange=e=>{
        if(e.target.checked) state.selectedBosses.add(b.boss);
        else{
          state.selectedBosses.delete(b.boss);
          for(const k of [...state.selectedDrops.keys()])
            if(k.startsWith(b.boss+"||")) state.selectedDrops.delete(k);
        }
        render(catalog);
      };
      bossList.appendChild(row);
    });

    dropList.innerHTML="";
    catalog.forEach(b=>{
      if(!state.selectedBosses.has(b.boss)) return;
      b.drops.forEach(d=>{
        if(df && !norm(d.name).includes(df)) return;
        const key=b.boss+"||"+d.name;
        const row=document.createElement("div");
        row.innerHTML=`
          <label>
            <input type="checkbox" data-key="${key}">
            <img style="width:22px;height:22px;vertical-align:middle;margin-right:5px;">
            ${d.name} (${d.points} pts)
          </label>`;
        const cb=row.querySelector("input");
        cb.checked=state.selectedDrops.has(key);
        cb.onchange=e=>{
          if(e.target.checked) state.selectedDrops.set(key,{boss:b.boss,name:d.name,points:d.points});
          else state.selectedDrops.delete(key);
          renderPayload();
        };
        getWikiThumb(d.name,56).then(url=>{
          if(url) row.querySelector("img").src=url;
        });
        dropList.appendChild(row);
      });
    });

    $("#pickerSummary").textContent=`${state.selectedBosses.size} boss(es), ${state.selectedDrops.size} drop(s) selected.`;
    renderPayload();
  }

  window.addEventListener("boss_catalog_ready",()=>{
    const catalog=window.BOSS_CATALOG||[];
    $("#bossFilter").oninput=()=>render(catalog);
    $("#dropFilter").oninput=()=>render(catalog);
    $("#clearPicker").onclick=()=>{
      state.selectedBosses.clear();
      state.selectedDrops.clear();
      $("#bossFilter").value="";
      $("#dropFilter").value="";
      render(catalog);
    };
    render(catalog);
  });
})();