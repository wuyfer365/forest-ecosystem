/**
 * 森林生态模拟 — 参数自动寻优测试
 * 运行：node test-balance.js
 * 说明：模拟不同参数组合，找到种群最稳定的参数
 */

// ========== 模拟核心（从 HTML 提取的纯逻辑，无 DOM 依赖） ==========

const CONFIG = {
  WIDTH: 800, HEIGHT: 600, TICK_MS: 300,
  PREDATION_DIST: 25, EAT_PLANT_DIST: 15, BURST_RANGE: 55,
  TIGER_WALK_SPEED: 2.0, TIGER_SPRINT_SPEED: 6.8, TIGER_BURST_SPEED: 8.5,
  TIGER_SPRINT_THRESHOLD: 100, TIGER_SPRINT_DURATION: 16,
  TIGER_COOLDOWN_DURATION: 70, TIGER_HUNGER_RATE: 0.5,
  TIGER_HUNTER_THRESHOLD: 80, TIGER_MAX_HUNGER: 100, TIGER_DETECT_RANGE: 300,
  TIGER_EAT_HEAL: 20, TIGER_BREED_MIN_COUNT: 2, TIGER_BREED_MIN_AGE_MS: 30000,
  TIGER_BREED_CHANCE: 0.01, TIGER_MAX_AGE_MS: 180000,
  DEER_SPEED: 3.0, DEER_FLEE_RANGE: 95, DEER_HERD_RANGE: 200, DEER_HP_LOSS: 0.6,
  DEER_BREED_MIN_COUNT: 2, DEER_BREED_MIN_AGE_MS: 12000, DEER_BREED_CHANCE: 0.05,
  DEER_MAX_AGE_MS: 120000,
  SHEEP_SPEED: 2.8, SHEEP_FLEE_RANGE: 85, SHEEP_HERD_RANGE: 150, SHEEP_HP_LOSS: 0.3,
  SHEEP_BREED_MIN_COUNT: 2, SHEEP_BREED_MIN_AGE_MS: 10000, SHEEP_BREED_CHANCE: 0.06,
  SHEEP_MAX_AGE_MS: 105000,
  FLEE_SPEED_MULT: 1.2, EAT_HP_THRESHOLD: 0.8,
  MAX_PLANTS: 200, PLANT_REGROW_MS: 5000, PLANT_MIN_COUNT: 50,
  TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120,
};

const Utils = {
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
  randInt(min, max) { return Math.floor(Math.random() * (max - min)) + min; },
  randFloat(min, max) { return Math.random() * (max - min) + min; },
  uid() { return Math.random().toString(36).slice(2, 8); },
};

