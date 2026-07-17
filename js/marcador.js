// Lógica de la página "Contador de puntos" (marcador.html).
// Requiere que js/common.js se cargue antes (usa escapeHtml).

(function(){
  "use strict";

  const STORAGE_KEY = "flash10_marcador_v1";

  let S = null; // { limit, players:[{name}], rounds: [ [scores...] , ... ] }
  let editingExisting = false;

  const setupEl = document.getElementById("setup");
  const boardEl = document.getElementById("board");
  const bottomBarEl = document.getElementById("bottomBar");
  const namesGrid = document.getElementById("namesGrid");
  const playerCountSel = document.getElementById("playerCount");
  const pointLimitInput = document.getElementById("pointLimit");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  function showBoard(){
    setupEl.classList.add("hidden");
    boardEl.classList.remove("hidden");
    bottomBarEl.classList.add("show");
    document.body.classList.add("has-bar");
  }
  function showSetup(){
    boardEl.classList.add("hidden");
    setupEl.classList.remove("hidden");
    bottomBarEl.classList.remove("show");
    document.body.classList.remove("has-bar");
  }

  function buildNameFields(){
    const n = parseInt(playerCountSel.value,10);
    const existing = Array.from(namesGrid.querySelectorAll("input")).map(i=>i.value);
    namesGrid.innerHTML = "";
    for(let i=0;i<n;i++){
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<label>Jugador ${i+1}</label>`;
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 20;
      input.placeholder = "Jugador " + (i+1);
      input.value = existing[i] || "";
      field.appendChild(input);
      namesGrid.appendChild(field);
    }
  }
  playerCountSel.addEventListener("change", buildNameFields);
  buildNameFields();

  document.getElementById("startBtn").addEventListener("click", ()=>{
    const n = parseInt(playerCountSel.value,10);
    const parsedLimit = parseInt(pointLimitInput.value,10);
    const limit = isNaN(parsedLimit) ? 50 : parsedLimit;
    const nameInputs = Array.from(namesGrid.querySelectorAll("input"));
    const players = nameInputs.map((inp,i)=>({
      name: (inp.value.trim() || ("Jugador " + (i+1)))
    }));

    let rounds = [];
    if(editingExisting && S && S.rounds){
      rounds = S.rounds.map(r=>{
        const row = [];
        for(let i=0;i<n;i++) row.push(r[i]||0);
        return row;
      });
    }
    editingExisting = false;
    cancelEditBtn.classList.add("hidden");

    S = { limit, players, rounds };
    save();
    renderBoard();
    showBoard();
  });

  document.getElementById("editSetupBtn").addEventListener("click", ()=>{
    editingExisting = true;
    cancelEditBtn.classList.remove("hidden");
    playerCountSel.value = String(S.players.length);
    buildNameFields();
    const inputs = Array.from(namesGrid.querySelectorAll("input"));
    S.players.forEach((p,i)=>{ if(inputs[i]) inputs[i].value = p.name; });
    pointLimitInput.value = S.limit;
    showSetup();
  });

  cancelEditBtn.addEventListener("click", ()=>{
    editingExisting = false;
    cancelEditBtn.classList.add("hidden");
    showBoard();
  });

  document.getElementById("resetBtn").addEventListener("click", ()=>{
    if(!confirm("¿Reiniciar todo el marcador? Se perderá el historial de esta partida.")) return;
    localStorage.removeItem(STORAGE_KEY);
    S = null;
    editingExisting = false;
    cancelEditBtn.classList.add("hidden");
    showSetup();
    playerCountSel.value = "4";
    pointLimitInput.value = 50;
    buildNameFields();
  });

  document.getElementById("undoBtn").addEventListener("click", ()=>{
    if(!S || S.rounds.length===0) return;
    S.rounds.pop();
    save();
    renderBoard();
  });

  document.getElementById("addRoundBtn").addEventListener("click", addRound);

  function addRound(){
    const inputs = Array.from(document.querySelectorAll("#entryGrid input"));
    const scores = inputs.map(inp => parseInt(inp.value,10) || 0);
    S.rounds.push(scores);
    save();
    renderBoard();
    window.scrollTo({top:0, behavior:"smooth"});
  }

  function totals(){
    return S.players.map((p,i)=>{
      let t = 0;
      S.rounds.forEach(r=> t += (r[i]||0));
      return t;
    });
  }

  function renderBoard(){
    document.getElementById("hudLimit").textContent = S.limit;
    document.getElementById("hudRound").textContent = S.rounds.length;

    // tarjetas de puntaje de la ronda actual
    const entryGrid = document.getElementById("entryGrid");
    const tot = totals();
    entryGrid.innerHTML = S.players.map((p,i)=>`
      <div class="entry-cell">
        <div class="pname">${escapeHtml(p.name)}</div>
        <div class="remain">${Math.max(S.limit - tot[i],0)} pts para el límite</div>
        <input type="number" inputmode="numeric" step="1" value="0" data-idx="${i}">
      </div>
    `).join("");

    // tocar selecciona el "0" + Enter avanza al siguiente jugador (o agrega la ronda)
    const entryInputs = Array.from(entryGrid.querySelectorAll("input"));
    entryInputs.forEach((inp, i)=>{
      inp.addEventListener("focus", ()=> inp.select());
      inp.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
          e.preventDefault();
          if(i < entryInputs.length-1) entryInputs[i+1].focus();
          else addRound();
        }
      });
    });

    // tabla de historial y totales
    const table = document.getElementById("scoreTable");
    let thead = "<tr><th>Ronda</th>" + S.players.map(p=>`<th>${escapeHtml(p.name)}</th>`).join("") + "</tr>";
    let rowsHtml = S.rounds.map((r,ri)=>{
      return "<tr><td>" + (ri+1) + "</td>" + r.map(v=>`<td>${v>0?'+':''}${v}</td>`).join("") + "</tr>";
    }).join("");
    const leaderMax = Math.max(...tot);
    let totalRow = "<tr class=\"total-row\"><td>TOTAL</td>" + tot.map(v=>{
      const isLeader = v===leaderMax && leaderMax>0;
      return `<td class="${isLeader?'leader':''}">${v}${isLeader?' <span class="crown">👑</span>':''}</td>`;
    }).join("") + "</tr>";
    table.innerHTML = thead + rowsHtml + totalRow;

    // banner de campeón
    const banner = document.getElementById("championBanner");
    const champIdx = tot.findIndex(v=>v>=S.limit);
    if(champIdx>=0){
      const winners = S.players.filter((p,i)=>tot[i]===leaderMax && leaderMax>=S.limit);
      const names = winners.map(p=>escapeHtml(p.name)).join(" y ");
      document.getElementById("championText").textContent =
        (winners.length>1 ? `¡Empate! ${names} alcanzaron ${leaderMax} puntos.` : `¡${names} es el campeón de Flash 10 con ${leaderMax} puntos!`);
      banner.classList.add("show");
    } else {
      banner.classList.remove("show");
    }

    document.getElementById("undoBtn").disabled = S.rounds.length===0;
  }

  function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  }

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return false;
      const parsed = JSON.parse(raw);
      if(!parsed || !parsed.players || !parsed.players.length) return false;
      S = parsed;
      return true;
    }catch(e){ return false; }
  }

  if(load()){
    renderBoard();
    showBoard();
  }

})();
