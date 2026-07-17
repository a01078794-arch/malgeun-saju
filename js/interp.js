/* 맑은사주 — 해석 조합 엔진 (interp)
 *
 * 목적: "버킷 1개 → 캔 문단 1개" 룩업을 "여러 특징 → 조립 문단"으로 바꾼다.
 * 사주가 사람마다 다른 이유는 여덟 글자의 '상호작용'(합·충·형·통근·십성 조합)인데,
 * 기존 사이트는 이걸 버리고 일간·강약·우세그룹 같은 소수 버킷만 썼다.
 * 이 파일은 그 상호작용을 실제 글자·자리 기준으로 읽어 개인별로 갈라지는 문장을 만든다.
 *
 * 순수 계산층(manseryeok.js) + 텍스트 뱅크(data.js) 위에 얹힌다. DOM 의존 없음 → 테스트 가능.
 * 반환 문장은 {easy, expert} 객체. 소비자(app.js)가 모드에 맞게 고른다.
 */
"use strict";

/* ---------- 관계 테이블 ---------- */
const IREL_YUKHAP = {0:1,1:0,2:11,11:2,3:10,10:3,4:9,9:4,5:8,8:5,6:7,7:6}; // 육합
const IREL_PA = {0:9,9:0,6:3,3:6,2:11,11:2,8:5,5:8,4:1,1:4,10:7,7:10};      // 파
const IREL_HAE = {0:7,7:0,1:6,6:1,2:5,5:2,3:4,4:3,8:11,11:8,9:10,10:9};     // 해
const IREL_TRIADS = [[8,0,4],[2,6,10],[5,9,1],[11,3,7]];  // 수·화·금·목국
const IREL_TRIAD_ELEM = ["수","화","금","목"];
const IREL_TRIAD_KING = [0,6,9,3];                        // 각 국의 왕지(子午酉卯)
const IREL_SAMHYEONG = [[2,5,8],[1,10,7]];                // 삼형: 인사신 / 축술미
const IREL_SELFHYEONG = [4,6,9,11];                       // 자형: 辰午酉亥
const POS_KO_BRANCH = {year:"연지",month:"월지",day:"일지",hour:"시지"};
const POS_KO_STEM   = {year:"연간",month:"월간",day:"일간",hour:"시간"};
const IREL_POSORDER = ["year","month","day","hour"];

function ipresent(pillars){ return IREL_POSORDER.filter(k=>pillars[k]); }
function bAt(pillars,k){ return pillars[k].branch; }
function inSameSamhyeong(a,b){ return IREL_SAMHYEONG.some(t=>t.includes(a)&&t.includes(b)); }