class Creature {
  constructor(type, x, y, opts = {}) {
    this.id = Utils.uid();
    this.type = type;
    this.alive = true;
    this.x = x; this.y = y;
    this.color = opts.color || '#fff';
    this.size = opts.size || 7;
    this.speed = opts.speed || 1;
    this.hp = opts.hp || 100;
    this.maxHp = opts.maxHp || 100;
    this.symbol = opts.symbol || 'circle';
    this.age = 0;
    this.maxAge = opts.maxAge || Infinity;
    this.prevX = x;
    this.prevY = y;
  }
  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount); if (this.hp <= 0) this.alive = false; }
  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  move(dx, dy) {
    this.prevX = this.x; this.prevY = this.y;
    this.x += dx; this.y += dy;
    const edge = 20;
    if (this.x < edge) this.x += (edge - this.x) * 0.3;
    if (this.x > CONFIG.WIDTH - edge) this.x -= (this.x - (CONFIG.WIDTH - edge)) * 0.3;
    if (this.y < edge) this.y += (edge - this.y) * 0.3;
    if (this.y > CONFIG.HEIGHT - edge) this.y -= (this.y - (CONFIG.HEIGHT - edge)) * 0.3;
    if (this.x < 0) this.x = 0; if (this.x > CONFIG.WIDTH) this.x = CONFIG.WIDTH;
    if (this.y < 0) this.y = 0; if (this.y > CONFIG.HEIGHT) this.y = CONFIG.HEIGHT;
  }
  moveToward(tx, ty, spd) {
    const d = Utils.dist(this.x, this.y, tx, ty);
    if (d < 1) return;
    this.move(((tx - this.x) / d) * spd, ((ty - this.y) / d) * spd);
  }
  moveAwayFrom(tx, ty, spd) {
    const d = Utils.dist(this.x, this.y, tx, ty);
    if (d < 1) return;
    this.move(((this.x - tx) / d) * spd, ((this.y - ty) / d) * spd);
  }
  smartFlee(tx, ty, spd, W, H) {
    const d = Utils.dist(this.x, this.y, tx, ty);
    if (d < 1) return;
    const distL = this.x, distR = W - this.x, distT = this.y, distB = H - this.y;
    const near = [distL, distR, distT, distB].sort((a, b) => a - b);
    if (near[0] < 25 && near[1] < 40) {
      const ca = Math.atan2(H/2 - this.y, W/2 - this.x);
      this.move(Math.cos(ca) * spd * 1.3, Math.sin(ca) * spd * 1.3);
      return;
    }
    let angle = Math.atan2(this.y - ty, this.x - tx);
    const margin = 70;
    const hitL = this.x < margin && Math.cos(angle) < -0.2;
    const hitR = this.x > W - margin && Math.cos(angle) > 0.2;
    const hitT = this.y < margin && Math.sin(angle) < -0.2;
    const hitB = this.y > H - margin && Math.sin(angle) > 0.2;
    if (hitL || hitR) {
      angle = Math.sin(angle) > 0 ? Math.PI / 2 : -Math.PI / 2;
      if ((hitT && Math.sin(angle) < 0) || (hitB && Math.sin(angle) > 0)) angle = hitL ? Math.PI/4 : -Math.PI/4;
    } else if (hitT || hitB) {
      angle = Math.cos(angle) > 0 ? 0 : Math.PI;
      if ((hitL && Math.cos(angle) < 0) || (hitR && Math.cos(angle) > 0)) angle = hitT ? Math.PI/4 : -Math.PI/4;
    } else {
      const eX = Math.max(0, margin - this.x) - Math.max(0, this.x - (W - margin));
      const eY = Math.max(0, margin - this.y) - Math.max(0, this.y - (H - margin));
      const eD = Math.hypot(eX, eY) / margin;
      if (eD > 0.01) {
        const eA = Math.atan2(-eY, -eX);
        angle = angle * (1 - Math.pow(eD, 1.5)) + eA * Math.pow(eD, 1.5);
      }
    }
    angle += (Math.random() - 0.5) * 0.6;
    this.move(Math.cos(angle) * spd, Math.sin(angle) * spd);
  }
  wander() {
    const a = Math.random() * Math.PI * 2;
    this.move(Math.cos(a) * this.speed, Math.sin(a) * this.speed);
  }
}

