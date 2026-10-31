'use strict';
// Toy laser duel: guns follow their owners; each shot aims before the dodge.
window.Duel = (() => {
  let running = null;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const point = el => { const r = el.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 }; };
  const weapon = '<svg viewBox="0 0 64 36" aria-hidden="true"><path d="M5 8h47v15H25l-5 11H9l4-14H5z" fill="currentColor" stroke="#162036" stroke-width="3"/><path d="M52 11h10v9H52" fill="#f4faff" stroke="#162036" stroke-width="2"/><path d="M30 12h16" stroke="#fff" stroke-width="3"/></svg><span class="duel-muzzle"></span>';
  async function perform(board) {
    const fighters=['w','b'].map(color=>({color,el:board.querySelector(`.piece.${color}`)}));
    if(fighters.some(f=>!f.el)) throw new Error('Для дуэли нужны два короля');
    const layer=document.createElementNS('http://www.w3.org/2000/svg','svg');
    layer.classList.add('duel-lasers');layer.setAttribute('aria-hidden','true');
    board.append(layer); const animations=[];
    try {
      for(const f of fighters) {
        f.gun=document.createElement('span');f.gun.className=`duel-gun ${f.color}`;
        f.gun.innerHTML=weapon;f.el.append(f.gun);
        f.muzzle=f.gun.querySelector('.duel-muzzle');
      }
      for(let i=0;i<12;i++) {
        const shooter=fighters[i%2],target=fighters[1-i%2];
        const rect=board.getBoundingClientRect(),from=point(shooter.muzzle),to=point(target.el);
        layer.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
        const beam=document.createElementNS(layer.namespaceURI,'line');
        for(const [key,value] of Object.entries({x1:from.x-rect.left,y1:from.y-rect.top,x2:to.x-rect.left,y2:to.y-rect.top})) beam.setAttribute(key,value);
        beam.setAttribute('stroke',shooter.color==='w'?'#57edff':'#ffb34d');
        beam.classList.add('duel-shot');layer.append(beam);
        const direction=i%4<2?1:-1,offset=target.el.getBoundingClientRect().width*.9;
        animations.push(target.el.animate([{transform:'translateX(0)'},{transform:`translateX(${direction*offset}px) rotate(${direction*12}deg)`,offset:.28},{transform:`translateX(${direction*offset}px) rotate(${direction*12}deg)`,offset:.65},{transform:'translateX(0)'}],{duration:460,easing:'ease-out'}));
        animations.push(shooter.gun.animate([{scale:'1'},{scale:'.8',offset:.2},{scale:'1'}],{duration:180}));
        Sound.play('laser');
        await wait(300);beam.remove();await wait(200);
      }
    } finally {
      animations.forEach(a=>a.cancel());layer.remove();fighters.forEach(f=>f.gun?.remove());
    }
  }
  return { run(board) { if(!running) running=perform(board).finally(()=>{running=null;});return running; } };
})();
