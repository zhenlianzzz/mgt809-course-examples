import {DATA} from './data.mjs?v=cost2';
import {parseRoute,evaluate,clock,money,project,assignVisit,moveVisit,appendVisit} from './model.mjs?v=cost2';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg',storageKey='mgt809-delivery-v1';
let stage='base',result=null,baseline=null,selectedStop=null,playing=false,raf=0,playStart=0;
let swapId=null,dragIndex=null,dropIndex=null,pointerDrag=null;const history=[];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=1)=>Number(n).toFixed(d);
function save(){try{localStorage.setItem(storageKey,JSON.stringify({route:result?.route??null,baseline:baseline?.route??null}));}catch{}}
function svg(tag,attrs,text){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function showStop(id){selectedStop=id;document.querySelectorAll('#stop-markers .stop').forEach(el=>el.classList.toggle('stop-selected',Number(el.dataset.stopId)===id));const s=DATA.stops[id];$('map-info').textContent=`${id===0?'Kitchen':`Stop ${id}`}: ${s.name} · ${s.address}${id&&stage==='extension'?` · Arrive by ${clock(s.deadlineMinutes)} · Late refund ${money(s.refund)}`:''}`;}
function mapStop(id){
  if(id===0){showStop(id);$('sequence-feedback').textContent=result.complete?'The route starts and ends at the kitchen.':'Start at the kitchen. Click an unchosen delivery stop; the return is added after all 12 visits.';return;}
  if(result.complete){selectForSwap(id);return;}
  const position=result.route.indexOf(id);
  if(position!==-1){showStop(id);$('sequence-feedback').textContent=`Stop ${id} is already visit ${position+1}. Choose a different stop, or Undo the last choice.`;return;}
  const from=result.route.at(-1)??0,leg=DATA.minutes[from][id];selectedStop=id;
  const next=appendVisit(result.route,id),message=next.length===12?`All 12 stops chosen. Added ${num(leg)} min to stop ${id} and ${num(DATA.minutes[id][0])} min back to the kitchen.`:`Visit ${next.length}: ${DATA.stops[id].name}. Added ${num(leg)} min from ${from===0?'the kitchen':`stop ${from}`}.`;
  applySequence(next,message);
}
function selectForSwap(id){
  if(swapId===null){swapId=id;showStop(id);renderSelection();}
  else if(swapId===id){swapId=null;renderSelection();}
  else{const from=result.route.indexOf(swapId),index=result.route.indexOf(id),other=swapId;selectedStop=other;applySequence(assignVisit(result.route,index,other),`Swapped visits ${from+1} and ${index+1}.`);}
}
const markerOffset={1:[23,-19],2:[-22,12],6:[-22,10],7:[-18,-10],8:[16,-16],9:[24,16]};
function drawLegLabels(){
  let labels=$('leg-labels');if(!labels){labels=svg('g',{id:'leg-labels','pointer-events':'none'});$('map').insertBefore(labels,$('stop-markers'));}labels.replaceChildren();
  if(!result?.rows.length)return;
  const box=$('map').getBoundingClientRect(),scale=Math.min(box.width/1120,box.height/850)||1;
  const font=(box.width<500?11:12)/scale,height=23/scale,padding=10/scale,placed=[];
  const stops=DATA.stops.map(s=>{const p=project(s),o=markerOffset[s.id]??[0,0];return{x:p.x+o[0],y:p.y+o[1],r:28};});
  const overlap=(a,b,gap=0)=>Math.max(0,Math.min(a.x+a.w+gap,b.x+b.w)-Math.max(a.x-gap,b.x))*Math.max(0,Math.min(a.y+a.h+gap,b.y+b.h)-Math.max(a.y-gap,b.y));
  result.rows.forEach((leg,index)=>{
    const a=project(DATA.stops[leg.from]),b=project(DATA.stops[leg.id]),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
    const text=num(leg.driveMinutes)+' min',width=text.length*font*.57+padding*2;
    let best=null;
    for(const fraction of [.5,.35,.65,.2,.8])for(const distance of [0,20,-20,38,-38,58,-58,82,-82,110,-110,145,-145]){
      const anchor={x:a.x+dx*fraction,y:a.y+dy*fraction},shift=distance/scale;
      const x=anchor.x-dy/length*shift,y=anchor.y+dx/length*shift,rect={x:Math.max(8,Math.min(1112-width,x-width/2)),y:Math.max(8,Math.min(842-height,y-height/2)),w:width,h:height};
      const collisions=stops.reduce((sum,p)=>sum+overlap(rect,{x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2},6/scale),0)+placed.reduce((sum,p)=>sum+overlap(rect,p,5/scale),0);
      const outside=Math.max(0,8-rect.x)+Math.max(0,rect.x+width-1112)+Math.max(0,8-rect.y)+Math.max(0,rect.y+height-842);
      const score=collisions*100+outside*10000+Math.abs(distance)*2+Math.abs(fraction-.5)*45;
      if(!best||score<best.score)best={...rect,anchor,score,distance,collisions};
    }
    // Very short, crowded legs may need a callout outside the segment's normal axis.
    if(best.collisions){
      for(let y=8;y+height<842;y+=height+7/scale)for(let x=8;x+width<1112;x+=width/2){
        const rect={x,y,w:width,h:height},cx=x+width/2,cy=y+height/2;
        const fraction=Math.max(.1,Math.min(.9,((cx-a.x)*dx+(cy-a.y)*dy)/(length*length))),anchor={x:a.x+dx*fraction,y:a.y+dy*fraction};
        const collisions=stops.reduce((sum,p)=>sum+overlap(rect,{x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2},6/scale),0)+placed.reduce((sum,p)=>sum+overlap(rect,p,5/scale),0);
        const distance=Math.hypot(cx-anchor.x,cy-anchor.y)*scale,score=collisions*100+distance*2+Math.abs(fraction-.5)*45;
        if(score<best.score)best={...rect,anchor,score,distance,collisions};
      }
    }
    placed.push(best);const latest=index===result.rows.length-1;
    const group=svg('g',{class:'leg-label'+(latest?' latest-leg':''),'data-from':leg.from,'data-to':leg.id,'data-minutes':num(leg.driveMinutes),role:'img','aria-label':`${leg.from===0?'Kitchen':`Stop ${leg.from}`} to ${leg.id===0?'kitchen':`stop ${leg.id}`}: ${text}`});
    if(best.distance){const endX=Math.max(best.x,Math.min(best.x+width,best.anchor.x)),endY=Math.max(best.y,Math.min(best.y+height,best.anchor.y));group.append(svg('line',{class:'leg-leader',x1:best.anchor.x,y1:best.anchor.y,x2:endX,y2:endY,'stroke-width':1/scale}));group.append(svg('circle',{class:'leg-anchor',cx:best.anchor.x,cy:best.anchor.y,r:2/scale}));}
    group.append(svg('rect',{x:best.x,y:best.y,width,height,rx:5/scale,'stroke-width':1/scale}));
    group.append(svg('text',{x:best.x+width/2,y:best.y+height/2,'text-anchor':'middle','dominant-baseline':'central','font-size':font},text));labels.append(group);
  });
}
function renderTravelSum(){
  $('travel-sum').hidden=!result.rows.length;
  $('travel-sum').innerHTML=result.rows.map((leg,i)=>`${i?'<span class="sum-plus" aria-hidden="true">+</span>':''}<span class="sum-term${i===result.rows.length-1?' latest-term':''}" title="${leg.from} → ${leg.id}${leg.id===0?' (return to kitchen)':''}">${num(leg.driveMinutes)}</span>`).join('')+`<span class="sum-equals">= <b>${num(result.driveMinutes)} min</b></span>`;
  $('travel-sum').setAttribute('aria-label',result.rows.length?`${result.rows.map(r=>num(r.driveMinutes)).join(' plus ')} equals ${num(result.driveMinutes)} minutes`:'');
}
let labelResizeFrame=0;
new ResizeObserver(()=>{cancelAnimationFrame(labelResizeFrame);labelResizeFrame=requestAnimationFrame(drawLegLabels);}).observe($('map'));
function drawMap(){
  stopPlayback();const lines=$('route-lines');lines.replaceChildren();
  if(result){for(let i=1;i<result.path.length;i++){const a=project(DATA.stops[result.path[i-1]]),b=project(DATA.stops[result.path[i]]);lines.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'white','stroke-width':8,opacity:.9}));lines.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#00356b','stroke-width':3.4,'marker-end':'url(#route-arrow)',opacity:.85}));}}
  const markers=$('stop-markers');markers.replaceChildren();
  const offset=markerOffset;
  DATA.stops.forEach(s=>{const p=project(s),off=offset[s.id]??[0,0],x=p.x+off[0],y=p.y+off[1];const urgent=stage==='extension'&&s.id&&s.deadlineMinutes===720;
    if(off[0]||off[1]){markers.append(svg('line',{x1:p.x,y1:p.y,x2:x,y2:y,stroke:'#465e72','stroke-width':1.5}));markers.append(svg('circle',{cx:p.x,cy:p.y,r:3,fill:'#00356b'}));}
    const visit=result.route.indexOf(s.id),chosen=visit!==-1,last=s.id===(result.route.at(-1)??0);
    const action=s.id===0?'Kitchen: Long Wharf kitchen':result.complete?`Stop ${s.id}: ${s.name}. Visit ${visit+1}. Select to swap`:chosen?`Stop ${s.id}: ${s.name}. Already visit ${visit+1}`:`Add stop ${s.id}: ${s.name} as visit ${result.route.length+1}`;
    const g=svg('g',{class:`stop${chosen?' stop-chosen':''}${last&&!result.complete?' current-stop':''}`,'data-stop-id':s.id,role:'button',tabindex:0,'aria-label':action,'aria-disabled':String(chosen&&!result.complete)});
    g.append(svg('circle',{class:'stop-hit',cx:x,cy:y,r:26,fill:'transparent',stroke:'none'}));
    g.append(svg('circle',{cx:x,cy:y,class:'stop-dot',r:s.id===0?21:19,fill:chosen?'#2a745e':urgent?'#975915':'#00356b',stroke:'white','stroke-width':3}));
    g.append(svg('text',{x,y:y+7,'text-anchor':'middle',class:'stop-label'},s.id));
    const t=svg('title',{},`${s.name} · ${s.address}`);g.append(t);g.addEventListener('click',()=>mapStop(s.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mapStop(s.id);const next=$('stop-markers').querySelector(`[data-stop-id="${s.id}"]`);next?.focus({preventScroll:true});}});markers.append(g);
    if(s.id===0)markers.append(svg('text',{x:x+29,y:y+7,class:'stop-name'},'Kitchen'));
  });
  drawLegLabels();
  $('play-route').disabled=!result?.complete;$('map').setAttribute('aria-label',result?.route.length?`New Haven route: kitchen, ${result.route.map(id=>DATA.stops[id].name).join(', ')}${result.complete?', kitchen':'. Choose the next stop'}`:'New Haven map with the kitchen and 12 delivery stops');
  if(selectedStop!==null)showStop(selectedStop);else $('map-info').textContent=result.complete?'Click two locations to swap their visit positions.':result.route.length?'Click an unchosen location to add the next visit.':'Start at kitchen 0. Click your first delivery stop.';
}
function renderTable(){
  const ext=stage==='extension';
  const headings=ext?['Order','Location','Drive (min)','Arrival','Deadline','Late (min)','Refund']:['Order','Location','From stop','Drive (min)'];
  $('route-thead').innerHTML='<tr>'+headings.map(h=>`<th scope="col">${h}</th>`).join('')+'</tr>';
  $('route-tbody').innerHTML=result.rows.map(r=>{const s=DATA.stops[r.id];const cells=ext?[r.id===0?'Return':r.order,`${r.id} · ${s.name}`,num(r.driveMinutes),clock(r.arrival,true),r.id?clock(s.deadlineMinutes):'—',r.id?num(r.lateMinutes):'—',money(r.refund)]:[r.id===0?'Return':r.order,`${r.id} · ${s.name}`,r.from,num(r.driveMinutes)];return`<tr class="${r.id===0?'return-row':r.lateMinutes>1e-9&&ext?'late':''}">${cells.map((v,i)=>`<td${ext&&i===5?' class="late-value"':''}>${escape(v)}</td>`).join('')}</tr>`;}).join('');
  $('route-tfoot').innerHTML=ext?`<tr><td colspan="2">Totals</td><td>${num(result.driveMinutes)}</td><td colspan="2">${result.lateCount} late deliveries</td><td>${num(result.totalLateMinutes)}</td><td>${money(result.refunds)}</td></tr>`:`<tr><td colspan="3">Totals</td><td>${num(result.driveMinutes)}</td></tr>`;
  $('table-help').textContent=ext?'Arrival times retain seconds. A stop arriving exactly at its deadline is on time. Each late stop incurs its listed refund once.':'Every leg is included, from the kitchen departure through the return. Times come from the driving-minutes matrix.';
}
function renderComparison(){
  $('comparison').hidden=!(baseline&&result?.complete);$('baseline-status').textContent=baseline?'A route is saved for comparison on this browser.':'';
  if(!baseline||!result?.complete)return;
  const ext=stage==='extension';const rows=[['Driving time',num(baseline.driveMinutes)+' min',num(result.driveMinutes)+' min']];
  if(ext)rows.push(['Late deliveries',baseline.lateCount,result.lateCount],['Refunds',money(baseline.refunds),money(result.refunds)],['Total delivery cost',money(baseline.totalCost),money(result.totalCost)]);
  $('comparison-body').innerHTML=rows.map(([h,a,b])=>`<tr><th scope="row">${h}</th><td>${a}</td><td>${b}</td></tr>`).join('');
  const diff=ext?(Math.round(result.totalCost*100)-Math.round(baseline.totalCost*100))/100:result.driveMinutes-baseline.driveMinutes;
  $('comparison-summary').textContent=Math.abs(diff)<(ext?.005:.05)?'The current route has the same '+(ext?'delivery cost.':'driving time.'):`The current route ${ext?'costs':'takes'} ${ext?money(Math.abs(diff)):num(Math.abs(diff))+' minutes'} ${diff>0?'more':'less'} than your saved route.`;
}
const startingRoute=DATA.stops.slice(1).map(s=>s.id);
function buildSequence(){
  $('sequence-slots').innerHTML=startingRoute.map((_,i)=>`<li class="sequence-slot" data-position="${i}"><button class="drag-handle" type="button" data-position="${i}" title="Drag to reorder; use arrow keys to move" aria-label="Reorder visit ${i+1} with arrow keys">⠿</button><span class="visit-position">x<sub>${i+1}</sub></span><button type="button" class="stop-choice" data-position="${i}" aria-describedby="sequence-help" aria-pressed="false"><span class="stop-id"></span><span class="stop-title"></span></button><div class="move-buttons"><button type="button" data-position="${i}" data-step="-1" title="Move earlier" aria-label="Move visit ${i+1} earlier" ${i===0?'disabled':''}>↑</button><button type="button" data-position="${i}" data-step="1" title="Move later" aria-label="Move visit ${i+1} later" ${i===11?'disabled':''}>↓</button></div></li>`).join('');
}
function renderSelection(){
  document.querySelectorAll('#sequence-slots .sequence-slot').forEach((row,i)=>{
    const selected=result.route[i]===swapId;
    row.classList.toggle('selected',selected);row.querySelector('.stop-choice').setAttribute('aria-pressed',String(selected));
  });
  $('swap-status').textContent=swapId===null?(result.complete?'Every stop appears exactly once.':`${result.route.length} of 12 chosen · next choice fills x${result.route.length+1}.`):`Stop ${swapId} selected. Click another stop to swap; Esc cancels.`;
  $('map-step').textContent=swapId!==null?`Click another stop to swap with ${swapId}`:result.complete?'Route complete · all 12 stops chosen':`Click ${result.route.length?'the next':'your first'} location · visit ${result.route.length+1} of 12`;
  $('map-help').textContent=result.complete?'Click two map locations to swap, or draw a new route.':'Each click adds one visit. The return to the kitchen is added after visit 12.';
}
function renderSequence(){
  for(let i=0;i<12;i++){
    const row=$('sequence-slots').children[i],id=result.route[i],filled=id!==undefined;
    row.classList.toggle('unfilled',!filled);row.classList.toggle('next-visit',i===result.route.length);
    row.querySelector('.stop-id').textContent=filled?id:'·';row.querySelector('.stop-title').textContent=filled?DATA.stops[id].name:i===result.route.length?'Click a location on the map':'Not chosen yet';
    const choice=row.querySelector('.stop-choice');choice.disabled=!filled;choice.setAttribute('aria-label',filled?`Visit ${i+1}: stop ${id}, ${DATA.stops[id].name}. Select to swap`:`Visit ${i+1}: not chosen yet`);
    row.querySelector('.drag-handle').disabled=!filled;row.querySelector('[data-step="-1"]').disabled=!filled||i===0;row.querySelector('[data-step="1"]').disabled=!filled||i===result.route.length-1;
  }
  $('sequence-help').textContent=result.complete?'Click two stops to swap, drag to reorder, or use ↑ ↓.':'Click map locations in visit order. Your choices fill the positions below.';
  $('travel-label').textContent=result.complete?'Total travel time':'Travel so far';
  $('travel-help').textContent=result.complete?'Driving, including the return':'Driving to chosen stops · return not yet included';
  $('sequence-minutes').textContent=num(result.driveMinutes);$('sequence-path').textContent=result.path.join(' → ')+(result.complete?'':' → …');
  $('undo-sequence').disabled=!history.length&&(result.complete||!result.route.length);$('reset-sequence').disabled=!result.route.length;
  $('return-label').textContent=result.complete?'Return':'After visit 12';
  renderTravelSum();renderSelection();
}
function applySequence(route,message,record=true){
  const next=evaluate(route,{partial:true}),previous=result;
  if(record&&previous&&JSON.stringify(route)!==JSON.stringify(previous.route)){history.push([...previous.route]);if(history.length>50)history.shift();}
  swapId=null;result=next;$('route-input').value=route.join(' ');
  $('route-error').hidden=true;$('route-input').removeAttribute('aria-invalid');
  const difference=previous?.complete&&next.complete?Math.round((next.driveMinutes-previous.driveMinutes)*10)/10:null;
  const impact=difference===null?'':difference===0?'Travel time unchanged. ':`${num(Math.abs(difference))} min ${difference>0?'more':'less'} than before. `;
  $('sequence-feedback').textContent=impact+message;$('sequence-feedback').dataset.change=difference>0?'up':difference<0?'down':'same';
  save();render();
}
function moveStop(from,to,focusSelector){
  if(to<0||to>=result.route.length||from===to)return;
  const id=result.route[from];selectedStop=id;
  applySequence(moveVisit(result.route,from,to),`Stop ${id}: visit ${from+1} → ${to+1}.`);
  if(focusSelector)$('sequence-slots').children[to].querySelector(focusSelector)?.focus({preventScroll:true});
}
$('sequence-slots').addEventListener('click',e=>{
  const choice=e.target.closest('.stop-choice');
  if(choice){if(!choice.disabled)selectForSwap(result.route[Number(choice.dataset.position)]);return;}
  const button=e.target.closest('button[data-step]');if(!button||button.disabled)return;
  const from=Number(button.dataset.position),step=Number(button.dataset.step),to=from+step;
  const direction=to===0?1:to===result.route.length-1?-1:step;
  moveStop(from,to,`button[data-step="${direction}"]`);
});
$('sequence-slots').addEventListener('keydown',e=>{
  if(e.key==='Escape'){clearDrag();swapId=null;renderSelection();return;}
  if(!e.target.matches('.drag-handle')||!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
  e.preventDefault();const from=Number(e.target.dataset.position),to=e.key==='Home'?0:e.key==='End'?result.route.length-1:from+(e.key==='ArrowUp'?-1:1);moveStop(from,to,'.drag-handle');
});
function clearDrag(){
  if(pointerDrag){pointerDrag.ghost?.remove();if(pointerDrag.handle.hasPointerCapture(pointerDrag.pointerId))pointerDrag.handle.releasePointerCapture(pointerDrag.pointerId);}
  pointerDrag=null;dragIndex=null;dropIndex=null;document.querySelectorAll('.sequence-slot').forEach(row=>row.classList.remove('dragging','drop-before','drop-after'));
}
$('sequence-slots').addEventListener('pointerdown',e=>{
  const handle=e.target.closest('.drag-handle');if(!handle||handle.disabled||e.button!==0)return;
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
  if(!row||!$('sequence-slots').contains(row)||row.classList.contains('unfilled')){dropIndex=null;return;}
  const index=Number(row.dataset.position),rect=row.getBoundingClientRect(),after=e.clientY>rect.top+rect.height/2;
  let insertion=index+(after?1:0);if(dragIndex<insertion)insertion--;dropIndex=Math.max(0,Math.min(result.route.length-1,insertion));
  if(dropIndex!==dragIndex)row.classList.add(after?'drop-after':'drop-before');
});
$('sequence-slots').addEventListener('pointerup',e=>{
  if(!pointerDrag||e.pointerId!==pointerDrag.pointerId)return;const from=dragIndex,to=dropIndex,active=pointerDrag.active;clearDrag();if(active&&to!==null)moveStop(from,to,'.drag-handle');
});
$('sequence-slots').addEventListener('pointercancel',clearDrag);
$('undo-sequence').addEventListener('click',()=>{const previous=history.pop()??(!result.complete&&result.route.length?result.route.slice(0,-1):null);if(previous){selectedStop=previous.at(-1)??null;applySequence(previous,'Undid the last change.',false);}});
$('reset-sequence').addEventListener('click',()=>{selectedStop=null;applySequence([],'Start at kitchen 0. Click your first delivery stop.');});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){clearDrag();swapId=null;renderSelection();}});
function render(){
  const ext=stage==='extension',complete=result.complete;$('cost-headline').hidden=!ext||!complete;$('results').hidden=!complete;$('empty-results').hidden=true;$('route-details').hidden=!complete;
  if(complete){$('route-status').textContent='Valid route · all 12 stops visited once';$('main-label').textContent=ext?'Total delivery cost':'Total driving time';$('main-value').textContent=ext?money(result.totalCost):num(result.driveMinutes);$('main-unit').textContent=ext?'driver + late refunds':'minutes, including return';$('base-metrics').hidden=ext;$('cost-metrics').hidden=!ext;$('driver-cost').textContent=money(result.driverCost);$('driver-time').textContent=num(result.totalMinutes)+' min';$('refund-cost').textContent=money(result.refunds);$('late-count').textContent=result.lateCount+' of 12';$('return-time').textContent=clock(result.returnMinutes,true);renderTable();}
  renderSequence();drawMap();renderComparison();
}
function setStage(next){stage=next;const ext=stage==='extension';for(const button of document.querySelectorAll('[data-stage]')){const active=button.dataset.stage===stage;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}$('exercise').setAttribute('aria-labelledby','tab-'+stage);$('base-brief').hidden=ext;$('extension-brief').hidden=!ext;$('deadline-legend').hidden=!ext;$('discussion-title').textContent=ext?'Is the fastest route also the cheapest?':'Same stops. Different sequence.';$('discussion-text').textContent=ext?'Compare your base route with your new solution. Which deliveries triggered refunds? Would a little extra driving avoid a larger late-delivery cost?':'Which change reduced the travel time? Your decision variables are the 12 visit positions. Can you find a better sequence by hand, and can Evolutionary Solver improve it further?';render();}
document.querySelectorAll('[data-stage]').forEach((b,i)=>{b.addEventListener('click',()=>setStage(b.dataset.stage));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;const tab=document.querySelectorAll('[data-stage]')[next];setStage(tab.dataset.stage);tab.focus();}});});
$('route-form').addEventListener('submit',e=>{e.preventDefault();try{applySequence(parseRoute($('route-input').value),'Loaded your Excel sequence.');}catch(error){$('route-error').textContent=error.message+' The displayed sequence has not changed.';$('route-error').hidden=false;$('route-input').setAttribute('aria-invalid','true');$('route-input').focus();}});
$('clear-route').addEventListener('click',()=>{$('route-input').value='';$('route-error').hidden=true;$('route-input').removeAttribute('aria-invalid');$('route-input').focus();});
$('save-baseline').addEventListener('click',()=>{if(!result?.complete)return;baseline=evaluate(result.route);save();renderComparison();});
$('clear-baseline').addEventListener('click',()=>{baseline=null;save();renderComparison();});
function stopPlayback(){playing=false;cancelAnimationFrame(raf);$('van').setAttribute('hidden','');$('play-route').textContent='▶ Play visit order';$('play-status').textContent='Kitchen = 0';}
$('play-route').addEventListener('click',()=>{if(playing){stopPlayback();return;}if(!result?.complete)return;playing=true;playStart=performance.now();$('van').removeAttribute('hidden');$('play-route').textContent='■ Stop playback';const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now){if(!playing)return;const at=(now-playStart)/850,index=Math.min(result.path.length-2,Math.floor(at)),fraction=Math.min(1,at-index),a=project(DATA.stops[result.path[index]]),b=project(DATA.stops[result.path[index+1]]);const t=reduced?(fraction>.5?1:0):fraction;$('van').setAttribute('transform',`translate(${a.x+(b.x-a.x)*t},${a.y+(b.y-a.y)*t})`);$('play-status').textContent=`${result.path[index]} → ${result.path[index+1]} · ${DATA.stops[result.path[index+1]].short}`;if(at>=result.path.length-1){playing=false;$('play-route').textContent='↻ Replay visit order';$('play-status').textContent='Back at the kitchen';return;}raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
$('export-route').addEventListener('click',()=>{if(!result?.complete)return;const quote=v=>'"'+String(v).replaceAll('"','""')+'"';const ext=stage==='extension';const rows=[['Order','Stop ID','Location','Driving minutes',...(ext?['Arrival','Deadline','Minutes late','Refund']:[])],...result.rows.map(r=>[r.id===0?'Return':r.order,r.id,DATA.stops[r.id].name,num(r.driveMinutes),...(ext?[clock(r.arrival,true),r.id?clock(DATA.stops[r.id].deadlineMinutes):'',num(r.lateMinutes),num(r.refund,2)]:[])])];rows.push([],['Total driving minutes',num(result.driveMinutes)]);if(ext)rows.push(['Driver cost',num(result.driverCost,2)],['Driver minutes (including unloading)',num(result.totalMinutes)],['Refunds',num(result.refunds,2)],['Total delivery cost',num(result.totalCost,2)]);const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`new-haven-${stage}-route.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('stop-data').innerHTML=DATA.stops.map(s=>`<tr><td>${s.id}</td><td>${escape(s.name)}</td><td>${escape(s.address)}</td><td>${s.id?clock(s.deadlineMinutes):'—'}</td><td>${s.id?money(s.refund):'—'}</td></tr>`).join('');
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved?.route)){result=evaluate(saved.route,{partial:true});$('route-input').value=result.route.join(' ');}if(Array.isArray(saved?.baseline))baseline=evaluate(saved.baseline);}catch{result=null;baseline=null;}
buildSequence();
if(!result){result=evaluate([],{partial:true});}else{$('sequence-feedback').textContent=result.complete?'Your saved route is loaded. Click Draw new route to choose a sequence on the map.':'Your unfinished route is loaded. Click the next location to continue.';}
setStage('base');
