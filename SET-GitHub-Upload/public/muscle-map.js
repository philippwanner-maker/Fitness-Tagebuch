'use strict';
const SetMuscleMap = (() => {
  const pair=(x,y,rx,ry,angle=0)=>[[x,y,rx,ry,angle],[440-x,y,rx,ry,-angle]];
  // Fixed anatomical centres, cloud radii and axis angles. No muscle boundaries.
  const views={
    front:[
      ['chest','Brust',pair(201,121,15,15,-12)],
      ['frontShoulders','Vordere Schulter',pair(173,103,9,14,20)],
      ['biceps','Bizeps',pair(165,147,7,18,20)],
      ['abs','Bauch',[[220,181,14,32,0]]],
      ['quads','Quads',pair(199,281,11,31,-5)]
    ],
    back:[
      ['trapezius','Trapez',pair(210,97,8,21,-18)],
      ['latissimus','Latissimus',pair(200,158,11,26,-12)],
      ['rearShoulders','Hintere Schulter',pair(173,103,9,14,20)],
      ['triceps','Trizeps',pair(166,148,7,19,20)],
      ['glutes','Gluteus',pair(201,230,13,17,-8)],
      ['hamstrings','Hamstrings',pair(199,284,10,29,-5)],
      ['calves','Waden',pair(198,357,9,22)]
    ]
  };
  // Compound lifts contribute one set to each directly involved muscle zone.
  function zonesFor(name) {
    const n=name.trim().toLocaleLowerCase('de-DE');
    if (/waden|calf/.test(n)) return ['calves'];
    if (/beinbeug|leg curl|hamstring|nordic/.test(n)) return ['hamstrings'];
    if (/rumän|romanian|stiff.?leg|good morning/.test(n)) return ['hamstrings','glutes'];
    if (/trizeps|triceps|french.?press|skull.?crusher|push.?down|enges bank|close.?grip.*bench|overhead.*extension/.test(n)) return ['triceps'];
    if (/dips/.test(n)) return ['chest','frontShoulders','triceps'];
    if (/hip thrust|glute|kickback.*(bein|kabel)|donkey/.test(n)) return ['glutes'];
    if (/kreuzheben|deadlift/.test(n)) return ['hamstrings','glutes','trapezius'];
    if (/kniebeug|squat|beinpresse|leg press|ausfall|lunge|step.?up/.test(n)) return ['quads','glutes'];
    if (/beinstreck|leg extension/.test(n)) return ['quads'];
    if (/reverse fly|rear delt|face pull/.test(n)) return ['rearShoulders','trapezius'];
    if (/ruder|row/.test(n)) return ['latissimus','trapezius','rearShoulders','biceps'];
    if (/latzug|klimm|pull.?up|chin.?up/.test(n)) return ['latissimus','biceps'];
    if (/trapez|shrug/.test(n)) return ['trapezius'];
    if (/überzüg|pullover/.test(n)) return ['latissimus'];
    if (/bizeps|biceps|curl/.test(n)) return ['biceps'];
    if (/crunch|sit.?up|beinheben|leg raise|plank|bauch/.test(n)) return ['abs'];
    if (/frontheb|front raise/.test(n)) return ['frontShoulders'];
    if (/schulterdr|schulterpress|shoulder press|arnold|overhead|military/.test(n)) return ['frontShoulders','triceps'];
    if (/bankdr|bench|brustpresse|chest press|liegestütz|push.?up/.test(n)) return ['chest','frontShoulders','triceps'];
    if (/brust|butterfly|flys|flies/.test(n)) return ['chest'];
    return [];
  }
  function counts(workouts,today) {
    const date=new Date(today+'T12:00:00');date.setDate(date.getDate()-29);
    const start=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const result=Object.fromEntries(Object.values(views).flat().map(([id])=>[id,0]));
    for(const w of workouts){
      if(w.date<start||w.date>today||w.dayId==='rest-day')continue;
      for(const e of w.exercises){
        const total=e.sets.filter(s=>Number.isFinite(s.weight)&&s.weight>=0&&Number.isInteger(s.reps)&&s.reps>0).length;
        for(const id of zonesFor(e.name))result[id]+=total;
      }
    }
    return result;
  }

  // One continuous closed perimeter, including head and neck.
  const bodyPath='M220 17 C206 17 200 26 201 39 C201 49 206 56 208 62 C211 75 198 80 184 84 C169 86 160 94 157 110 C153 126 151 145 148 160 C145 177 140 195 137 212 C135 218 131 224 131 231 C131 236 134 237 137 234 C138 243 141 245 144 238 C145 245 149 242 151 234 C154 226 155 218 156 213 C161 197 169 182 172 166 C176 153 181 139 183 131 C184 149 187 165 190 180 C191 190 189 203 185 217 C180 233 178 250 180 268 C181 287 185 305 187 321 C188 331 182 341 181 354 C180 372 187 394 189 408 C190 413 185 419 182 424 C185 430 199 429 207 425 C210 422 208 412 209 405 C210 389 215 369 215 353 C214 341 210 331 212 319 C214 297 218 278 219 263 Q220 259 221 263 C222 278 226 297 228 319 C230 331 226 341 225 353 C225 369 230 389 231 405 C232 412 230 422 233 425 C241 429 255 430 258 424 C255 419 250 413 251 408 C253 394 260 372 259 354 C258 341 252 331 253 321 C255 305 259 287 260 268 C262 250 260 233 255 217 C251 203 249 190 250 180 C253 165 256 149 257 131 C259 139 264 153 268 166 C271 182 279 197 284 213 C285 218 286 226 289 234 C291 242 295 245 296 238 C299 245 302 243 303 234 C306 237 309 236 309 231 C309 224 305 218 303 212 C300 195 295 177 292 160 C289 145 287 126 283 110 C280 94 271 86 256 84 C242 80 229 75 232 62 C234 56 239 49 239 39 C240 26 234 17 220 17 Z';
  function particleSettings(sets){
    const level=Math.max(0,Math.min(10,sets)),t=Math.max(0,(level-3)/7);
    return {count:level?Math.round(10+level*4+t*320):0,opacity:level?.09+Math.min(level,3)*.02+t*.8:0,spread:1.15-.55*t};
  }
  const cache=new Map();
  function cloudMarkup(id,centres,sets){
    if(!sets)return '';
    const level=Math.min(10,sets),key=id+':'+level;
    if(cache.has(key))return cache.get(key);
    const settings=particleSettings(level);
    let seed=2166136261;
    for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
    const points=[];
    for(const [cx,cy,rx,ry,degrees=0] of centres){
      const a=degrees*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
      for(let i=0;i<settings.count;i++){
        // Gaussian volume with soft falloff; only the outer body clips the cloud.
        const radius=Math.sqrt(-2*Math.log(random())),theta=random()*2*Math.PI;
        const u=radius*Math.cos(theta)*settings.spread*.52,v=radius*Math.sin(theta)*settings.spread*.52;
        const x=cx+u*rx*cos-v*ry*sin,y=cy+u*rx*sin+v*ry*cos;
        const depth=random(),r=.28+.55*depth,opacity=(.35+.65*depth)*Math.exp(-radius*radius*.12);
        points.push('<circle cx="'+x.toFixed(2)+'" cy="'+y.toFixed(2)+'" r="'+r.toFixed(2)+'" opacity="'+opacity.toFixed(3)+'"/>');
      }
    }
    const markup=points.join('');cache.set(key,markup);return markup;
  }
  function renderParticles(group,centres,sets){
    group.style.setProperty('--cloud-opacity',particleSettings(sets).opacity);
    group.classList.toggle('dense-cloud',sets>=10);
    const level=String(Math.min(sets,10));
    if(group.dataset.level===level)return;
    group.innerHTML=cloudMarkup(group.dataset.zone,centres,sets);
    group.dataset.level=level;
  }
  function svg(side){
    return '<svg viewBox="112 6 216 438" role="img" aria-labelledby="map-title-'+side+'"><title id="map-title-'+side+'">'+(side==='front'?'Vorderseite':'Rückseite')+' · Muskelaktivität</title><defs><clipPath id="body-clip-'+side+'" clipPathUnits="userSpaceOnUse"><path d="'+bodyPath+'"/></clipPath></defs><path class="scan-shell" d="'+bodyPath+'"/><g clip-path="url(#body-clip-'+side+')">'+views[side].map(([id])=>'<g id="muscle-'+id+'" data-zone="'+id+'" class="scan-cloud" aria-hidden="true"></g>').join('')+'</g></svg>';
  }
  function render(root,workouts,today) {
    if(!root.querySelector('.body-map')) {
      root.innerHTML=`<div class="body-map"><div class="body-stage"><div id="body-front" class="body-view" role="tabpanel" aria-labelledby="body-tab-front">${svg('front')}</div><div id="body-back" class="body-view" role="tabpanel" aria-labelledby="body-tab-back" inert aria-hidden="true">${svg('back')}</div></div><div class="body-tabs" role="tablist" aria-label="Körperansicht"><button type="button" id="body-tab-front" role="tab" aria-controls="body-front" data-side="front">Vorderseite</button><button type="button" id="body-tab-back" role="tab" aria-controls="body-back" data-side="back">Rückseite</button></div></div>`;
      root.dataset.side='front';
      root.querySelector('.body-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-side]');if(button)switchSide(root,button.dataset.side);});
      root.querySelector('.body-tabs').addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();const side=event.key==='Home'?'front':event.key==='End'?'back':root.dataset.side==='front'?'back':'front';
        switchSide(root,side);root.querySelector(`[data-side="${side}"]`).focus();
      });
    }
    root._muscleCounts=counts(workouts,today);
    switchSide(root,root.dataset.side);
  }
  function switchSide(root,side) {
    if(!views[side])return;
    root.dataset.side=side;
    for(const view of ['front','back']) {
      const visible=view===side,panel=root.querySelector(`#body-${view}`),button=root.querySelector(`[data-side="${view}"]`);
      panel.classList.toggle('is-visible',visible);panel.inert=!visible;panel.setAttribute('aria-hidden',String(!visible));
      button.setAttribute('aria-selected',String(visible));button.tabIndex=visible?0:-1;
      panel.querySelector('title').textContent=`${view==='front'?'Vorderseite':'Rückseite'} · ${views[view].map(([id,label])=>`${label}: ${root._muscleCounts[id]||0} Sätze`).join(', ')}`;
      for(const [id,label,centres] of views[view]){
        const group=panel.querySelector(`[data-zone="${id}"]`),sets=root._muscleCounts[id]||0;
        group.classList.toggle('is-trained',visible&&sets>0);
        renderParticles(group,centres,visible?sets:0);
        group.setAttribute('aria-label',`${label}: ${sets} Sätze`);
      }
    }
  }
  return {render,counts,zonesFor,particleSettings};
})();
if(typeof module!=='undefined')module.exports=SetMuscleMap;