/* ---------- 지지 상호작용 (실제 글자·자리) ---------- */
function branchRelations(pillars){
  const keys = ipresent(pillars);
  const out = [];
  const seenPair = new Set();
  // 쌍 관계: 충 / 육합 / 파 / 해 / 상형(子卯) / 자형(같은 글자)
  for (let i=0;i<keys.length;i++){
    for (let j=i+1;j<keys.length;j++){
      const ka=keys[i], kb=keys[j];
      const a=bAt(pillars,ka), b=bAt(pillars,kb);
      const an=BRANCHES_KO[a], bn=BRANCHES_KO[b];
      const wa=POS_KO_BRANCH[ka], wb=POS_KO_BRANCH[kb];
      const tag=`${wa} ${an} ↔ ${wb} ${bn}`;
      if (((a-b)%12+12)%12===6){
        out.push({type:"충", a,b,posA:ka,posB:kb, priority:9,
          easy:`${tag} — 서로 정면으로 부딪히는 두 자리예요. 변화·이동이 잦은 대신, 한번 정리되면 오히려 시원해져요 (이런 관계를 '충'이라 불러요).`,
          expert:`${tag} 충 — 정면 대충. 해당 궁의 사안이 동(動)하는 구조, 용신 관련이면 길흉 진폭이 커진다.`});
      } else if (IREL_YUKHAP[a]===b){
        out.push({type:"육합", a,b,posA:ka,posB:kb, priority:6,
          easy:`${tag} — 서로 끌어당겨 잘 묶이는 사이예요. 협력·인연이 붙기 쉬운 자리인데, 가끔 발이 묶이기도 해요 (이런 관계를 '합'이라 불러요).`,
          expert:`${tag} 육합 — 합거·합화의 결속. 해당 궁 사안이 묶여 안정 혹은 정체로 발현.`});
      } else if (a===b && IREL_SELFHYEONG.includes(a)){
        if(seenPair.has("self"+a)) continue; seenPair.add("self"+a);
        out.push({type:"자형", a,b,posA:ka,posB:kb, priority:5,
          easy:`같은 글자 '${an}'이 겹쳐 있어요 — 고집·속앓이가 세지는 대신, 그 분야의 집요함은 남달라요 (이걸 '자형'이라 불러요).`,
          expert:`${an}${an} 자형 — 동기 중복의 내향 형. 완고·자기소모 경향, 해당 오행 편중 심화.`});
      } else if ((a===0&&b===3)||(a===3&&b===0)){
        out.push({type:"상형", a,b,posA:ka,posB:kb, priority:5,
          easy:`${tag} — 예의·관계에서 엇박이 나기 쉬운 자리예요. 말·문서를 분명히 하면 관리돼요 (이런 관계를 '형'이라 불러요).`,
          expert:`${tag} 자묘 상형(무례지형) — 관계 마찰 경향, 명문화가 처방.`});
      } else if (IREL_PA[a]===b && !inSameSamhyeong(a,b)){
        out.push({type:"파", a,b,posA:ka,posB:kb, priority:3,
          easy:`${tag} — 살짝 어긋나는 자리예요. 영향이 약한 편이라 배경 소음 정도로 봐도 돼요 (이름은 '파').`,
          expert:`${tag} 파 — 경미한 파의 신살, 경중 낮음.`});
      } else if (IREL_HAE[a]===b && !inSameSamhyeong(a,b)){
        out.push({type:"해", a,b,posA:ka,posB:kb, priority:3,
          easy:`${tag} — 가까울수록 사소한 서운함이 생기기 쉬운 자리예요. 기대치 관리가 요령이에요 (이름은 '해').`,
          expert:`${tag} 육해 — 은근한 손상·서운의 신살, 경중 낮음.`});
      }
    }
  }
  // 삼합/반합 (왕지 포함 여부)
  const bset = keys.map(k=>bAt(pillars,k));
  IREL_TRIADS.forEach((tri,ti)=>{
    const have = tri.filter(x=>bset.includes(x));
    const uniq = [...new Set(have)];
    const king = IREL_TRIAD_KING[ti];
    const glyphs = tri.map(x=>BRANCHES_KO[x]).join("");
    if (uniq.length===3){
      out.push({type:"삼합", elem:IREL_TRIAD_ELEM[ti], priority:8,
        easy:`세 글자(${glyphs})가 뭉쳐 ${ELEM_KO[IREL_TRIAD_ELEM[ti]]} 기운의 큰 세력을 이뤄요 — 이 사주의 뚜렷한 힘의 방향이에요 (이걸 '삼합'이라 불러요).`,
        expert:`${glyphs} 삼합국 성립 — ${IREL_TRIAD_ELEM[ti]}기 국세 형성, 격국 판단의 중심축.`});
    } else if (uniq.length===2 && uniq.includes(king)){
      const other = uniq.find(x=>x!==king);
      out.push({type:"반합", elem:IREL_TRIAD_ELEM[ti], priority:5,
        easy:`${ELEM_KO[IREL_TRIAD_ELEM[ti]]} 기운이 절반쯤 뭉쳐 있어요(${BRANCHES_KO[king]}·${BRANCHES_KO[other]}) — 나머지 한 글자가 운에서 들어오는 해에 힘이 완성돼요 (이걸 '반합'이라 불러요).`,
        expert:`${BRANCHES_KO[king]}${BRANCHES_KO[other]} 반합 — 왕지 포함 반국, 전실운에 성국.`});
    }
  });
  // 삼형 (2자 이상). 단 부분(2자)이 충(차이 6)이면 형이 아니라 충 — 寅申·丑未는 형 표기 제외
  IREL_SAMHYEONG.forEach(tri=>{
    const have=[...new Set(tri.filter(x=>bset.includes(x)))];
    if (have.length<2) return;
    const full = have.length===3;
    if (!full && ((have[0]-have[1])%12+12)%12===6) return;
    out.push({type:"삼형", priority: full?8:4,
      easy: full
        ? `세 글자(${have.map(x=>BRANCHES_KO[x]).join("·")})가 모여 시비·계약 변동이 커질 수 있는 축을 이뤄요 — 관련된 해엔 서류를 꼼꼼히 보세요 (이걸 '삼형'이라 불러요).`
        : `${have.map(x=>BRANCHES_KO[x]).join("·")} 글자 사이에 은근한 마찰 기운이 있어요 — 무리한 확장보다 정리에 강한 구조예요 (이름은 '형').`,
      expert:`${have.map(x=>BRANCHES_KO[x]).join("")} ${full?"삼형 전(全)":"형 부분"} — ${full?"지세지형/무은지형 완성, 관재·질병·계약 사안 주의":"형 기운 부분 성립"}.`});
  });
  out.sort((a,b)=>b.priority-a.priority);
  return out;
}