class Tiger extends Creature {
  constructor(x, y) {
    super('tiger', x, y, { color:'#e67e22', speed:CONFIG.TIGER_WALK_SPEED, hp:100, maxHp:100, size:12, symbol:'square', maxAge:CONFIG.TIGER_MAX_AGE_MS });
    this.state = 'IDLE';
    this.sprintTicks = 0; this.cooldownTicks = 0; this.target = null; this.hunger = 50;
    this.lastKnownPrey = null; this.searchTarget = null; this.searchTimer = 0;
  }
  updateHunger() {
    this.hunger = Math.min(CONFIG.TIGER_MAX_HUNGER, this.hunger + CONFIG.TIGER_HUNGER_RATE);
    if (this.hunger >= CONFIG.TIGER_MAX_HUNGER) { this.takeDamage(1); return true; }
    return false;
  }
  feed() { this.hunger = 0; this.heal(CONFIG.TIGER_EAT_HEAL); }
  isHungry() { return this.hunger >= CONFIG.TIGER_HUNTER_THRESHOLD; }
  hunt(preyList) {
    const alive = preyList.filter(p => p.alive);
    if (alive.length === 0) { this._searchMap(); return; }
    let nearest = null, minD = Infinity;
    for (const p of alive) { const d = Utils.dist(this.x,this.y,p.x,p.y); if (d < minD) { minD = d; nearest = p; } }
    this.target = nearest;
    if (nearest) this.lastKnownPrey = { x:nearest.x, y:nearest.y, tick:this.age };
    if (this.isHungry() && minD > CONFIG.TIGER_DETECT_RANGE) { this.moveToward(nearest.x, nearest.y, CONFIG.TIGER_WALK_SPEED*1.2); return; }
    switch (this.state) {
      case 'IDLE': this._doIdle(minD); break;
      case 'STALK': this._doStalk(minD); break;
      case 'SPRINT': this._doSprint(minD); break;
      case 'COOLDOWN': this._doCooldown(minD); break;
    }
  }
  _searchMap() {
    if (this.lastKnownPrey && this.age - this.lastKnownPrey.tick < 500) {
      this.moveToward(this.lastKnownPrey.x, this.lastKnownPrey.y, CONFIG.TIGER_WALK_SPEED*1.2); return;
    }
    if (!this.searchTarget || this.searchTimer <= 0 || Math.hypot(this.x-this.searchTarget.x, this.y-this.searchTarget.y) < 30) {
      this.searchTarget = { x: CONFIG.WIDTH/2+(Math.random()-0.5)*CONFIG.WIDTH*0.6, y: CONFIG.HEIGHT/2+(Math.random()-0.5)*CONFIG.HEIGHT*0.6 };
      this.searchTimer = 80 + Math.random()*60;
    }
    this.searchTimer--;
    this.moveToward(this.searchTarget.x, this.searchTarget.y, CONFIG.TIGER_WALK_SPEED);
  }
  _doIdle(dist) {
    if (this.isHungry() && dist < CONFIG.TIGER_DETECT_RANGE) { this.state='STALK'; this._doStalk(dist); }
    else if (this.isHungry()) { if (this.target) this.moveToward(this.target.x,this.target.y,CONFIG.TIGER_WALK_SPEED*1.2); else this._searchMap(); }
    else this.wander();
  }
  _doStalk(dist) {
    if (!this.target) { this.state='IDLE'; this._searchMap(); return; }
    if (dist < CONFIG.TIGER_SPRINT_THRESHOLD) { this.state='SPRINT'; this.sprintTicks=0; this._doSprint(dist); return; }
    this.moveToward(this.target.x, this.target.y, CONFIG.TIGER_WALK_SPEED);
  }
  _doSprint(dist) {
    this.sprintTicks++;
    if (this.sprintTicks > CONFIG.TIGER_SPRINT_DURATION) { this.state='COOLDOWN'; this.cooldownTicks=CONFIG.TIGER_COOLDOWN_DURATION; return; }
    const spd = dist < CONFIG.BURST_RANGE ? CONFIG.TIGER_BURST_SPEED : CONFIG.TIGER_SPRINT_SPEED;
    if (this.target) this.moveToward(this.target.x, this.target.y, spd);
    else { this.state='IDLE'; this._searchMap(); }
  }
  _doCooldown(dist) {
    this.cooldownTicks--;
    if (this.cooldownTicks <= 0) { this.state = this.isHungry() ? 'STALK' : 'IDLE'; return; }
    if (this.target) this.moveToward(this.target.x, this.target.y, CONFIG.TIGER_WALK_SPEED*0.6);
    else if (this.lastKnownPrey) this.moveToward(this.lastKnownPrey.x, this.lastKnownPrey.y, CONFIG.TIGER_WALK_SPEED*0.5);
    else this.wander();
  }
}

