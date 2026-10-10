import { escapeText as esc, sequenceScenes } from "../learner/composition.mjs";
import { validatePlan } from "./model.mjs";
export function compositionHTML(input) {
  const plan = validatePlan(input);
  const scenes = sequenceScenes(plan.scenes);
  const duration = scenes.at(-1).end;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(plan.title)}</title>
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff;font-family:sans-serif}#motion{position:relative;width:100%;height:100%;background:#000}#brand{position:absolute;left:60px;top:36px;display:flex;align-items:center;gap:12px;font-size:16px;font-weight:650;color:#c9c9c9}#brand img{width:30px;height:30px;background:#fff;padding:3px;border-radius:3px}#title{position:absolute;right:60px;top:42px;color:#888;font-size:14px}.scene{position:absolute;inset:108px 60px 78px;opacity:0}.scene h1{margin:0;font-size:52px;letter-spacing:-1.5px;line-height:1.08;max-width:1040px}.explanation{font-size:25px;line-height:1.5;color:#bababa;max-width:950px;margin:26px 0 0}.visual{height:240px;display:flex;align-items:center;justify-content:center;gap:22px}.node{min-width:150px;max-width:245px;padding:25px 20px;background:#1b1b1b;border:1px solid #373737;border-radius:8px;text-align:center;overflow-wrap:anywhere;font-size:25px;font-weight:650}.pipeline .node{font-size:22px}.tokens .node{min-width:130px;font-size:36px;padding:28px 20px}.compare .node{padding:34px 20px;border-top:4px solid #ffd02f}.arrow{color:#747474;font-size:34px}.footer{position:absolute;bottom:28px;left:60px;right:60px;display:flex;justify-content:space-between;color:#8a8a8a;font-size:14px}.track{position:absolute;left:60px;right:60px;bottom:59px;height:3px;background:#252525}.fill{height:100%;background:#ffd02f;transform-origin:left center}.scene-label{color:#ffd02f;font-size:16px;display:block;margin-bottom:20px}</style></head><body>
<div id="motion" data-composition-id="motion" data-width="1280" data-height="720" data-duration="${duration}"><div id="brand"><img src="./lds-logo.svg" alt="LDS">AI Motion Designer</div><div id="title">${esc(plan.title)}</div>
${scenes.map((scene, i) => `<section class="scene" id="scene-${i}"><span class="scene-label">${String(i + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}</span><h1>${esc(scene.title)}</h1><p class="explanation">${esc(scene.text)}</p><div class="visual ${scene.kind}">${scene.labels.map((label, n) => `${n && scene.kind === "pipeline" ? '<span class="arrow">→</span>' : ""}<div class="node" id="node-${i}-${n}">${esc(label)}</div>`).join("")}</div></section>`).join("")}
<div class="track"><div class="fill" id="fill"></div></div><div class="footer"><span>Illustrative explanation · review facts before publishing</span><span>Made with HyperFrames</span></div></div>
<script src="./gsap.min.js"></script><script>
const tl=gsap.timeline({paused:true});
${scenes
  .map(
    (
      scene,
      i,
    ) => `tl.fromTo('#scene-${i}',{opacity:0},{opacity:1,duration:0.35},${scene.start});
tl.fromTo('#scene-${i} h1',{y:16},{y:0,duration:0.65,ease:'power2.out'},${scene.start});
${scene.labels
  .map(
    (
      _,
      n,
    ) => `tl.fromTo('#node-${i}-${n}',{opacity:0,y:28,scale:0.94},{opacity:1,y:0,scale:1,duration:0.65,ease:'power2.out'},${scene.start + 0.5 + n * 0.45});
tl.to('#node-${i}-${n}',{borderColor:'#ffd02f',color:'#ffd02f',duration:0.3},${scene.start + 1.3 + n * 0.45});`,
  )
  .join("\n")}
${i < scenes.length - 1 ? `tl.to('#scene-${i}',{opacity:0,duration:0.3},${scene.end - 0.3});` : ""}`,
  )
  .join("\n")}
tl.fromTo('#fill',{scaleX:0},{scaleX:1,duration:${duration},ease:'none'},0);
window.__timelines=window.__timelines||{};window.__timelines.motion=tl;
// Preview messages contain a number only; no caller can supply code or DOM.
addEventListener('message',(event)=>{if(event.source!==parent)return;const time=event.data?.motionTime;if(Number.isFinite(time))tl.seek(Math.max(0,Math.min(${duration},time)),false)});
tl.seek(0.01,false);parent.postMessage({motionReady:true},'*');
</script></body></html>`;
}
