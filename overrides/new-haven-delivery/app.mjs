import {DATA} from './data.mjs';
import {parseRoute,evaluate,clock,money,project,assignVisit,moveVisit} from './model.mjs?v=sequence2';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',storageKey='mgt809-delivery-v1';
let stage='base',result=null,baseline=null,selectedStop=null,playing=false,raf=0,playStart=0;
let swapId=null,dragIndex=null,dropIndex=null,pointerDrag=null;const history=[];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=1)=>Number(n).toFixed(d);
function save(){try{localStorage.setItem(storageKey,JSON.stringify({route:result?.route??null,baseline:baseline?.route??null}));}catch{}}
function svg(tag,attrs,text){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function showStop(id){selectedStop=id;document.querySelectorAll('#stop-markers .stop').forEach(el=>el.classList.toggle('stop-selected',Number(el.dataset.stopId)===id));const s=DATA.stops[id];$('map-info').textContent=`${id===0?'Kitchen':`Stop ${id}`}: ${s.name} · ${s.address}${id&&stage==='extension'?` · Arrive by ${clock(s.deadlineMinutes)} · Late refund ${money(s.refund)}`:''}`;}
function drawMap(){
  stopPlayback();const lines=$('route-lines');lines.replaceChildren();
  if(result){for(let i=1;i<result.path.length;i++){const a=project(DATA.stops[result.path[i-1]]),b=project(DATA.stops[result.path[i]]);lines.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'white','stroke-width':8,opacity:.9}));lines.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#00356b','stroke-width':3.4,'marker-end':'url(#route-arrow)',opacity:.85}));}}
  const markers=$('stop-markers');markers.replaceChildren();
  const offset={1:[23,-19],2:[-22,12],6:[-22,10],7:[-18,-10],8:[16,-16],9:[24,16]};
  DATA.stops.forEach(s=>{const p=project(s),off=offset[s.id]??[0,0],x=p.x+off[0],y=p.y+off[1];const urgent=stage==='extension'&&s.id&&s.deadlineMinutes===720;
    if(off[0]||off[1]){markers.append(svg('line',{x1:p.x,y1:p.y,x2:x,y2:y,stroke:'#465e72','stroke-width':1.5}));markers.append(svg('circle',{cx:p.x,cy:p.y,r:3,fill:'#00356b'}));}
    const g=svg('g',{class:'stop','data-stop-id':s.id,role:'button',tabindex:0,'aria-label':`${s.id===0?'Kitchen':`Stop ${s.id}`}: ${s.name}${urgent?', noon deadline':''}`});
    g.append(svg('circle',{cx:x,cy:y,r:s.id===0?20:17,fill:urgent?'#975915':'#00356b',stroke:'white','stroke-width':3}));
    g.append(svg('text',{x,y:y+7,'text-anchor':'middle',class:'stop-label'},s.id));
    const t=svg('title',{},`${s.name} · ${s.address}`);g.append(t);g.addEventListener('click',()=>showStop(s.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showStop(s.id);}});markers.append(g);
    if(s.id===0)markers.append(svg('text',{x:x+29,y:y+7,class:'stop-name'},'Kitchen'));
  });
  $('play-route').disabled=!result;$('map').setAttribute('aria-label',result?`New Haven route: kitchen, ${result.route.map(id=>DATA.stops[id].name).join(', ')}, kitchen`:'New Haven map with the kitchen and 12 delivery stops');
  if(selectedStop!==null)showStop(selectedStop);
}
function renderTable(){
  const ext=stage==='extension';
  const headings=ext?['Order','Location','Drive (min)','Road miles','Arrival','Deadline','Late (min)','Refund']:['Order','Location','From stop','Drive (min)','Road miles'];
  $('route-thead').innerHTML='<tr>'+headings.map(h=>`<th scope="col">${h}</th>`).join('')+'</tr>';
  $('route-tbody').innerHTML=result.rows.map(r=>{const s=DATA.stops[r.id];const cells=ext?[r.id===0?'Return':r.order,`${r.id} · ${s.name}`,num(r.driveMinutes),num(r.miles,2),clock(r.arrival,true),r.id?clock(s.deadlineMinutes):'—',r.id?num(r.lateMinutes):'—',money(r.refund)]:[r.id===0?'Return':r.order,`${r.id} · ${s.name}`,r.from,num(r.driveMinutes),num(r.miles,2)];return`<tr class="${r.id===0?'return-row':r.lateMinutes>1e-9&&ext?'late':''}">${cells.map((v,i)=>`<td${ext&&i===6?' class="late-value"':''}>${escape(v)}</td>`).join('')}</tr>`;}).join('');
  $('route-tfoot').innerHTML=ext?`<tr><td colspan="2">Totals</td><td>${num(result.driveMinutes)}</td><td>${num(result.miles,2)}</td><td colspan="2">${result.lateCount} late deliveries</td><td>${num(result.totalLateMinutes)}</td><td>${money(result.refunds)}</td></tr>`:`<tr><td colspan="3">Totals</td><td>${num(result.driveMinutes)}</td><td>${num(result.miles,2)}</td></tr>`;
  $('table-help').textContent=ext?'Arrival times retain seconds. A stop arriving exactly at its deadline is on time. Each late stop incurs its listed refund once.':'Every leg is included, from the kitchen departure through the return. Times come from the driving-minutes matrix.';
}
function renderComparison(){
  $('comparison').hidden=!(baseline&&result);$('baseline-status').textContent=baseline?'A route is saved for comparison on this browser.':'';
  if(!baseline||!result)return;
  const ext=stage==='extension';const rows=[['Driving time',num(baseline.driveMinutes)+' min',num(result.driveMinutes)+' min']];
  if(ext)rows.push(['Late deliveries',baseline.lateCount,result.lateCount],['Refunds',money(baseline.refunds),money(result.refunds)],['Total delivery cost',money(baseline.totalCost),money(result.totalCost)]);
  else rows.push(['Road distance',num(baseline.miles,2)+' mi',num(result.miles,2)+' mi']);
  $('comparison-body').innerHTML=rows.map(([h,a,b])=>`<tr><th scope="row">${h}</th><td>${a}</td><td>${b}</td></tr>`).join('');
  const diff=ext?(Math.round(result.totalCost*100)-Math.round(baseline.totalCost*100))/100:result.driveMinutes-baseline.driveMinutes;
  $('comparison-summary').textContent=Math.abs(diff)<(ext?.005:.05)?'The current route has the same '+(ext?'delivery cost.':'driving time.'):`The current route ${ext?'costs':'takes'} ${ext?money(Math.abs(diff)):num(Math.abs(diff))+' minutes'} ${diff>0?'more':'less'} than your saved route.`;
}
const startingRoute=DATA.stops.slice(1).map(s=>s.id);
function buildSequence(){
  $('sequence-slots').innerHTML=startingRoute.map((_,i)=>`<li class="sequence-slot" data-position="${i}"><button class="drag-handle" type="button" data-position="${i}" title="Drag to reorder; use arrow keys to move" aria-label="Reorder visit ${i+1} with arrow keys">⠿</button><span class="visit-position">x<sub>${i+1}</sub></span><button type="button" class="stop-choice" data-position="${i}" aria-describedby="sequence-help" aria-pressed="false"><span class="stop-id"></span><span class="stop-title"></span></button><div class="move-buttons"><button type="button" data-position="${i}" data-step="-1" title="Move earlier" aria-label="Move visit ${i+1} earlier" ${i===0?'disabled':''}>↑</button><button type="button" data-position="${i}" data-step="1" title="Move later" aria-label="Move visit ${i+1} later" ${i===11?'disabled':''}>↓</button></div></li>`).join('');
}
function renderSelection(){
  document.querySelectorAll('.sequence-slot').forEach((row,i)=>{
    const selected=result?.route[i]===swapId;
    row.classList.toggle('selected',selected);row.querySelector('.stop-choice').setAttribute('aria-pressed',String(selected));
  });
  $('swap-status').textContent=swapId===null?'Every stop appears exactly once.':`Stop ${swapId} selected. Click another stop to swap; Esc cancels.`;
}
function renderSequence(){
  if(!result)return;
  result.route.forEach((id,i)=>{const row=$('sequence-slots').children[i];row.querySelector('.stop-id').textContent=id;row.querySelector('.stop-title').textContent=DATA.stops[id].name;row.querySelector('.stop-choice').setAttribute('aria-label',`Visit ${i+1}: stop ${id}, ${DATA.stops[id].name}. Select to swap`);});
  $('sequence-minutes').textContent=num(result.driveMinutes);$('sequence-path').textContent=result.path.join(' → ');$('undo-sequence').disabled=!history.length;renderSelection();
}
function applySequence(route,message,record=true){
  const previous=result?.driveMinutes;
  if(record&&result&&route.some((id,i)=>id!==result.route[i])){history.push([...result.route]);if(history.length>50)history.shift();}
  swapId=null;result=evaluate(route);$('route-input').value=route.join(' ');
  $('route-error').hidden=true;$('route-input').removeAttribute('aria-invalid');
  const difference=previous===undefined?0:Math.round((result.driveMinutes-previous)*10)/10;
  const impact=previous===undefined?'':difference===0?'Travel time unchanged.':`${num(Math.abs(difference))} min ${difference>0?'more':'less'} than before.`;
  $('sequence-feedback').textContent=impact+' '+message;$('sequence-feedback').dataset.change=difference>0?'up':difference<0?'down':'same';
  save();render();
}
function moveStop(from,to,focusSelector){
  if(to<0||to>=12||from===to)return;
  const id=result.route[from];selectedStop=id;
  applySequence(moveVisit(result.route,from,to),`Stop ${id}: visit ${from+1} → ${to+1}.`);
  if(focusSelector)$('sequence-slots').children[to].querySelector(focusSelector)?.focus({preventScroll:true});
}
$('sequence-slots').addEventListener('click',e=>{
  const choice=e.target.closest('.stop-choice');
  if(choice){const index=Number(choice.dataset.position),id=result.route[index];
    if(swapId===null){swapId=id;showStop(id);renderSelection();}
    else if(swapId===id){swapId=null;renderSelection();}
    else{const from=result.route.indexOf(swapId),other=swapId;selectedStop=other;applySequence(assignVisit(result.route,index,other),`Swapped visits ${from+1} and ${index+1}.`);}
    return;
  }
  const button=e.target.closest('button[data-step]');if(!button||button.disabled)return;
  const from=Number(button.dataset.position),step=Number(button.dataset.step),to=from+step;
  const direction=to===0?1:to===11?-1:step;
  moveStop(from,to,`button[data-step="${direction}"]`);
});
$('sequence-slots').addEventListener('keydown',e=>{
  if(e.key==='Escape'){clearDrag();swapId=null;renderSelection();return;}
  if(!e.target.matches('.drag-handle')||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const from=Number(e.target.dataset.position),to=e.key==='Home'?0:e.key==='End'?11:from+(e.key==='ArrowUp'?-1:1);moveStop(from,to,'.drag-handle');
});
function clearDrag(){
  if(pointerDrag){pointerDrag.ghost?.remove();if(pointerDrag.handle.hasPointerCapture(pointerDrag.pointerId))pointerDrag.handle.releasePointerCapture(pointerDrag.pointerId);}
  pointerDrag=null;dragIndex=null;dropIndex=null;document.querySelectorAll('.sequence-slot').forEach(row=>row.classList.remove('dragging','drop-before','drop-after'));
}
$('sequence-slots').addEventListener('pointerdown',e=>{
  const handle=e.target.closest('.drag-handle');if(!handle||e.button!==0)return;
  const row=handle.closest('.sequence-slot');pointerDrag={pointerId:e.pointerId,handle,row,startX:e.clientX,startY:e.clientY,active:false,ghost:null};dragIndex=Number(row.dataset.position);dropIndex=dragIndex;handle.setPointerCapture(e.pointerId);
});
$('sequence-slots').addEventListener('pointermove',e=>{
  if(!pointerDrag||e.pointerId!==pointerDrag.pointerId)return;
  if(!pointerDrag.active){if(Math.hypot(e.clientX-pointerDrag.startX,e.clientY-pointerDrag.startY)<5)return;
    pointerDrag.active=true;swapId=null;renderSelection();pointerDrag.row.classList.add('dragging');
    const ghost=pointerDrag.row.cloneNode(true);ghost.classList.remove('dragging');ghost.classList.add('drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.style.width=pointerDrag.row.getBoundingClientRect().width+'px';document.body.append(ghost);pointerDrag.ghost=ghost;
  }
  e.preventDefault();pointerDrag.ghost.style.left=(e.clientX-12)+'px';pointerDrag.ghost.style.top=(e.clientY-19)+'px';
  const row=document.elementFromPoint(e.clientX,e.clientY)?.closest('.sequence-slot');
  document.querySelectorAll('#sequence-slots .sequence-slot').forEach(el=>el.classList.remove('drop-before','drop-after'));
  if(!row||!$('sequence-slots').contains(row)){dropIndex=null;return;}
  const index=Number(row.dataset.position),rect=row.getBoundingClientRect(),after=e.clientY>rect.top+rect.height/2;
  let insertion=index+(after?1:0);if(dragIndex<insertion)insertion--;dropIndex=Math.max(0,Math.min(11,insertion));
  if(dropIndex!==dragIndex)row.classList.add(after?'drop-after':'drop-before');
});
$('sequence-slots').addEventListener('pointerup',e=>{
  if(!pointerDrag||e.pointerId!==pointerDrag.pointerId)return;const from=dragIndex,to=dropIndex,active=pointerDrag.active;clearDrag();if(active&&to!==null)moveStop(from,to,'.drag-handle');
});
$('sequence-slots').addEventListener('pointercancel',clearDrag);
$('undo-sequence').addEventListener('click',()=>{const previous=history.pop();if(previous)applySequence(previous,'Undid the last change.',false);});
$('reset-sequence').addEventListener('click',()=>applySequence(startingRoute,'Reset to starting order 1–12.'));
function render(){
  const ext=stage==='extension';$('cost-headline').hidden=!ext;$('results').hidden=!result;$('empty-results').hidden=!!result;$('route-details').hidden=!result;
  if(result){$('route-status').textContent='Valid route · all 12 stops visited once';$('main-label').textContent=ext?'Total delivery cost':'Total driving time';$('main-value').textContent=ext?money(result.totalCost):num(result.driveMinutes);$('main-unit').textContent=ext?'driver + mileage + late refunds':'minutes, including return';$('base-metrics').hidden=ext;$('cost-metrics').hidden=!ext;$('distance').textContent=num(result.miles,2)+' miles';$('driver-cost').textContent=money(result.driverCost);$('vehicle-cost').textContent=money(result.vehicleCost);$('refund-cost').textContent=money(result.refunds);$('late-count').textContent=result.lateCount+' of 12';$('return-time').textContent=clock(result.returnMinutes,true);renderTable();}
  renderSequence();drawMap();renderComparison();
}
function setStage(next){stage=next;const ext=stage==='extension';for(const button of document.querySelectorAll('[data-stage]')){const active=button.dataset.stage===stage;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}$('exercise').setAttribute('aria-labelledby','tab-'+stage);$('base-brief').hidden=ext;$('extension-brief').hidden=!ext;$('deadline-legend').hidden=!ext;$('discussion-title').textContent=ext?'Is the fastest route also the cheapest?':'Same stops. Different sequence.';$('discussion-text').textContent=ext?'Compare your base route with your new solution. Which deliveries triggered refunds? Would a little extra driving avoid a larger late-delivery cost?':'Which change reduced the travel time? Your decision variables are the 12 visit positions. Can you find a better sequence by hand, and can Evolutionary Solver improve it further?';render();}
document.querySelectorAll('[data-stage]').forEach((b,i)=>{b.addEventListener('click',()=>setStage(b.dataset.stage));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;const tab=document.querySelectorAll('[data-stage]')[next];setStage(tab.dataset.stage);tab.focus();}});});
$('route-form').addEventListener('submit',e=>{e.preventDefault();try{applySequence(parseRoute($('route-input').value),'Loaded your Excel sequence.');}catch(error){$('route-error').textContent=error.message+' The displayed sequence has not changed.';$('route-error').hidden=false;$('route-input').setAttribute('aria-invalid','true');$('route-input').focus();}});
$('clear-route').addEventListener('click',()=>{$('route-input').value='';$('route-error').hidden=true;$('route-input').removeAttribute('aria-invalid');$('route-input').focus();});
$('save-baseline').addEventListener('click',()=>{if(!result)return;baseline=evaluate(result.route);save();renderComparison();});
$('clear-baseline').addEventListener('click',()=>{baseline=null;save();renderComparison();});
function stopPlayback(){playing=false;cancelAnimationFrame(raf);$('van').setAttribute('hidden','');$('play-route').textContent='▶ Play visit order';$('play-status').textContent='Kitchen = 0';}
$('play-route').addEventListener('click',()=>{if(playing){stopPlayback();return;}if(!result)return;playing=true;playStart=performance.now();$('van').removeAttribute('hidden');$('play-route').textContent='■ Stop playback';const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now){if(!playing)return;const at=(now-playStart)/850,index=Math.min(result.path.length-2,Math.floor(at)),fraction=Math.min(1,at-index),a=project(DATA.stops[result.path[index]]),b=project(DATA.stops[result.path[index+1]]);const t=reduced?(fraction>.5?1:0):fraction;$('van').setAttribute('transform',`translate(${a.x+(b.x-a.x)*t},${a.y+(b.y-a.y)*t})`);$('play-status').textContent=`${result.path[index]} → ${result.path[index+1]} · ${DATA.stops[result.path[index+1]].short}`;if(at>=result.path.length-1){playing=false;$('play-route').textContent='↻ Replay visit order';$('play-status').textContent='Back at the kitchen';return;}raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
$('export-route').addEventListener('click',()=>{if(!result)return;const quote=v=>'"'+String(v).replaceAll('"','""')+'"';const ext=stage==='extension';const rows=[['Order','Stop ID','Location','Driving minutes','Road miles',...(ext?['Arrival','Deadline','Minutes late','Refund']:[])],...result.rows.map(r=>[r.id===0?'Return':r.order,r.id,DATA.stops[r.id].name,num(r.driveMinutes),num(r.miles,2),...(ext?[clock(r.arrival,true),r.id?clock(DATA.stops[r.id].deadlineMinutes):'',num(r.lateMinutes),num(r.refund,2)]:[])])];rows.push([],['Total driving minutes',num(result.driveMinutes)],['Total road miles',num(result.miles,2)]);if(ext)rows.push(['Driver cost',num(result.driverCost,2)],['Mileage cost',num(result.vehicleCost,2)],['Refunds',num(result.refunds,2)],['Total delivery cost',num(result.totalCost,2)]);const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`new-haven-${stage}-route.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('stop-data').innerHTML=DATA.stops.map(s=>`<tr><td>${s.id}</td><td>${escape(s.name)}</td><td>${escape(s.address)}</td><td>${s.serviceMinutes} min</td><td>${s.id?clock(s.deadlineMinutes):'—'}</td><td>${s.id?money(s.refund):'—'}</td></tr>`).join('');
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved?.route)){result=evaluate(saved.route);$('route-input').value=result.route.join(' ');}if(Array.isArray(saved?.baseline))baseline=evaluate(saved.baseline);}catch{result=null;baseline=null;}
buildSequence();
if(!result){result=evaluate(startingRoute);$('route-input').value=startingRoute.join(' ');}else{$('sequence-feedback').textContent='Your saved sequence is loaded. Drag a stop or use ↑ ↓ to try another order.';}
setStage('base');