class Deer extends Creature {
  constructor(x, y) { super('deer',x,y,{color:'#CD853F',speed:CONFIG.DEER_SPEED,hp:80,maxHp:80,size:8,symbol:'circle',maxAge:CONFIG.DEER_MAX_AGE_MS}); }
  graze(tigers, allDeers, plants) {
    const fr = CONFIG.DEER_FLEE_RANGE * (CONFIG.FLEE_SPEED_MULT/1.6);
    const threat = this._nearestThreat(tigers, fr);
    if (threat) { this.smartFlee(threat.x,threat.y,this.speed*CONFIG.FLEE_SPEED_MULT,CONFIG.WIDTH,CONFIG.HEIGHT); return; }
    for (const other of allDeers) {
      if (other===this||!other.alive) continue;
      const od = Math.hypot(other.x-this.x, other.y-this.y);
      if (od<fr*0.5 && Math.hypot(other.x-other.prevX,other.y-other.prevY)>4) {
        this.move((other.x-this.x)/od*this.speed*0.6,(other.y-this.y)/od*this.speed*0.6); return;
      }
    }
    this._herd(allDeers, CONFIG.DEER_HERD_RANGE, 0.25);
    const plant = this._nearestPlant(plants);
    if (plant) this.moveToward(plant.x,plant.y,this.speed*0.7);
    else this.moveToward(CONFIG.WIDTH/2+(Math.random()-0.5)*100, CONFIG.HEIGHT/2+(Math.random()-0.5)*100, this.speed*0.6);
  }
  _herd(list,r,w) { let cx=0,cy=0,c=0; for(const o of list){if(o===this||!o.alive)continue;const d=Utils.dist(this.x,this.y,o.x,o.y);if(d<r){cx+=o.x;cy+=o.y;c++;}}if(c>0){cx/=c;cy/=c;this.moveToward(cx,cy,this.speed*w);} }
  _nearestThreat(t,f) { let n=null,m=Infinity; for(const t2 of t){if(!t2.alive)continue;const d=Utils.dist(this.x,this.y,t2.x,t2.y);if(d<f&&d<m){m=d;n=t2;}}return n; }
  _nearestPlant(p) { let n=null,m=Infinity; for(const p2 of p){if(!p2.alive)continue;const d=Utils.dist(this.x,this.y,p2.x,p2.y);if(d<m){m=d;n=p2;}}return n; }
}

class Sheep extends Creature {
  constructor(x, y) { super('sheep',x,y,{color:'#F5F5F0',speed:CONFIG.SHEEP_SPEED,hp:90,maxHp:90,size:8,symbol:'circle',maxAge:CONFIG.SHEEP_MAX_AGE_MS}); }
  graze(tigers, allSheeps, plants) {
    const fr = CONFIG.SHEEP_FLEE_RANGE * (CONFIG.FLEE_SPEED_MULT/1.6);
    const threat = this._nearestThreat(tigers, fr);
    if (threat) { this.smartFlee(threat.x,threat.y,this.speed*CONFIG.FLEE_SPEED_MULT,CONFIG.WIDTH,CONFIG.HEIGHT); return; }
    for (const other of allSheeps) {
      if (other===this||!other.alive) continue;
      const od = Math.hypot(other.x-this.x, other.y-this.y);
      if (od<fr*0.5&&Math.hypot(other.x-other.prevX,other.y-other.prevY)>4) {
        this.move((other.x-this.x)/od*this.speed*0.6,(other.y-this.y)/od*this.speed*0.6); return;
      }
    }
    this._herd(allSheeps, CONFIG.SHEEP_HERD_RANGE, 0.3);
    const plant = this._nearestPlant(plants);
    if (plant) this.moveToward(plant.x,plant.y,this.speed*0.7);
    else this.moveToward(CONFIG.WIDTH/2+(Math.random()-0.5)*100, CONFIG.HEIGHT/2+(Math.random()-0.5)*100, this.speed*0.6);
  }
  _herd(list,r,w) { let cx=0,cy=0,c=0; for(const o of list){if(o===this||!o.alive)continue;const d=Utils.dist(this.x,this.y,o.x,o.y);if(d<r){cx+=o.x;cy+=o.y;c++;}}if(c>0){cx/=c;cy/=c;this.moveToward(cx,cy,this.speed*w);} }
  _nearestThreat(t,f) { let n=null,m=Infinity; for(const t2 of t){if(!t2.alive)continue;const d=Utils.dist(this.x,this.y,t2.x,t2.y);if(d<f&&d<m){m=d;n=t2;}}return n; }
  _nearestPlant(p) { let n=null,m=Infinity; for(const p2 of p){if(!p2.alive)continue;const d=Utils.dist(this.x,this.y,p2.x,p2.y);if(d<m){m=d;n=p2;}}return n; }
}