/* ---------- 천간 상호작용 ---------- */
const IREL_STEMHAP = {0:5,5:0,1:6,6:1,2:7,7:2,3:8,8:3,4:9,9:4}; // 갑기 을경 병신 정임 무계
const IREL_STEMHAP_ELEM = {0:"토",5:"토",1:"금",6:"금",2:"수",7:"수",3:"목",8:"목",4:"화",9:"화"};
function stemRelations(pillars){
  const keys = IREL_POSORDER.filter(k=>pillars[k]);
  const out=[];
  for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){
    const sa=pillars[keys[i]].stem, sb=pillars[keys[j]].stem;
    if (IREL_STEMHAP[sa]===sb){
      const tag=`${POS_KO_STEM[keys[i]]} ${STEMS_KO[sa]} ↔ ${POS_KO_STEM[keys[j]]} ${STEMS_KO[sb]}`;
      const inv = keys[i]==="day"||keys[j]==="day";
      out.push({type:"천간합", priority: inv?8:5, involvesDay:inv,
        easy:`${tag} — 두 기운이 손을 잡고 ${ELEM_KO[IREL_STEMHAP_ELEM[sa]]} 쪽으로 향하는 배합이에요${inv?". 특히 나(일간)가 직접 잡는 손이라 크게 작용해요":""} (이걸 '천간합'이라 불러요).`,
        expert:`${tag} 천간합(化${IREL_STEMHAP_ELEM[sa]})${inv?" — 일간 합, 기반(羈絆)/합화 여부가 관건":""}.`});
    }
  }
  out.sort((a,b)=>b.priority-a.priority);
  return out;
}

/* ---------- 통근(뿌리) ---------- */
function rootedness(pillars){
  const ds = pillars.day.stem, de = STEM_ELEM[ds];
  const roots=[];
  for (const k of IREL_POSORDER){
    const p=pillars[k]; if(!p) continue;
    const hs = HIDDEN_STEMS[BRANCHES[p.branch]];
    // 같은 오행의 지장간이 있으면 통근
    if (hs.some(h=>STEM_ELEM[STEMS.indexOf(h)]===de)) roots.push(k);
  }
  const strong = roots.includes("day") || roots.includes("month");
  let easy, expert;
  if (roots.length===0){
    easy = "일간이 지지에 뿌리가 거의 없는 편 — 혼자 버티기보다 '내 편(사람·공부·자격)'을 곁에 두면 훨씬 단단해지는 구조예요.";
    expert = "일간 무근(無根)에 가까움 — 인비의 부신 또는 종세(從勢) 논의 대상. 재관 태과 시 부담.";
  } else if (strong){
    easy = `일간이 ${roots.map(k=>POS_KO_BRANCH[k]).join("·")}에 뿌리를 두고 있어요 — 밀어붙이고 감당하는 체력이 있는 자립형 구조예요.`;
    expert = `일간 통근 (${roots.map(k=>POS_KO_BRANCH[k]).join("·")}) — 유근 신주, 억부상 설기·극제를 감당.`;
  } else {
    easy = `일간의 뿌리가 ${roots.map(k=>POS_KO_BRANCH[k]).join("·")}에 얕게 있어요 — 평소엔 유연하다가 도움을 받는 운에 힘이 확 실리는 구조예요.`;
    expert = `일간 미근(微根, ${roots.map(k=>POS_KO_BRANCH[k]).join("·")}) — 뿌리 약함, 인비운 부신에 발현.`;
  }
  return {roots, strong, easy, expert};
}

