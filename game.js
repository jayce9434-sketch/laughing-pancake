(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    rubies: document.getElementById('rubies'), eggCount: document.getElementById('eggCount'), insectCount: document.getElementById('insectCount'),
    carrying: document.getElementById('carrying'), eggStorage: document.getElementById('eggStorage'), collection: document.getElementById('collection'),
    rubyBtn: document.getElementById('rubyBtn'), rubyCooldown: document.getElementById('rubyCooldown'), fuseBtn: document.getElementById('fuseBtn'),
    clearFusionBtn: document.getElementById('clearFusionBtn'), fusionSelection: document.getElementById('fusionSelection'),
    eventName: document.getElementById('eventName'), eventDesc: document.getElementById('eventDesc'), eventTimer: document.getElementById('eventTimer'),
    statStolen: document.getElementById('statStolen'), statHatched: document.getElementById('statHatched'), statFused: document.getElementById('statFused'), statBest: document.getElementById('statBest'),
    interactBtn: document.getElementById('interactBtn'), toast: document.getElementById('toast'), resetBtn: document.getElementById('resetBtn'),
    modal: document.getElementById('modal'), modalTitle: document.getElementById('modalTitle'), modalBody: document.getElementById('modalBody'), modalPrimary: document.getElementById('modalPrimary'), modalClose: document.getElementById('modalClose')
  };

  const WORLD = { w: 2400, h: 1500 };
  const home = { x: 120, y: 590, w: 300, h: 320 };
  const rarityOrder = ['Common','Uncommon','Rare','Epic','Legendary','Mythical','Divine','Ethereal'];
  const rarityColors = { Common:'#d7dce2', Uncommon:'#62d883', Rare:'#5b9cff', Epic:'#bb70ff', Legendary:'#ffd35e', Mythical:'#ff6f97', Divine:'#7ee8f4', Ethereal:'#efa5ff' };
  const insectPools = {
    Common:['Ant','Fly','Mosquito','Cricket','Pillbug'],
    Uncommon:['Beetle','Earwig','Termite','Gnat','Moth'],
    Rare:['Lacewing','Firefly','Stinkbug','Leafbug','Aphid'],
    Epic:['Mantisfly','Assassin Bug','Dragonfly','Peanut-Headed Lanternfly','Velvet Ant'],
    Legendary:['Stormglass Dragonfly','Emperor Moth','Queen Termite','Golden Scarab','Orchid Mantis'],
    Mythical:['Spirit Beetle','Relic Ant','Void Lacewing','Celestial Cicada','Crystal Wasp'],
    Divine:['Sunforge Mantis','Aurora Termite','Prismatic Stag Beetle','Titan Bee'],
    Ethereal:['Eclipse Moth','Spectral Empress','Astral Dragonfly','Infinity Ant']
  };

  const bases = [
    {name:'Ant Colony',x:650,y:170,w:360,h:260,color:'#6a4d3b',eggBias:['Common','Uncommon','Rare']},
    {name:'Bee Hive',x:1460,y:120,w:390,h:270,color:'#8b702b',eggBias:['Uncommon','Rare','Epic']},
    {name:'Termite Citadel',x:1850,y:930,w:400,h:320,color:'#755f49',eggBias:['Rare','Epic','Legendary']},
    {name:'Spider Den',x:1020,y:960,w:380,h:300,color:'#493a59',eggBias:['Epic','Legendary','Mythical']},
    {name:'Mosquito Marsh',x:520,y:1030,w:340,h:280,color:'#355c4c',eggBias:['Common','Rare','Epic']}
  ];

  const eggSpawns = [
    {x:790,y:300,base:0},{x:880,y:240,base:0},{x:1590,y:250,base:1},{x:1720,y:205,base:1},
    {x:1980,y:1080,base:2},{x:2110,y:1150,base:2},{x:1140,y:1090,base:3},{x:1270,y:1170,base:3},
    {x:610,y:1160,base:4},{x:730,y:1220,base:4},{x:1490,y:680,base:null},{x:1750,y:680,base:null}
  ];

  const state = {
    rubies: 0,
    eggs: [],
    insects: [],
    carrying: null,
    selectedFusion: [],
    stats: { stolen:0, hatched:0, fused:0, best:0 },
    player: { x:270, y:750, r:22, speed:260 },
    keys: {},
    touch: {up:false,down:false,left:false,right:false},
    camera: {x:0,y:0},
    rubyReadyAt: 0,
    activeEvent: null,
    eventEndsAt: 0,
    spawnEggs: [],
    lastTs: performance.now()
  };

  const eventDefs = [
    {name:'Egg Rush',desc:'Egg respawns are 60% faster.',duration:75,effect:'respawn'},
    {name:'DNA Surge',desc:'Fusion has a much better chance to upgrade rarity.',duration:70,effect:'fusion'},
    {name:'Ruby Rain',desc:'Returning stolen eggs grants bonus Rubies.',duration:65,effect:'ruby'},
    {name:'Nest Frenzy',desc:'Wild nests can spawn one rarity higher.',duration:70,effect:'rarity'},
    {name:'Lucky Shells',desc:'Hatches have a bonus chance to jump a rarity.',duration:70,effect:'hatch'}
  ];

  function save(){
    const payload = {rubies:state.rubies,eggs:state.eggs,insects:state.insects,stats:state.stats};
    localStorage.setItem('saie_save_v1', JSON.stringify(payload));
  }
  function load(){
    try{
      const raw = localStorage.getItem('saie_save_v1'); if(!raw) return;
      const d=JSON.parse(raw); state.rubies=Number(d.rubies)||0; state.eggs=Array.isArray(d.eggs)?d.eggs:[]; state.insects=Array.isArray(d.insects)?d.insects:[];
      if(d.stats) state.stats={...state.stats,...d.stats};
    }catch(e){ console.warn('Save load failed',e); }
  }

  function weightedRarity(bias){
    const pool = bias || ['Common','Uncommon','Rare','Epic'];
    const weights = [55,28,12,4,1];
    let expanded=[];
    pool.forEach((r,i)=>{ const count=Math.max(1,weights[i]||2); for(let n=0;n<count;n++) expanded.push(r); });
    let chosen=expanded[Math.floor(Math.random()*expanded.length)];
    if(state.activeEvent?.effect==='rarity' && Math.random()<0.22){ chosen=upgradeRarity(chosen,1); }
    if(isHalloween() && Math.random()<0.035) chosen='Mythical';
    return chosen;
  }
  function upgradeRarity(r,amount=1){ return rarityOrder[Math.min(rarityOrder.length-1, rarityOrder.indexOf(r)+amount)]; }
  function rarityValue(r){ return rarityOrder.indexOf(r); }
  function randomInsect(rarity){ const p=insectPools[rarity]; return p[Math.floor(Math.random()*p.length)]; }
  function makeEgg(rarity,source){ return {id:cryptoId(),rarity,source,hatchedAt:0}; }
  function cryptoId(){ return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now().toString(36)); }
  function isHalloween(){ const d=new Date(); return d.getMonth()===9 && d.getDate()<31+1; }
  function isFall(){ const d=new Date(); const m=d.getMonth(); return m===8||m===9||m===10; }

  function initSpawns(){
    state.spawnEggs = eggSpawns.map((s,i)=>({ ...s, id:i, active:true, rarity:weightedRarity(s.base==null?['Common','Uncommon','Rare','Epic']:bases[s.base].eggBias), respawnAt:0 }));
  }
  function respawnSpawn(sp){
    const speed = state.activeEvent?.effect==='respawn' ? 0.4 : 1;
    const delay = (5000 + Math.random()*5000)*speed;
    sp.active=false; sp.respawnAt=Date.now()+delay;
  }

  function showToast(msg){ ui.toast.textContent=msg; ui.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>ui.toast.classList.remove('show'),1800); }

  function stealNearest(){
    if(state.carrying){ showToast('You are already carrying an egg!'); return; }
    let best=null,bestD=9999;
    for(const sp of state.spawnEggs){ if(!sp.active) continue; const d=Math.hypot(state.player.x-sp.x,state.player.y-sp.y); if(d<bestD){best=sp;bestD=d;} }
    if(best && bestD<95){
      const source = best.base==null?'Wild Nest':bases[best.base].name;
      state.carrying=makeEgg(best.rarity,source); state.stats.stolen++; respawnSpawn(best); showToast(`Stole a ${best.rarity} Egg! Run home!`); updateUI(); return;
    }
    showToast('Get closer to an egg pedestal.');
  }

  function returnHome(){
    if(!state.carrying) return;
    const p=state.player;
    if(p.x>home.x&&p.x<home.x+home.w&&p.y>home.y&&p.y<home.y+home.h){
      const egg=state.carrying; state.carrying=null; state.eggs.push(egg);
      const baseReward = 25 + rarityValue(egg.rarity)*35;
      const bonus = state.activeEvent?.effect==='ruby' ? baseReward : 0;
      state.rubies += baseReward + bonus;
      showToast(`Secured ${egg.rarity} Egg! +${baseReward+bonus} Rubies`);
      save(); updateUI();
    }
  }

  function hatchEgg(id){
    const idx=state.eggs.findIndex(e=>e.id===id); if(idx<0) return;
    const egg=state.eggs[idx]; let rarity=egg.rarity;
    let jumpChance = 0.06 + (state.activeEvent?.effect==='hatch'?0.18:0) + (isHalloween()?0.03:0);
    if(Math.random()<jumpChance) rarity=upgradeRarity(rarity,1);
    let name = randomInsect(rarity);
    if(isHalloween() && rarityValue(rarity)>=3 && Math.random()<0.09) name = ['Pumpkin Mantis','Ghost Moth','Candy Corn Beetle'][Math.floor(Math.random()*3)];
    const bug={id:cryptoId(),name,rarity,level:1,obtained:Date.now()};
    state.insects.push(bug); state.eggs.splice(idx,1); state.stats.hatched++; state.stats.best=Math.max(state.stats.best,rarityValue(rarity));
    showModal(`${rarity} Hatch!`, `<div style="font-size:44px;text-align:center">🐛</div><p>You hatched <b>${escapeHtml(name)}</b>!</p><p class="rarity ${rarity}">${rarity}</p>`, null, 'Nice!');
    save(); updateUI();
  }

  function fusionCost(rarity){ return 80 + rarityValue(rarity)*140; }
  function toggleFusion(id){
    const bug=state.insects.find(b=>b.id===id); if(!bug) return;
    const i=state.selectedFusion.indexOf(id); if(i>=0){ state.selectedFusion.splice(i,1); updateUI(); return; }
    if(state.selectedFusion.length>=2){ showToast('Only 2 insects can be fused.'); return; }
    if(state.selectedFusion.length===1){ const first=state.insects.find(b=>b.id===state.selectedFusion[0]); if(first && first.rarity!==bug.rarity){ showToast('Fusion requires matching rarities.'); return; } }
    state.selectedFusion.push(id); updateUI();
  }
  function fuseSelected(){
    if(state.selectedFusion.length!==2) return;
    const a=state.insects.find(b=>b.id===state.selectedFusion[0]); const b=state.insects.find(b=>b.id===state.selectedFusion[1]); if(!a||!b||a.rarity!==b.rarity) return;
    const cost=fusionCost(a.rarity); if(state.rubies<cost){ showToast(`Need ${cost} Rubies.`); return; }
    state.rubies-=cost;
    const roll=Math.random(); const surge=state.activeEvent?.effect==='fusion';
    let out=a.rarity;
    if(surge ? roll<0.48 : roll<0.24) out=upgradeRarity(out,1);
    if((surge ? roll<0.08 : roll<0.02) && rarityValue(out)<rarityOrder.length-1) out=upgradeRarity(out,1);
    const ids=new Set(state.selectedFusion); state.insects=state.insects.filter(x=>!ids.has(x.id));
    const name=randomInsect(out); state.insects.push({id:cryptoId(),name,rarity:out,level:1,obtained:Date.now()}); state.selectedFusion=[]; state.stats.fused++; state.stats.best=Math.max(state.stats.best,rarityValue(out));
    showModal('DNA Fusion Complete', `<p>Your insects fused into <b>${escapeHtml(name)}</b>.</p><p class="rarity ${out}">${out}</p>`, null, 'Awesome'); save(); updateUI();
  }

  function showModal(title,html,primaryFn,primaryLabel='OK'){
    ui.modalTitle.textContent=title; ui.modalBody.innerHTML=html; ui.modal.classList.remove('hidden'); ui.modalPrimary.textContent=primaryLabel; ui.modalPrimary.onclick=()=>{ if(primaryFn) primaryFn(); ui.modal.classList.add('hidden'); };
  }
  function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  function claimRubies(){
    const now=Date.now(); if(now<state.rubyReadyAt) return;
    state.rubies += 3000; state.rubyReadyAt=now+3000; showToast('+3000 Rubies!'); save(); updateUI();
  }

  function chooseEvent(){
    const def=eventDefs[Math.floor(Math.random()*eventDefs.length)]; state.activeEvent=def; state.eventEndsAt=Date.now()+def.duration*1000; updateEventUI();
  }
  function updateEventUI(){
    const extra = isHalloween() ? ' • HALLOWEEN: spooky hatch variants active' : (isFall() ? ' • FALL: seasonal nest boost active' : '');
    ui.eventName.textContent=state.activeEvent?.name || 'Calm Nests';
    ui.eventDesc.textContent=(state.activeEvent?.desc || 'Normal nest activity.') + extra;
  }

  function updateUI(){
    ui.rubies.textContent=Math.floor(state.rubies).toLocaleString(); ui.eggCount.textContent=state.eggs.length; ui.insectCount.textContent=state.insects.length;
    ui.carrying.innerHTML = state.carrying ? `<span class="rarity ${state.carrying.rarity}">${state.carrying.rarity} Egg</span><div class="smallText">From ${escapeHtml(state.carrying.source)}</div>` : '<span class="empty">Nothing</span>';
    ui.eggStorage.innerHTML = state.eggs.length ? state.eggs.map(e=>`<div class="eggCard"><div style="font-size:22px">🥚</div><div class="meta"><strong class="rarity ${e.rarity}">${e.rarity} Egg</strong><span>${escapeHtml(e.source)}</span></div><button type="button" data-hatch="${e.id}">Hatch</button></div>`).join('') : '<div class="empty">No secured eggs yet.</div>';
    ui.collection.innerHTML = state.insects.length ? [...state.insects].sort((a,b)=>rarityValue(b.rarity)-rarityValue(a.rarity)).map(b=>`<div class="bugCard ${state.selectedFusion.includes(b.id)?'selected':''}" data-bug="${b.id}"><div style="font-size:22px">🐜</div><div class="meta"><strong>${escapeHtml(b.name)}</strong><span class="rarity ${b.rarity}">${b.rarity}</span></div><button type="button" data-select="${b.id}">${state.selectedFusion.includes(b.id)?'Selected':'Select'}</button></div>`).join('') : '<div class="empty">No insects yet. Hatch some eggs!</div>';
    ui.fusionSelection.textContent=`${state.selectedFusion.length} / 2 selected${state.selectedFusion.length===2 ? ` • Cost: ${fusionCost(state.insects.find(b=>b.id===state.selectedFusion[0])?.rarity||'Common')} Rubies` : ''}`;
    ui.fuseBtn.disabled=state.selectedFusion.length!==2;
    ui.statStolen.textContent=state.stats.stolen; ui.statHatched.textContent=state.stats.hatched; ui.statFused.textContent=state.stats.fused; ui.statBest.textContent=rarityOrder[state.stats.best]||'Common';
  }

  ui.eggStorage.addEventListener('click',e=>{ const id=e.target.dataset.hatch; if(id) hatchEgg(id); });
  ui.collection.addEventListener('click',e=>{ const id=e.target.dataset.select; if(id) toggleFusion(id); });
  ui.rubyBtn.addEventListener('click',claimRubies); ui.fuseBtn.addEventListener('click',fuseSelected); ui.clearFusionBtn.addEventListener('click',()=>{state.selectedFusion=[];updateUI();}); ui.interactBtn.addEventListener('click',stealNearest);
  ui.modalClose.addEventListener('click',()=>ui.modal.classList.add('hidden'));
  ui.resetBtn.addEventListener('click',()=>showModal('Reset Save?','<p>This deletes Rubies, eggs, insects, and records on this device.</p>',()=>{ localStorage.removeItem('saie_save_v1'); state.rubies=0;state.eggs=[];state.insects=[];state.carrying=null;state.selectedFusion=[];state.stats={stolen:0,hatched:0,fused:0,best:0};updateUI(); },'RESET'));

  window.addEventListener('keydown',e=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)) e.preventDefault(); state.keys[e.key.toLowerCase()]=true; if(e.key==='e'||e.key==='E'||e.key===' ') stealNearest(); });
  window.addEventListener('keyup',e=>state.keys[e.key.toLowerCase()]=false);
  document.querySelectorAll('[data-dir]').forEach(btn=>{
    const dir=btn.dataset.dir; const on=e=>{e.preventDefault();state.touch[dir]=true;}; const off=e=>{e.preventDefault();state.touch[dir]=false;};
    btn.addEventListener('pointerdown',on); btn.addEventListener('pointerup',off); btn.addEventListener('pointercancel',off); btn.addEventListener('pointerleave',off);
  });

  function update(dt){
    let dx=0,dy=0; const k=state.keys,t=state.touch;
    if(k['w']||k['arrowup']||t.up)dy--; if(k['s']||k['arrowdown']||t.down)dy++; if(k['a']||k['arrowleft']||t.left)dx--; if(k['d']||k['arrowright']||t.right)dx++;
    if(dx||dy){ const l=Math.hypot(dx,dy)||1; state.player.x+=dx/l*state.player.speed*dt; state.player.y+=dy/l*state.player.speed*dt; }
    state.player.x=Math.max(30,Math.min(WORLD.w-30,state.player.x)); state.player.y=Math.max(30,Math.min(WORLD.h-30,state.player.y));
    returnHome();
    for(const sp of state.spawnEggs){ if(!sp.active && Date.now()>=sp.respawnAt){ sp.active=true; sp.rarity=weightedRarity(sp.base==null?['Common','Uncommon','Rare','Epic']:bases[sp.base].eggBias); } }
    if(Date.now()>=state.eventEndsAt) chooseEvent();
    const remain=Math.max(0,Math.ceil((state.eventEndsAt-Date.now())/1000)); ui.eventTimer.textContent=`${remain}s`;
    const cd=Math.max(0,(state.rubyReadyAt-Date.now())/1000); ui.rubyBtn.disabled=cd>0; ui.rubyCooldown.textContent=cd>0?`Ready in ${cd.toFixed(1)}s`:'Reusable every 3 seconds.';
  }

  function draw(){
    const viewW=canvas.width,viewH=canvas.height;
    state.camera.x=Math.max(0,Math.min(WORLD.w-viewW,state.player.x-viewW/2)); state.camera.y=Math.max(0,Math.min(WORLD.h-viewH,state.player.y-viewH/2));
    ctx.clearRect(0,0,viewW,viewH); ctx.save(); ctx.translate(-state.camera.x,-state.camera.y);
    ctx.fillStyle='#16342d';ctx.fillRect(0,0,WORLD.w,WORLD.h);
    // paths
    ctx.strokeStyle='#2c594d';ctx.lineWidth=90;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(300,750);ctx.lineTo(800,300);ctx.lineTo(1600,250);ctx.lineTo(2050,1080);ctx.lineTo(1200,1120);ctx.lineTo(650,1180);ctx.stroke();
    // home
    ctx.fillStyle='#285d42';ctx.fillRect(home.x,home.y,home.w,home.h);ctx.strokeStyle='#7af0a5';ctx.lineWidth=5;ctx.strokeRect(home.x,home.y,home.w,home.h);ctx.fillStyle='#eafff1';ctx.font='bold 34px system-ui';ctx.fillText('HOME BASE',home.x+38,home.y+55);ctx.font='18px system-ui';ctx.fillText('Bring stolen eggs here',home.x+48,home.y+86);
    // bases
    bases.forEach(b=>{ ctx.fillStyle=b.color;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=4;ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.fillStyle='white';ctx.font='bold 25px system-ui';ctx.fillText(b.name,b.x+18,b.y+38); });
    // rocks/decoration
    ctx.fillStyle='rgba(0,0,0,.12)'; for(let i=0;i<70;i++){ const x=(i*173)%WORLD.w,y=(i*97+220)%WORLD.h; ctx.beginPath();ctx.arc(x,y,8+(i%6),0,Math.PI*2);ctx.fill(); }
    // eggs
    state.spawnEggs.forEach(sp=>{ if(!sp.active)return; const c=rarityColors[sp.rarity]; ctx.fillStyle=c; ctx.beginPath();ctx.ellipse(sp.x,sp.y,18,25,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#101820';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText(sp.rarity,sp.x,sp.y+42);ctx.textAlign='left'; });
    // player
    ctx.fillStyle='#f5f8fb';ctx.beginPath();ctx.arc(state.player.x,state.player.y,state.player.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#16222c';ctx.lineWidth=5;ctx.stroke();
    ctx.fillStyle='#1c2832';ctx.beginPath();ctx.arc(state.player.x-8,state.player.y-4,3,0,Math.PI*2);ctx.arc(state.player.x+8,state.player.y-4,3,0,Math.PI*2);ctx.fill();
    if(state.carrying){ const c=rarityColors[state.carrying.rarity];ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(state.player.x,state.player.y-47,15,21,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.stroke(); }
    ctx.restore();
    // mini map
    const mw=190,mh=118,mx=viewW-mw-12,my=12;ctx.fillStyle='rgba(7,12,16,.78)';ctx.fillRect(mx,my,mw,mh);ctx.strokeStyle='#506477';ctx.strokeRect(mx,my,mw,mh);
    for(const b of bases){ctx.fillStyle=b.color;ctx.fillRect(mx+b.x/WORLD.w*mw,my+b.y/WORLD.h*mh,Math.max(5,b.w/WORLD.w*mw),Math.max(4,b.h/WORLD.h*mh));}
    ctx.fillStyle='#7af0a5';ctx.fillRect(mx+home.x/WORLD.w*mw,my+home.y/WORLD.h*mh,home.w/WORLD.w*mw,home.h/WORLD.h*mh);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mx+state.player.x/WORLD.w*mw,my+state.player.y/WORLD.h*mh,3,0,Math.PI*2);ctx.fill();
  }

  function loop(ts){ const dt=Math.min(.04,(ts-state.lastTs)/1000);state.lastTs=ts;update(dt);draw();requestAnimationFrame(loop); }

  load(); initSpawns(); chooseEvent(); updateUI(); requestAnimationFrame(loop);
})();