class Plant {
  constructor(x, y) { this.x=x; this.y=y; this.alive=true; this.size=4; this.regrowTimer=0; }
  beEaten() { if(!this.alive)return; this.alive=false; this.regrowTimer=CONFIG.PLANT_REGROW_MS; }
  update(dt) { if(this.alive)return; this.regrowTimer-=dt; if(this.regrowTimer<=0){this.alive=true;this.regrowTimer=0;} }
}

// ========== 测试引擎 ==========

const TICKS = 12000;  // 模拟 12000 tick ≈ 1小时仿真时间

function runSimulation(params) {
  // 合并参数到 CONFIG
  Object.assign(CONFIG, params);
  CONFIG.TICK_MS = 300;

  // 初始化生态系统
  const tigers = [];
  const deers = [];
  const sheeps = [];
  const plants = [];

  for (let i = 0; i < CONFIG.PLANT_COUNT_INIT; i++) plants.push(new Plant(Utils.randFloat(10, CONFIG.WIDTH-10), Utils.randFloat(10, CONFIG.HEIGHT-10)));
  for (let i = 0; i < CONFIG.TIGER_COUNT_INIT; i++) tigers.push(new Tiger(Utils.randFloat(10, CONFIG.WIDTH-10), Utils.randFloat(10, CONFIG.HEIGHT-10)));
  for (let i = 0; i < CONFIG.DEER_COUNT_INIT; i++) deers.push(new Deer(Utils.randFloat(10, CONFIG.WIDTH-10), Utils.randFloat(10, CONFIG.HEIGHT-10)));
  for (let i = 0; i < CONFIG.SHEEP_COUNT_INIT; i++) sheeps.push(new Sheep(Utils.randFloat(10, CONFIG.WIDTH-10), Utils.randFloat(10, CONFIG.HEIGHT-10)));

  // 历史记录（每20 tick采样）
  const history = [];
  let deerExtinct = false, sheepExtinct = false, tigerExtinct = false;

  for (let tick = 0; tick < TICKS; tick++) {
    // 年龄
    const deltaMs = 300;
    for (const t of tigers) if (t.alive) t.age += deltaMs;
    for (const d of deers) if (d.alive) d.age += deltaMs;
    for (const s of sheeps) if (s.alive) s.age += deltaMs;

    // 移动
    const allPrey = [...deers.filter(d=>d.alive), ...sheeps.filter(s=>s.alive)];
    for (const t of tigers) if (t.alive) t.hunt(allPrey);
    const aliveT = tigers.filter(t=>t.alive);
    const aliveD = deers.filter(d=>d.alive);
    const aliveS = sheeps.filter(s=>s.alive);
    for (const d of aliveD) d.graze(aliveT, deers, plants);
    for (const s of aliveS) s.graze(aliveT, sheeps, plants);

    // 捕食
    for (const tiger of tigers) {
      if (!tiger.alive) continue;
      let ate = false;
      for (const deer of deers) {
        if (!deer.alive || ate) continue;
        if (Utils.dist(tiger.x,tiger.y,deer.x,deer.y) < CONFIG.PREDATION_DIST) { deer.alive=false; tiger.feed(); ate=true; }
      }
      if (ate) continue;
      for (const sheep of sheeps) {
        if (!sheep.alive) continue;
        if (Utils.dist(tiger.x,tiger.y,sheep.x,sheep.y) < CONFIG.PREDATION_DIST) { sheep.alive=false; tiger.feed(); break; }
      }
    }

    // 吃植物
    const eatTh = CONFIG.EAT_HP_THRESHOLD;
    for (const deer of deers) { if(!deer.alive||deer.hp/deer.maxHp>=eatTh)continue; for(const p of plants){if(!p.alive)continue;if(Utils.dist(deer.x,deer.y,p.x,p.y)<CONFIG.EAT_PLANT_DIST){p.beEaten();deer.heal(12);break;}}}
    for (const sheep of sheeps) { if(!sheep.alive||sheep.hp/sheep.maxHp>=eatTh)continue; for(const p of plants){if(!p.alive)continue;if(Utils.dist(sheep.x,sheep.y,p.x,p.y)<CONFIG.EAT_PLANT_DIST){p.beEaten();sheep.heal(12);break;}}}

    // 饥饿
    for (const t of tigers) if (t.alive) t.updateHunger();
    for (const d of deers) if (d.alive) d.takeDamage(CONFIG.DEER_HP_LOSS);
    for (const s of sheeps) if (s.alive) s.takeDamage(CONFIG.SHEEP_HP_LOSS);

    // 衰老
    for (const t of tigers) if (t.alive && t.age > t.maxAge) t.alive = false;
    for (const d of deers) if (d.alive && d.age > d.maxAge) d.alive = false;
    for (const s of sheeps) if (s.alive && s.age > s.maxAge) s.alive = false;

    // 繁殖（简化版）
    function breedCheck(list, type, minCount, minAge, chance, maxLimit) {
      const alive = list.filter(c=>c.alive);
      const count = alive.length;
      if (count <= minCount) {
        if (count <= minCount && type !== 'tiger' && Math.random()<0.3) {
          const nx = Utils.randFloat(50, CONFIG.WIDTH-50), ny = Utils.randFloat(50, CONFIG.HEIGHT-50);
          if (type==='deer') deers.push(new Deer(nx,ny)); else if (type==='sheep') sheeps.push(new Sheep(nx,ny));
        }
        return;
      }
      const densityF = Math.max(0, 1-(count-minCount)/40);
      const lowBoost = count<6?3 : count<10?2 : 1;
      const effChance = Math.min(chance * densityF * lowBoost, 0.15);
      for (const c of alive) {
        if (c.age < minAge) continue;
        if (Math.random() >= effChance) continue;
        if (count >= maxLimit) break;
        const nx = Math.max(5, Math.min(CONFIG.WIDTH-5, c.x+Utils.randFloat(-40,40)));
        const ny = Math.max(5, Math.min(CONFIG.HEIGHT-5, c.y+Utils.randFloat(-40,40)));
        if (type==='tiger') tigers.push(new Tiger(nx,ny));
        else if (type==='deer') deers.push(new Deer(nx,ny));
        else if (type==='sheep') sheeps.push(new Sheep(nx,ny));
        break;
      }
    }
    breedCheck(tigers, 'tiger', 2, CONFIG.TIGER_BREED_MIN_AGE_MS, CONFIG.TIGER_BREED_CHANCE, 20);
    breedCheck(deers, 'deer', 2, CONFIG.DEER_BREED_MIN_AGE_MS, CONFIG.DEER_BREED_CHANCE, 45);
    breedCheck(sheeps, 'sheep', 2, CONFIG.SHEEP_BREED_MIN_AGE_MS, CONFIG.SHEEP_BREED_CHANCE, 45);

    // 清理
    for (let i = tigers.length-1; i>=0; i--) if (!tigers[i].alive) tigers.splice(i,1);
    for (let i = deers.length-1; i>=0; i--) if (!deers[i].alive) deers.splice(i,1);
    for (let i = sheeps.length-1; i>=0; i--) if (!sheeps[i].alive) sheeps.splice(i,1);

    // 安全网
    if (deers.length === 0) deers.push(new Deer(Utils.randFloat(50,CONFIG.WIDTH-50),Utils.randFloat(50,CONFIG.HEIGHT-50)));
    if (sheeps.length === 0) sheeps.push(new Sheep(Utils.randFloat(50,CONFIG.WIDTH-50),Utils.randFloat(50,CONFIG.HEIGHT-50)));

    // 植物再生
    for (const p of plants) if (!p.alive) p.update(deltaMs);
    const aliveP = plants.filter(p=>p.alive).length;
    if (aliveP < 50) { const add = Math.min(2, 200-aliveP); for(let i=0;i<add;i++) plants.push(new Plant(Utils.randFloat(10,CONFIG.WIDTH-10),Utils.randFloat(10,CONFIG.HEIGHT-10))); }

    // 记录
    if (tick % 50 === 0) {
      const tc = tigers.filter(t=>t.alive).length;
      const dc = deers.filter(d=>d.alive).length;
      const sc = sheeps.filter(s=>s.alive).length;
      history.push({ tick, tiger: tc, deer: dc, sheep: sc, plant: plants.filter(p=>p.alive).length });
      if (tc === 0) tigerExtinct = true;
      if (dc === 0) deerExtinct = true;
      if (sc === 0) sheepExtinct = true;
    }
  }

  // 评分（理想：老虎4-8只，猎物充足，比例1:4~1:10）
  const finalT = tigers.filter(t=>t.alive).length;
  const finalD = deers.filter(d=>d.alive).length;
  const finalS = sheeps.filter(s=>s.alive).length;
  const totalPrey = finalD + finalS;

  let score = 0;
  if (finalT >= 2 && finalT <= 10) score += 50;  // 老虎数量理想
  else if (finalT > 0) score += 15;               // 老虎存活但太多/太少
  if (totalPrey >= 15) score += 25;               // 猎物充足
  else if (totalPrey > 0) score += 10;
  if (finalT > 0 && totalPrey > 0) {
    const ratio = totalPrey / finalT;
    if (ratio >= 3 && ratio <= 12) score += 40;   // 比例合理
    else if (ratio >= 2 && ratio <= 15) score += 15;
  }
  if (!tigerExtinct && !deerExtinct && !sheepExtinct) score += 20;
  if (finalT >= 2 && finalT <= 6 && totalPrey >= 20) score += 30; // 最佳区间

  // 稳定性
  const mid = history.slice(Math.floor(history.length/2));
  if (mid.length > 5 && finalT > 0 && totalPrey > 0) {
    const avgT = mid.reduce((s,h)=>s+h.tiger,0)/mid.length;
    const avgD = mid.reduce((s,h)=>s+h.deer,0)/mid.length;
    const avgS = mid.reduce((s,h)=>s+h.sheep,0)/mid.length;
    if (avgT > 0 && avgD > 0 && avgS > 0) {
      const varT = Math.sqrt(mid.reduce((s,h)=>s+(h.tiger-avgT)**2,0)/mid.length)/avgT;
      const varD = Math.sqrt(mid.reduce((s,h)=>s+(h.deer-avgD)**2,0)/mid.length)/avgD;
      const varS = Math.sqrt(mid.reduce((s,h)=>s+(h.sheep-avgS)**2,0)/mid.length)/avgS;
      score += Math.max(0, 20 - Math.min(20, (varT+varD+varS)/3*20));
    }
  }

  return {
    score: Math.round(score * 10) / 10,
    final: { tiger: finalT, deer: finalD, sheep: finalS },
    extinct: { tiger: tigerExtinct, deer: deerExtinct, sheep: sheepExtinct },
    history: history.slice(-20),
  };
}