/* ---------- 십성 다중집합 ---------- */
const GOD_GROUP = {"비견":"비겁","겁재":"비겁","식신":"식상","상관":"식상","편재":"재성","정재":"재성","편관":"관성","정관":"관성","편인":"인성","정인":"인성"};
function godCounts(pillars){
  const ds = pillars.day.stem;
  const g = {}; const grp = {"비겁":0,"식상":0,"재성":0,"관성":0,"인성":0};
  const add = name => { g[name]=(g[name]||0)+1; grp[GOD_GROUP[name]]++; };
  for (const k of IREL_POSORDER){
    const p=pillars[k]; if(!p) continue;
    if (k!=="day") add(tenGod(ds,p.stem));
    add(tenGodBranch(ds,p.branch));
  }
  return {g, grp};
}
function has(g,name){ return (g[name]||0)>0; }

/* ---------- 십성 조합 구조 (격/구조) — 개인차의 핵심 ---------- */
function godStructures(pillars){
  const {g,grp} = godCounts(pillars);
  const st = strengthEstimate(pillars).label;
  const weak = st==="신약(참고)", strong = st==="신강(참고)";
  const out=[];
  const push=(key,pri,easy,expert)=>out.push({key,priority:pri,easy,expert});

  const sikSang = has(g,"식신")||has(g,"상관");
  const jae = has(g,"편재")||has(g,"정재");

  if (sikSang && jae && !weak){
    if (has(g,"식신")){
      push("식신생재", 9,
        `꾸준히 파고든 솜씨와 전문성이 그대로 안정적인 수입으로 이어지는 배치예요. 한 우물을 깊게 파서 벌어먹는, 돈이 단단하게 모이는 구조입니다 (전문용어로 '식신생재').`,
        `식신생재 — 식신의 전일한 생재. 안정 축재형, 재원이 꾸준하고 도식만 관리하면 튼튼.`);
    } else {
      push("상관생재", 9,
        `순발력·기획·화제성이 곧바로 돈이 되는 배치예요. 폭발력이 큰 대신 수입의 오르내림도 커서, 잘 벌 때 미리 묶어두는 게 관건입니다 (전문용어로 '상관생재').`,
        `상관생재 — 상관의 총명·확장형 생재. 진폭 크고 기회 민감, 패인·강제 축장이 안정화 장치.`);
    }
  }
  if (has(g,"상관") && has(g,"정관")){
    push("상관견관", 8,
      `톡톡 튀는 표현력과 규칙·윗사람의 기운이 한 사주에 같이 있어요. 실력은 인정받되 말이 권위를 건드릴 때 탈이 나니, 표현 수위 조절이 평생 무기입니다 (전문용어로 '상관견관').`,
      `상관견관 — 상관이 정관을 극하는 파격 요인, 패인·거관으로 해소 여부가 관건.`);
  }
  // 재다신약: 재성이 많거나(≥3), 재생살(재≥2 + 관살≥2로 재→관 부담이 겹칠 때)이면 성립
  if (weak && (grp["재성"]>=3 || (grp["재성"]>=2 && grp["관성"]>=2))){
    const jaesal = grp["재성"]<3;
    push("재다신약", 9,
      `돈그릇은 큰데 그걸 감당할 내 힘이 아직 여린 구조예요.${jaesal?" 게다가 돈이 다시 책임·압박으로 이어져 부담이 겹치기 쉽습니다." : ""} 옛말로 '부잣집의 가난한 사람'이라 불렀지만 처방도 분명합니다 — 나를 받쳐주는 기운(동료·공부·자격)이 들어오는 시기에 큰돈이 잡혀요 (전문용어로 '재다신약').`,
      `재다신약${jaesal?"(재생살)":""} — 재중신경(財重身輕). 비겁·인성 부신운에 발재, 재→살 유통으로 부담 가중.`);
  }
  if (grp["관성"]>=3 && weak){
    push("관살태과", 7,
      `책임·압박의 기운이 큰데 몸은 여린 편이에요. 다 혼자 떠안기보다 자격·공부로 그 압박을 소화하는 게 이 사주의 살길입니다 (전문용어로 '관살태과').`,
      `관살태과 신약 — 살중신경. 인성 통관(살인상생)이 정법, 식상 제살은 신약 시 부담.`);
  }
  if (has(g,"편관") && (has(g,"식신")||has(g,"상관")) && !weak){
    push("식상제살", 7,
      `나를 밀어붙이는 압박을 재능으로 되받아치는 구조예요. 시련이 클수록 실력으로 눌러 이기는, 카리스마가 서는 배치입니다 (전문용어로 '식상제살').`,
      `식상제살 — 제살태과 여부만 관리하면 권력 구조. 신주 강약이 제화 강도를 좌우.`);
  }
  if (has(g,"편관") && (has(g,"편인")||has(g,"정인"))){
    const looseSanggwan = has(g,"상관") && has(g,"정관");
    push("살인상생", 6,
      `시련과 압박이 공부·자격을 거쳐 내 실력으로 바뀌는 배치예요. 고생이 스펙이 되는, 늦게라도 크게 되는 구조입니다.${looseSanggwan?" 단, 말이 윗사람을 건드리는 기운도 함께 있어 표현 수위 조절이 먼저입니다." : ""} (전문용어로 '살인상생')`,
      `살인상생 — 살→인→일 유통, 귀격 배합의 정로.${looseSanggwan?" 상관견관 공존 — 거관 리스크 관리가 전제." : ""}`);
  }
  if (has(g,"정관") && (has(g,"편인")||has(g,"정인")) && !has(g,"상관")){
    push("관인상생", 6,
      `직장·명예의 기운과 공부·자격의 기운이 서로를 살려주는 배치예요. 조직 안에서 자격을 무기로 올라가는 정통 성공 루트를 타고났습니다 (전문용어로 '관인상생').`,
      `관인상생 — 관→인→신의 정순 유통, 청귀(淸貴)의 배합.`);
  }
  if (grp["비겁"]>=3 && jae){
    push("군겁쟁재", 6,
      `내 편이 많은 만큼 돈을 나눠 갖기도 쉬운 구조예요. 동업·돈거래·보증이 돈을 잃는 1순위 통로이니, 사람과 돈은 섞지 않는 게 철칙입니다 (전문용어로 '군겁쟁재').`,
      `군겁쟁재 — 비겁이 재를 분탈. 재정 분리·단독 운용이 처방, 겁재운 가중 주의.`);
  }
  if ((has(g,"편인")||has(g,"정인")) && has(g,"식신") && grp["인성"]>=2 && grp["식상"]<=1){
    push("도식", 5,
      `생각·자격은 많은데 실행·표현이 눌리기 쉬운 기미가 있어요. 배운 걸 반드시 밖으로 꺼내 결과물로 만드는 습관이 보약입니다 (전문용어로 '편인도식').`,
      `편인도식(효신탈식) 기미 — 인다신왕 시 식상 설기 통로 확보가 관건.`);
  }
  if (has(g,"상관") && (has(g,"편인")||has(g,"정인"))){
    const jeongIn = has(g,"정인"), gyeongwan = has(g,"정관");
    push("상관패인", 5,
      `톡톡 튀는 재능을 ${jeongIn?"정통 공부·자격":"전문 기술·직관"}이 다듬어주는 배치예요. ${gyeongwan?"말이 윗사람을 건드리는 위 기운을 바로 이 공부 기운이 풀어줍니다 — ":""}자격을 먼저 갖추고 표현할 때 이 재능이 칼집을 얻습니다 (전문용어로 '상관패인').`,
      `상관패인 — ${jeongIn?"정인":"편인"}이 상관을 제어.${gyeongwan?" 상관견관의 해소 기제(패인)로 작동." : ""} 파격을 성격으로 전환하는 정법.`);
  }
  if (grp["인성"]===0){
    push("무인성", 4,
      `사주에 공부·자격·기댈 언덕의 기운(인성)이 드러나 있지 않아요 — 남의 도움보다 실전·경험으로 배우는 자수성가형이라는 뜻. 자격증 하나를 의식적으로 챙기면 약점이 메워집니다.`,
      `무인성 — 자화(自化)·실전 학습형. 인성운 도래 시 문서·자격 기회로 발현.`);
  }
  if (grp["재성"]===0){
    push("무재", 4,
      `사주에 돈을 뜻하는 글자(재성)가 드러나 있지 않아요 — 돈이 없다는 게 아니라 돈이 1순위 동기가 아니라는 뜻. 실력·명예를 쌓으면 돈이 따라오는 유형이에요.`,
      `무재 — 재불투. 업(業) 중심 우회 축재, 식상·관성 축이 대신 격의 중심.`);
  }
  out.sort((a,b)=>b.priority-a.priority);
  return out;
}

