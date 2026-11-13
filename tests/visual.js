// Comparación visual original vs corregido (mismas pantallas, mismo Supabase simulado).
const {chromium}=require('playwright');
const {openApp,login}=require('./harness');
const {PNG}=require('pngjs');const pixelmatch=require('pixelmatch');
const fs=require('fs');
const [orig,fixed,outDir]=process.argv.slice(2);
fs.mkdirSync(outDir,{recursive:true});
const pages=['login','dashboard','patients','historias','evaluations','consents','diets','agenda','analisis','billing','glp1','settings','reports'];
async function shots(dir,tag){
  const browser=await chromium.launch();
  const a=await openApp(dir,{browser});
  await a.page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'}).catch(()=>{});
  await a.page.waitForTimeout(800);
  const out={};
  out.login=await a.page.screenshot();
  await login(a.page,a.mock.U.admin.email,a.mock.U.admin.password);
  await a.page.waitForTimeout(4500);
  for(const p of pages.slice(1)){
    await a.page.evaluate(p=>navigate(p),p);await a.page.waitForTimeout(2200);
    await a.page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'}).catch(()=>{});
    await a.page.evaluate(()=>{document.querySelectorAll('.toast,.notification,#nm-connection-banner,[class*="notif-toast"]').forEach(e=>e.style.visibility='hidden')});
    out[p]=await a.page.screenshot();
  }
  await browser.close();return out;
}
(async()=>{
  const A=await shots(orig,'orig'),B=await shots(fixed,'fixed');const rows=[];
  for(const p of pages){
    const a=PNG.sync.read(A[p]),b=PNG.sync.read(B[p]);const {width,height}=a;const diff=new PNG({width,height});
    const n=pixelmatch(a.data,b.data,diff.data,width,height,{threshold:0.12});
    const pct=(n/(width*height)*100);rows.push({page:p,diffPixels:n,pct:+pct.toFixed(3)});
    fs.writeFileSync(`${outDir}/${p}-original.png`,A[p]);fs.writeFileSync(`${outDir}/${p}-corregido.png`,B[p]);if(n)fs.writeFileSync(`${outDir}/${p}-diff.png`,PNG.sync.write(diff));
  }
  fs.writeFileSync(`${outDir}/visual.json`,JSON.stringify(rows,null,2));console.table(rows);
})();
