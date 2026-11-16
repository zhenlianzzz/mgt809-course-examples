import {DATA} from './data.mjs';
export function parseRoute(text){
  const tokens=text.trim().split(/[\s,;]+/).filter(Boolean);
  if(!tokens.length)throw new Error('Paste the 12 stop IDs from your Excel route.');
  if(tokens.some(t=>!/^\d+$/.test(t)))throw new Error('Use whole-number stop IDs, separated by spaces, commas, or new lines.');
  let route=tokens.map(Number);
  if(route.length===14&&route[0]===0&&route.at(-1)===0)route=route.slice(1,-1);
  if(route.length!==12)throw new Error(`Enter all 12 deliveries once. You entered ${route.length} stops.`);
  if(route.some(id=>id<1||id>12))throw new Error('Delivery IDs run from 1 to 12. The kitchen is added at the start and end.');
  const seen=new Set(),duplicates=[];for(const id of route){if(seen.has(id))duplicates.push(id);seen.add(id);}
  if(duplicates.length){const missing=Array.from({length:12},(_,i)=>i+1).filter(id=>!seen.has(id));throw new Error(`Repeated stop${duplicates.length>1?'s':''}: ${[...new Set(duplicates)].join(', ')}. Missing: ${missing.join(', ')}.`);}
  return route;
}
export function scoreArrival(arrival,stop){const lateMinutes=Math.max(0,arrival-stop.deadlineMinutes);return{lateMinutes,refund:lateMinutes>1e-9?stop.refund:0};}
export function evaluate(route){
  parseRoute(route.join(' '));
  // Whole seconds preserve the workbook's 0.1-minute road estimates without rounding at each stop.
  const path=[0,...route,0];let elapsedSeconds=0,drivingSeconds=0,miles=0;
  const rows=[];
  for(let i=1;i<path.length;i++){
    const from=DATA.stops[path[i-1]],stop=DATA.stops[path[i]];
    const driveSeconds=Math.round(DATA.minutes[from.id][stop.id]*60);
    elapsedSeconds+=from.serviceMinutes*60+driveSeconds;drivingSeconds+=driveSeconds;
    const legMiles=DATA.miles[from.id][stop.id];miles+=legMiles;
    const arrival=DATA.departureMinutes+elapsedSeconds/60;
    const timing=stop.id===0?{lateMinutes:0,refund:0}:scoreArrival(arrival,stop);
    rows.push({order:i,from:from.id,id:stop.id,driveMinutes:driveSeconds/60,miles:legMiles,arrival,...timing});
  }
  const driveMinutes=drivingSeconds/60,totalMinutes=elapsedSeconds/60;
  const driverCost=totalMinutes/60*DATA.driverPerHour,vehicleCost=miles*DATA.vehiclePerMile;
  const refunds=rows.reduce((s,r)=>s+r.refund,0),lateCount=rows.filter(r=>r.lateMinutes>1e-9).length;
  return{route:[...route],path,rows,driveMinutes,miles,totalMinutes,returnMinutes:DATA.departureMinutes+totalMinutes,driverCost,vehicleCost,refunds,lateCount,totalLateMinutes:rows.reduce((s,r)=>s+r.lateMinutes,0),totalCost:driverCost+vehicleCost+refunds};
}
export function clock(minutes,seconds=false){let sec=Math.round(minutes*60),h=Math.floor(sec/3600)%24,m=Math.floor(sec/60)%60,s=sec%60;return`${h%12||12}:${String(m).padStart(2,'0')}${seconds?':'+String(s).padStart(2,'0'):''} ${h>=12?'PM':'AM'}`;}
export const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export function project(stop){const e=DATA.mapExtent,R=6378137,x=R*stop.lon*Math.PI/180,y=R*Math.log(Math.tan(Math.PI/4+stop.lat*Math.PI/360));return{x:(x-e.xmin)/(e.xmax-e.xmin)*1120,y:(e.ymax-y)/(e.ymax-e.ymin)*850};}

// Assigning a stop to a visit position swaps it with its existing position.
export function assignVisit(route,position,stopId){
  parseRoute(route.join(' '));
  if(!Number.isInteger(position)||position<0||position>=route.length)throw new Error('Invalid visit position.');
  const other=route.indexOf(stopId);
  if(other<0)throw new Error('Invalid stop ID.');
  const next=[...route];[next[position],next[other]]=[next[other],next[position]];
  return next;
}

// Move one visit and shift the intervening visits, preserving their relative order.
export function moveVisit(route,from,to){
  parseRoute(route.join(' '));
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=route.length||to>=route.length)throw new Error('Invalid visit position.');
  const next=[...route];const [id]=next.splice(from,1);next.splice(to,0,id);return next;
}