/* ---------- 본질 조합 (일간 × 계절 × 강약·통근 × 대표 구조) ---------- */
// 일간별 한 줄 핵심(본질 헤드라인 — data.js DAY_MASTER_TEXT의 첫 문장을 축약 재사용하지 않고 축별로 분리)
function composeEssence(r){
  const P=r.pillars, ds=P.day.stem;
  const season = seasonOfMonthIdx(r.monthIdx);
  const dm = DAY_MASTER_TEXT[STEMS[ds]];
  const root = rootedness(P);
  const structs = godStructures(P);
  const {grp} = godCounts(P);
  const domGroup = Object.entries(grp).sort((a,b)=>b[1]-a[1])[0];

  const frags=[];
  // 1) 일간 기본 (계절 라벨과 함께 — 축1)
  frags.push({
    easy:`${SEASON_NAMES[season]}에 태어난 ${dm.title} — ${dm.easy}`,
    expert:`${SEASON_NAMES[season]}생 ${STEMS_KO[ds]}(${STEMS[ds]}). ${dm.expert}`
  });
  // 2) 계절 조후 (축2) — 쉬운말은 "뜻+행동"(JOHU_EASY), 전문가는 궁통보감 요약
  frags.push({
    easy:`🌿 나의 보약 — ${JOHU_EASY[STEM_ELEM[ds]][season]}`,
    expert:`조후(궁통보감 요약) — ${JOHU_HINT[STEM_ELEM[ds]][season]}.`
  });
  // 3) 강약 + 통근 (축3) — 두 사람이 같은 일간이어도 여기서 갈림
  frags.push({easy:root.easy, expert:root.expert});
  // 4) 대표 구조 (축4) — 개인차의 핵심. 없으면 우세 그룹으로 대체
  if (structs.length){
    frags.push({easy:`한마디로 이 사주는 — ${structs[0].easy}`, expert:`핵심 구조: ${structs[0].expert}`});
  } else {
    frags.push({
      easy:`기운의 무게중심은 <b>${domGroup[0]}</b> 쪽 — ${CAREER_GROUP_TEXT[domGroup[0]].easy}`,
      expert:`오행/십성 편중: ${domGroup[0]} 우세.`
    });
  }
  return {title:`${SEASON_NAMES[season]}의 ${dm.title}`, frags, structs, root, domGroup};
}

