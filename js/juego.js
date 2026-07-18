// Lógica de la página "Jugar online" (juego.html).
// Requiere que js/common.js se cargue antes (usa escapeHtml).

(function(){
  "use strict";

  // ---------------------------------------------------------------
  // Configuración y estado del juego
  // ---------------------------------------------------------------
  const BOT_NAMES = ["Bot Nova","Bot Cronos","Bot Vega","Bot Rex","Bot Luma"];
  const SPEED_MS = { slow:[900,1500], normal:[550,1000], fast:[300,600] };

  let cfg = {
    mode:"clasico",
    playerCount:3,
    botSpeed:"normal",
    championship:false,
    champTarget:50
  };

  let S = null; 
  let champScores = null; 

  // ---------------------------------------------------------------
  // Armado del mazo y barajado
  // ---------------------------------------------------------------
  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function buildDeck(mode){ // 100 cartas numeradas 0-99, 20 con rayo, 20 tormenta si es clásico
    const values = [];
    for(let v=0; v<100; v++) values.push(v);
    shuffle(values);
    const rayoSet = new Set(values.slice(0,20));
    let deck = [];
    for(let v=0; v<100; v++){
      deck.push({ id:"n"+v, value:v, rayo:rayoSet.has(v), tormenta:false });
    }
    if(mode==="clasico"){
      for(let t=0;t<20;t++){
        deck.push({ id:"t"+t, value:null, rayo:false, tormenta:true });
      }
    }
    shuffle(deck);
    return deck;
  }

  // ---------------------------------------------------------------
  // Instrucciones de la UI
  // ---------------------------------------------------------------
  const modeCards = document.querySelectorAll(".mode-card");
  modeCards.forEach(el=>{
    el.addEventListener("click", ()=>{
      modeCards.forEach(m=>m.classList.remove("selected"));
      el.classList.add("selected");
      cfg.mode = el.dataset.mode;
    });
  });

  document.getElementById("champMode").addEventListener("change", (e)=>{
    cfg.championship = e.target.value === "on";
    document.getElementById("champTargetField").style.display = cfg.championship ? "flex" : "none";
  });

  document.getElementById("startBtn").addEventListener("click", ()=>{
    cfg.playerCount = parseInt(document.getElementById("playerCount").value,10);
    cfg.botSpeed = document.getElementById("botSpeed").value;
    cfg.champTarget = parseInt(document.getElementById("champTarget").value,10) || 50;
    if(cfg.championship) champScores = {};
    startNewRound();
  });

  document.getElementById("newRoundBtn").addEventListener("click", ()=>{
    startNewRound();
  });
  document.getElementById("changeSetupBtn").addEventListener("click", ()=>{
    stopAllBotTimers();
    document.getElementById("game").classList.remove("active");
    document.getElementById("setup").classList.remove("hidden");
    hideOverlay();
  });
  document.getElementById("playAgainBtn").addEventListener("click", ()=>{
    hideOverlay();
    startNewRound();
  });
  document.getElementById("backToSetupBtn").addEventListener("click", ()=>{
    hideOverlay();
    stopAllBotTimers();
    document.getElementById("game").classList.remove("active");
    document.getElementById("setup").classList.remove("hidden");
  });

  // ---------------------------------------------------------------
  // Controla la logica de los bots y el temporizador de sus acciones
  // ---------------------------------------------------------------
  let botTimers = [];
  function stopAllBotTimers(){
    botTimers.forEach(t=>clearTimeout(t));
    botTimers = [];
  }

  function initialHandSize(mode, playerCount){
    if(mode==="truenos") return 8;
    // base / relampagos: 8 con 5 jugadores, si no 10
    return playerCount===5 ? 8 : 10;
  }

  function startNewRound(){
    stopAllBotTimers();
    hideOverlay();

    const mode = cfg.mode;
    const n = cfg.playerCount;
    const handSize = initialHandSize(mode, n);
    const deck = buildDeck(mode);

    const players = [];
    for(let i=0;i<n;i++){
      const isHuman = i===0;
      const name = isHuman ? "Tú" : BOT_NAMES[(i-1) % BOT_NAMES.length];
      const row = [];
      for(let k=0;k<handSize;k++){
        row.push([ deck.pop() ]); // pila con una carta boca abajo al repartir
      }
      players.push({ id:i, name, isHuman, row, hand:null, finished:false });
    }

    S = {
      mode, deck, players,
      revealed:false,
      gameOver:false,
      winnerId:null,
      endReason:null
    };

    document.getElementById("setup").classList.add("hidden");
    document.getElementById("game").classList.add("active");
    document.getElementById("hudMode").textContent = modeLabel(mode);
    document.getElementById("champBadge").style.display = cfg.championship ? "inline-flex" : "none";
    document.getElementById("hudTarget").textContent = cfg.champTarget;
    document.getElementById("log").innerHTML = "";
    document.getElementById("handSlot").className = "hand-slot";
    document.getElementById("handSlot").textContent = "vacío";

    log(`Nueva partida — variante <b>${modeLabel(mode)}</b>, ${n} jugadores.`, "");
    renderAll();

    // pequeña pausa con las cartas boca abajo, luego se revelan
    setTimeout(()=>{
      S.revealed = true;
      log("¡Cartas reveladas! Empieza la partida.", "win");
      renderAll();
      launchBots();
    }, 900);
  }

  function modeLabel(m){
    return m==="truenos" ? "Truenos" : m==="relampagos" ? "Relámpagos" : "Clásico";
  }

  // ---------------------------------------------------------------
  // Lógica de juego: orden de las cartas, puntaje, etc.
  // ---------------------------------------------------------------
  function topOf(pile){ return pile[pile.length-1]; }

  function isRowOrdered(player){
    const tops = player.row.map(topOf);
    let last = -1;
    for(const c of tops){
      if(S.mode==="clasico" && c.tormenta) continue;
      if(c.value <= last) return false;
      last = c.value;
    }
    return true;
  }

  // Puntaje máximo alcanzable leyendo la fila de izquierda a derecha: busca la
  // mejor subsecuencia ascendente posible (no solo comparar contra la última
  // carta contada), porque una carta alta al principio no debe "tapar" una
  // racha ascendente más larga que viene después. Cada carta vale 1 punto,
  // +1 si tiene rayo. Las cartas de Tormenta (modo clásico) no participan.
  function bestOrderedScore(tops, mode){
    const cards = tops.filter(c => !(mode==="clasico" && c.tormenta));
    const n = cards.length;
    if(n===0) return 0;
    const dp = new Array(n);
    let best = 0;
    for(let i=0;i<n;i++){
      const own = cards[i].rayo ? 2 : 1;
      dp[i] = own;
      for(let j=0;j<i;j++){
        if(cards[j].value < cards[i].value && dp[j] + own > dp[i]){
          dp[i] = dp[j] + own;
        }
      }
      if(dp[i] > best) best = dp[i];
    }
    return best;
  }

  function scoreRow(player){
    const tops = player.row.map(topOf);
    const penalty = S.mode==="clasico" ? tops.filter(c=>c.tormenta).length : 0;
    const score = bestOrderedScore(tops, S.mode);
    return { total: score - penalty, score, penalty };
  }

  function bestPlacementIndex(player, card){
    // Prueba cada pila, simula el resultado y elige la que deja más orden.
    let bestIdx = 0, bestVal = -Infinity;
    const candidates = [];
    for(let i=0;i<player.row.length;i++){
      player.row[i].push(card);
      const val = bestOrderedScore(player.row.map(topOf), S.mode);
      player.row[i].pop();
      candidates.push({i, val});
      if(val > bestVal){ bestVal = val; bestIdx = i; }
    }
    // un poco de azar entre empates para que no sea siempre predecible
    const ties = candidates.filter(c=>c.val===bestVal);
    if(ties.length>1) bestIdx = ties[Math.floor(Math.random()*ties.length)].i;
    return bestIdx;
  }

  function bestStormIndex(player){
    // elige la pila donde "tapar" con Tormenta mejora más el orden restante
    let bestIdx = 0, bestVal = -Infinity;
    for(let i=0;i<player.row.length;i++){
      player.row[i].push({id:"sim", value:null, rayo:false, tormenta:true});
      const val = bestOrderedScore(player.row.map(topOf), S.mode);
      player.row[i].pop();
      if(val > bestVal){ bestVal = val; bestIdx = i; }
    }
    return bestIdx;
  }

  // ---------------------------------------------------------------
  // Acciones del jugador (humano)
  // ---------------------------------------------------------------
  function humanDraw(){
    if(S.gameOver || !S.revealed) return;
    const human = S.players[0];
    if(human.finished || human.hand) return;
    if(S.deck.length===0){ maybeEndByExhaustion(); return; }
    human.hand = S.deck.pop();
    renderAll();
  }

  function humanPlace(pileIndex){
    if(S.gameOver) return;
    const human = S.players[0];
    if(!human.hand || human.finished) return;
    human.row[pileIndex].push(human.hand);
    human.hand = null;
    renderAll();
    maybeEndByExhaustion();
  }

  function humanStop(){
    if(S.gameOver) return;
    const human = S.players[0];
    if(human.hand || human.finished) return;
    if(isRowOrdered(human)){
      handleSuccessfulStop(human);
    } else {
      toast("¡Aún no está en orden! Sigue intentando.", "bad");
      log(`<b>Tú</b> dices STOP... pero no está en orden.`, "warn");
    }
    renderAll();
  }

  function handleSuccessfulStop(player){
    if(S.mode==="truenos"){
      if(player.row.length < 10){
        if(S.deck.length===0){
          // no quedan cartas para subir de nivel; se cierra con el tamaño actual
          finishPlayer(player);
          return;
        }
        const newCard = S.deck.pop();
        player.row.push([newCard]);
        log(`<b>${escapeHtml(player.name)}</b> dice STOP y supera el nivel — ahora ${player.row.length} cartas.`, player.isHuman?"win":"");
        toast(`¡Nivel superado! ${player.row.length} cartas`, "good");
        if(isRowOrdered(player)){
          handleSuccessfulStop(player);
        }
      } else {
        finishPlayer(player);
      }
    } else {
      finishPlayer(player);
    }
  }

  function finishPlayer(player){
    player.finished = true;
    S.gameOver = true;
    S.winnerId = player.id;
    S.endReason = "stop";
    log(`🏆 <b>${escapeHtml(player.name)}</b> completa la fila en orden y grita STOP. ¡Gana la partida!`, "win");
    endGame();
  }

  // ---------------------------------------------------------------
  // Bots
  // ---------------------------------------------------------------
  function launchBots(){
    S.players.forEach(p=>{
      if(!p.isHuman) scheduleBotAction(p);
    });
  }

  function scheduleBotAction(bot){
    if(S.gameOver || bot.finished) return;
    const [minMs,maxMs] = SPEED_MS[cfg.botSpeed];
    const delay = minMs + Math.random()*(maxMs-minMs);
    const t = setTimeout(()=>botAct(bot), delay);
    botTimers.push(t);
  }

  function botAct(bot){
    if(S.gameOver || bot.finished){ return; }
    if(!bot.hand){
      if(S.deck.length===0){
        maybeEndByExhaustion();
        if(!S.gameOver) scheduleBotAction(bot);
        return;
      }
      bot.hand = S.deck.pop();
    } else {
      let idx;
      if(bot.hand.tormenta){
        idx = bestStormIndex(bot);
      } else {
        idx = bestPlacementIndex(bot, bot.hand);
      }
      bot.row[idx].push(bot.hand);
      bot.hand = null;
      if(isRowOrdered(bot)){
        handleSuccessfulStop(bot);
      }
    }
    renderAll();
    if(!S.gameOver){
      scheduleBotAction(bot);
    }
  }

  // ---------------------------------------------------------------
  // Finalización de la partida
  // ---------------------------------------------------------------
  function maybeEndByExhaustion(){
    if(S.gameOver) return;
    if(S.deck.length===0 && S.players.every(p=>p.finished || !p.hand)){
      S.gameOver = true;
      S.endReason = "deck";
      const scored = S.players.map(p=>({p, s:scoreRow(p)}));
      scored.sort((a,b)=> b.s.total - a.s.total);
      S.winnerId = scored[0].p.id;
      log(`🂠 El mazo se ha agotado. Se calcula la puntuación de cada jugador.`, "warn");
      log(`🏆 <b>${escapeHtml(scored[0].p.name)}</b> gana por puntos (${scored[0].s.total} pts).`, "win");
      endGame();
    }
  }

  function endGame(){
    stopAllBotTimers();
    renderAll();
    showOverlay();
  }

  // ---------------------------------------------------------------
  // Renderizado de la UI
  // ---------------------------------------------------------------
  function cardHueFor(card){
    return Math.floor(card.value/20) % 5;
  }

  function renderAll(){
    if(!S) return;
    document.getElementById("hudDeck").textContent = S.deck.length;

    const board = document.getElementById("board");
    board.innerHTML = "";
    S.players.forEach(p=>{
      const panel = document.createElement("div");
      panel.className = "player-panel" + (p.isHuman?" you":"") + (S.gameOver && S.winnerId===p.id ? " winner":"");
      const rowHtml = p.row.map((pile,idx)=>{
        const top = topOf(pile);
        const clickable = p.isHuman && p.hand && !p.finished && !S.gameOver && S.revealed;
        if(!S.revealed){
          return `<div class="pile back"></div>`;
        }
        let cls = "pile " + (clickable ? "clickable" : "");
        let inner;
        if(top.tormenta){
          inner = `🌩️`;
          cls += " card-face storm";
        } else {
          inner = `${top.value}` + (top.rayo ? `<span class="rayo-ic">⚡</span>` : "");
          cls += ` card-face hue-${cardHueFor(top)}`;
        }
        return `<div class="${cls}" data-player="${p.id}" data-pile="${idx}">${inner}<span class="count">${pile.length}</span></div>`;
      }).join("");

      panel.innerHTML = `
        <div class="player-head">
          <div class="name">${escapeHtml(p.name)} ${p.isHuman ? '<span class="you-tag">TÚ</span>':''}</div>
          <div class="meta">${p.finished ? "✅ Terminado" : (S.mode==="truenos" ? `Nivel ${p.row.length-7} · ${p.row.length}/10` : `${p.row.length} cartas`)}</div>
        </div>
        <div class="row-cards">${rowHtml}</div>
      `;
      board.appendChild(panel);
    });

    // manejadores de click para las pilas del jugador humano
    board.querySelectorAll('.pile.clickable').forEach(el=>{
      el.addEventListener('click', ()=>{
        const pileIdx = parseInt(el.dataset.pile,10);
        humanPlace(pileIdx);
      });
    });

    // mazo
    const deckEl = document.getElementById("deckPile");
    const human = S.players[0];
    const deckDisabled = S.gameOver || !S.revealed || human.finished || !!human.hand || S.deck.length===0;
    deckEl.className = "deck-pile" + (deckDisabled ? " disabled":"");
    deckEl.textContent = S.deck.length===0 ? "VACÍO" : "MAZO";
    deckEl.onclick = deckDisabled ? null : humanDraw;

    // carta en mano
    const handSlot = document.getElementById("handSlot");
    if(human.hand){
      handSlot.className = "hand-slot filled";
      if(human.hand.tormenta){
        handSlot.innerHTML = `<div class="pile card-face storm" style="width:100%;height:100%;">🌩️</div>`;
      } else {
        handSlot.innerHTML = `<div class="pile card-face hue-${cardHueFor(human.hand)}" style="width:100%;height:100%;">${human.hand.value}${human.hand.rayo?'<span class="rayo-ic">⚡</span>':''}</div>`;
      }
    } else {
      handSlot.className = "hand-slot";
      handSlot.textContent = "vacío";
    }

    // botón STOP
    const stopBtn = document.getElementById("stopBtn");
    stopBtn.disabled = S.gameOver || !S.revealed || human.finished || !!human.hand;
    stopBtn.onclick = humanStop;
  }

  function log(html, cls){
    const logEl = document.getElementById("log");
    const div = document.createElement("div");
    div.className = "entry" + (cls ? " "+cls : "");
    div.innerHTML = html;
    logEl.appendChild(div);
  }

  let toastTimer = null;
  function toast(msg, kind){
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "msg-toast show" + (kind ? " "+kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.classList.remove("show"), 1800);
  }

  // ---------------------------------------------------------------
  // Overlay / resumen de puntuación
  // ---------------------------------------------------------------
  function showOverlay(){
    const overlay = document.getElementById("overlay");
    const title = document.getElementById("overlayTitle");
    const sub = document.getElementById("overlaySub");
    const table = document.getElementById("scoreTable");

    const winner = S.players.find(p=>p.id===S.winnerId);
    const verb = winner.isHuman ? "ganas" : "gana";
    title.textContent = S.endReason==="stop" ? `🏆 ¡${winner.name} ${verb}!` : `🂠 Mazo agotado — ${verb} ${winner.name}`;
    sub.textContent = S.endReason==="stop"
      ? "Fila completa en orden ascendente."
      : "Se calcula la puntuación de cada jugador según el orden de sus cartas.";

    const rows = S.players.map(p=>{
      const s = scoreRow(p);
      return {p, s};
    }).sort((a,b)=> b.s.total - a.s.total);

    if(cfg.championship){
      rows.forEach(r=>{
        champScores[r.p.name] = (champScores[r.p.name]||0) + r.s.total;
      });
      // en campeonato, el orden de la tabla refleja quién va primero en el
      // torneo (puntaje acumulado), no solo quién ganó esta ronda
      rows.sort((a,b)=> (champScores[b.p.name]||0) - (champScores[a.p.name]||0));
    }

    const champLeaderMax = cfg.championship ? Math.max(...rows.map(r=>champScores[r.p.name]||0)) : null;

    let thead = `<tr><th>Jugador</th><th>Puntos ronda</th>${cfg.championship?'<th>Total campeonato</th>':''}</tr>`;
    let body = rows.map(r=>{
      const champTotal = cfg.championship ? (champScores[r.p.name]||0) : null;
      const isChampLeader = cfg.championship && champTotal===champLeaderMax;
      return `<tr>
        <td>${escapeHtml(r.p.name)}${r.p.id===S.winnerId?' 🏆':''}</td>
        <td>${r.s.total} <span style="color:var(--text-dim);font-size:11px;">(${r.s.score}${S.mode==='clasico' && r.s.penalty ? ' − '+r.s.penalty+' tormenta':''})</span></td>
        ${cfg.championship ? `<td><b>${champTotal}</b>${isChampLeader ? ' 👑' : ''}</td>` : ''}
      </tr>`;
    }).join("");
    table.innerHTML = thead + body;

    if(cfg.championship){
      const champWinner = Object.entries(champScores).sort((a,b)=>b[1]-a[1])[0];
      if(champWinner && champWinner[1] >= cfg.champTarget){
        title.textContent = `🎉 ¡${champWinner[0]} es el Campeón de Flash 10!`;
        sub.textContent = `Alcanzó ${champWinner[1]} puntos (meta: ${cfg.champTarget}).`;
      }
    }

    overlay.classList.add("show");
  }
  function hideOverlay(){
    document.getElementById("overlay").classList.remove("show");
  }

})();