// ========== 参数扫描 ==========

console.log('🌲 森林生态模拟 — 参数自动寻优');
console.log(`模拟 ${TICKS} tick ≈ ${Math.round(TICKS*300/60000)} 分钟仿真时间\n`);

const paramSets = [
  // 探索不同参数组合
  // [sprintDuration, hungerRate, hunterThreshold, fleeMult, tigerInit, deerInit, sheepInit, plantInit]
  { label: '当前默认值', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '冲刺+2', TIGER_SPRINT_DURATION: 18, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '冲刺+4', TIGER_SPRINT_DURATION: 20, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '逃亡1.0', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.0, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '逃亡1.4', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.4, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '虎饿更快0.8', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.8, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '虎阈值60', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 60, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '虎阈值100', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 100, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 18, SHEEP_COUNT_INIT: 22, PLANT_COUNT_INIT: 120 },
  { label: '更多猎物', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 2, DEER_COUNT_INIT: 25, SHEEP_COUNT_INIT: 30, PLANT_COUNT_INIT: 150 },
  { label: '更少老虎', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 2, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '冲刺18+逃亡1.4', TIGER_SPRINT_DURATION: 18, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.4, TIGER_COUNT_INIT: 2, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '均衡方案A', TIGER_SPRINT_DURATION: 17, TIGER_HUNGER_RATE: 0.6, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.3, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '均衡方案B', TIGER_SPRINT_DURATION: 18, TIGER_HUNGER_RATE: 0.7, TIGER_HUNTER_THRESHOLD: 85, FLEE_SPEED_MULT: 1.3, TIGER_COUNT_INIT: 2, DEER_COUNT_INIT: 22, SHEEP_COUNT_INIT: 28, PLANT_COUNT_INIT: 130 },
  { label: '均衡方案C', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 75, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 22, SHEEP_COUNT_INIT: 28, PLANT_COUNT_INIT: 130 },
  { label: '均衡方案D', TIGER_SPRINT_DURATION: 17, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.25, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '冲刺15+虎少', TIGER_SPRINT_DURATION: 15, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 2, DEER_COUNT_INIT: 22, SHEEP_COUNT_INIT: 28, PLANT_COUNT_INIT: 120 },
  { label: '冲刺15+猎物多', TIGER_SPRINT_DURATION: 15, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 25, SHEEP_COUNT_INIT: 30, PLANT_COUNT_INIT: 140 },
  // ---- 第二轮：针对中等老虎数量的参数 ----
  { label: '低繁殖0.005', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120, TIGER_BREED_CHANCE: 0.005 },
  { label: '高耐力消耗1.2', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 1.2, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.3, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '大追击+小灭绝', TIGER_SPRINT_DURATION: 12, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.0, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 22, SHEEP_COUNT_INIT: 28, PLANT_COUNT_INIT: 130 },
  { label: '满30min才繁殖', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120, TIGER_BREED_MIN_AGE_MS: 60000 },
  { label: '虎上限15', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '虎食量1.0', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120, TIGER_EAT_HEAL: 10 },
  { label: '虎食量40', TIGER_SPRINT_DURATION: 16, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120, TIGER_EAT_HEAL: 40 },
  { label: '虎冲刺14', TIGER_SPRINT_DURATION: 14, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.2, TIGER_COUNT_INIT: 3, DEER_COUNT_INIT: 20, SHEEP_COUNT_INIT: 25, PLANT_COUNT_INIT: 120 },
  { label: '虎冲刺18+少繁殖', TIGER_SPRINT_DURATION: 18, TIGER_HUNGER_RATE: 0.5, TIGER_HUNTER_THRESHOLD: 80, FLEE_SPEED_MULT: 1.3, TIGER_COUNT_INIT: 2, DEER_COUNT_INIT: 22, SHEEP_COUNT_INIT: 28, PLANT_COUNT_INIT: 130, TIGER_BREED_CHANCE: 0.005 },
];