/* ---------- "그래서 뭐?" 한 줄 쉬운 결론 (챕터 맨 위용) ---------- */
function plainVerdict(pillars){
  const {grp} = godCounts(pillars);
  const domGroup = Object.entries(grp).sort((a,b)=>b[1]-a[1])[0][0];
  const cg = CAREER_GROUP_TEXT[domGroup];
  const structs = godStructures(pillars);
  if (structs.length){
    let gist = structs[0].easy.replace(/\s*\((전문용어로|이름은|이걸)[^)]*\)/g, "").trim(); // 용어 괄호 제거
    gist = gist.replace(/^(.*?[요다])\..*$/, "$1.");           // 첫 문장까지만 (한마디로 = 짧게)
    return `당신은 <b>"${cg.title}"</b> — ${gist}`;
  }
  return `당신은 <b>"${cg.title}"</b> — ${cg.easy}`;
}

/* ---------- "이럴 땐 이렇게" 실천 팁 (구조에서 도출) ---------- */
function actionTips(pillars){
  const {g, grp} = godCounts(pillars);
  const keys = godStructures(pillars).map(s=>s.key);
  const tips = [];
  const add = t => { if (tips.length < 4 && !tips.includes(t)) tips.push(t); };
  if (keys.includes("재다신약")) add("큰돈은 혼자 안고 가기보다 <b>조직 소속·전문 자격·남의 돈을 다루는 일</b>이 유리해요. 동업·보증·큰 대여는 피하고, 들어온 돈은 자동이체로 묶어두세요.");
  if (keys.includes("식신생재")) add("<b>한 우물을 깊게 파는 전문성</b>이 그대로 돈이 되는 사주예요. 자격·기술을 꾸준히 쌓으면 안정적으로 벌립니다.");
  if (keys.includes("상관생재")) add("순발력·기획·화제성이 돈이 되지만 <b>수입 오르내림이 큰</b> 편 — 잘 벌 때 미리 묶어두는(저축·고정자산) 습관이 관건이에요.");
  if (keys.includes("상관견관")) add("실력은 인정받되, 상사·규칙과 부딪힐 것 같을 땐 <b>한 템포 쉬고</b> 말하세요. 그 한 박자가 이 사주의 평생 무기예요.");
  if (keys.includes("군겁쟁재")) add("<b>돈과 사람은 섞지 마세요</b> — 동업·보증·지인 대여가 이 사주가 돈을 잃는 1순위 통로예요.");
  if (keys.includes("무인성")) add("기댈 언덕보다 실전으로 크는 타입 — <b>자격증 하나</b>를 의식적으로 챙기면 약점이 메워져요.");
  if (keys.includes("관인상생") || keys.includes("살인상생")) add("<b>자격·공부를 무기로 조직 안에서 올라가는 길</b>이 잘 맞아요. 시련이 실력으로 바뀌는 구조예요.");
  if (keys.includes("도식")) add("배운 걸 머릿속에만 두지 말고 <b>반드시 밖으로 꺼내 결과물</b>로 만드세요 — 그게 이 사주의 보약이에요.");
  if (grp["식상"] >= 3) add("표현·재능이 많은 만큼 방전도 빨라요 — <b>쉼·수면·물 챙기기</b>가 곧 실력 관리예요.");
  if ((g["편재"]||0) >= 2) add("굴리는 돈이 도드라져 들어온 만큼 나가기 쉬워요 — <b>월급날 자동저축</b>을 걸어두세요.");
  const cnt = elementCount(pillars);
  const lackAdvice = {"목":"새 일은 계획을 세워 천천히 시작하기","화":"나를 알리고 드러내는 연습","토":"루틴·안정 장치 만들기","금":"거절과 마무리 연습","수":"휴식·수분·수면 챙기기"};
  Object.entries(cnt).filter(([,v])=>v===0).forEach(([e])=>{ if(lackAdvice[e]) add(`${ELEM_KO[e]}(${e}) 기운이 없는 편 — <b>${lackAdvice[e]}</b>가 보약이에요.`); });
  if (!tips.length) add("큰 결정은 서두르지 말고, <b>잘 맞는 사람·환경</b>을 곁에 두는 게 이 사주의 개운법이에요.");
  return tips.slice(0, 3);
}

/* ---------- 조건부 공통 처방 (전원 동일 잔소리 제거) ---------- */
function conditionalNotes(pillars){
  const {g,grp} = godCounts(pillars);
  const notes=[];
  if (grp["비겁"]>=3 || has(g,"겁재")){
    notes.push({tag:"돈·사람", easy:"동업·보증·큰돈 빌려주기 주의 — 비겁이 강한 사주라 '사람'이 돈이 새는 통로가 되기 쉬워요. 특히 비겁이 세지는 해에는요.",
      expert:"비겁 왕 — 쟁재 리스크. 재정 분리·단독 운용, 겁재 세운 경계."});
  }
  if ((g["편재"]||0)>=2 || (grp["재성"]>=2 && has(g,"편재"))){
    notes.push({tag:"저축", easy:"굴리는 돈(편재)이 도드라진 사주 — 들어온 만큼 나가기 쉬우니 '월급날 자동 저축'을 걸어두는 게 평생 보약이에요.",
      expert:"편재 우세 — 입출 큰 유동재. 강제 축장(자동이체·묶는 자산)이 처방."});
  }
  if (grp["식상"]>=3){
    notes.push({tag:"에너지", easy:"표현·재능(식상)이 많은 사주 — 쏟아내는 만큼 방전도 빨라요. 쉼·수면·물 챙기기가 곧 실력 관리예요.",
      expert:"식상 태과 — 설기 과다. 휴식·조후 관리가 컨디션의 관건."});
  }
  return notes;
}

/* ---------- 최상위: 구조화된 리딩(테스트·렌더 공용) ---------- */
function interpret(r, mode){
  mode = mode||"easy";
  const pick = o => o[mode]||o.easy;
  const P=r.pillars;
  const ess = composeEssence(r);
  return {
    essenceTitle: ess.title,
    essence: ess.frags.map(pick),
    branchRel: branchRelations(P).map(pick),
    stemRel: stemRelations(P).map(pick),
    structures: ess.structs.map(pick),
    notes: conditionalNotes(P).map(pick),
    _raw: ess // app.js가 세부 접근
  };
}

// 브라우저/노드 공용 노출
if (typeof module!=="undefined" && module.exports){
  module.exports = {branchRelations, stemRelations, rootedness, godCounts, godStructures, composeEssence, conditionalNotes, interpret};
}