const results = [];
for (const params of paramSets) {
  const { label, ...config } = params;
  process.stdout.write(`测试: ${label.padEnd(16)}... `);
  const result = runSimulation(config);
  const e = result.extinct;
  const extinctStr = e.tiger?'🐯':'' + e.deer?'🦌':'' + e.sheep?'🐑':'';
  console.log(`得分 ${result.score.toFixed(1).padEnd(6)} 终:🐯${result.final.tiger} 🦌${result.final.deer} 🐑${result.final.sheep} ${extinctStr?'灭绝:'+extinctStr:''}`);
  results.push({ label, score: result.score, final: result.final, extinct: result.extinct });
}

// 排序并输出最佳
results.sort((a, b) => b.score - a.score);
console.log('\n═══════════════════════════════════');
console.log('🏆 最佳参数 TOP 5');
console.log('═══════════════════════════════════');
for (let i = 0; i < Math.min(5, results.length); i++) {
  const r = results[i];
  const p = paramSets.find(p => p.label === r.label);
  console.log(`\n#${i+1} ${r.label} (得分 ${r.score})`);
  console.log(`   终态: 🐯${r.final.tiger} 🦌${r.final.deer} 🐑${r.final.sheep}`);
  if (p) {
    console.log(`   参数: 冲刺=${p.TIGER_SPRINT_DURATION} 饥饿率=${p.TIGER_HUNGER_RATE} 阈值=${p.TIGER_HUNTER_THRESHOLD} 逃亡=${p.FLEE_SPEED_MULT}`);
    console.log(`   初始: 🐯${p.TIGER_COUNT_INIT} 🦌${p.DEER_COUNT_INIT} 🐑${p.SHEEP_COUNT_INIT} 🌿${p.PLANT_COUNT_INIT}`);
  }
}
