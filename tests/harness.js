const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const {createMock}=require('./mock-supabase');
// Copias locales de las librerías CDN (npm install): las pruebas no dependen de Internet.
const libFile=(pkg,file)=>path.join(path.dirname(require.resolve(pkg)),file);
const LIBS={'chart.umd.min.js':libFile('chart.js','chart.umd.js'),'html2pdf.bundle.min.js':libFile('html2pdf.js','html2pdf.bundle.min.js')};
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
async function openApp(dir,opts={}){
  const mock=opts.mock||createMock();
  const browser=opts.browser||await chromium.launch();
  const context=await browser.newContext({viewport:{width:1366,height:850}});
  const page=await context.newPage();
  const errors=[],consoleErrors=[],rejections=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e&&e.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  await page.addInitScript(()=>{window.__rej=[];window.addEventListener('unhandledrejection',e=>{window.__rej.push(String(e.reason&&e.reason.message||e.reason))})});
  await context.route('**/*',async route=>{
    const req=route.request();const url=req.url();
    if(url.startsWith('http://nutrimachata.test/')){
      let p=decodeURIComponent(new URL(url).pathname);if(p==='/')p='/index.html';
      const f=path.join(dir,p);
      if(!fs.existsSync(f)){requests.push({url,status:404});return route.fulfill({status:404,body:'nf'})}
      return route.fulfill({status:200,headers:{'content-type':MIME[path.extname(f)]||'application/octet-stream'},body:fs.readFileSync(f)});
    }
    if(url.includes('supabase.co')){
      requests.push({url,method:req.method()});
      const r=await mock.handle(req.method(),url,req.headers(),req.postData());
      if(r==='abort')return route.abort('internetdisconnected');
      if(r==='hang'){await new Promise(res=>setTimeout(res,opts.hangMs||60000));return route.abort('timedout').catch(()=>{})}
      return route.fulfill(r);
    }
    if(url.includes('cdnjs.cloudflare.com')){const n=url.split('/').pop();if(LIBS[n])return route.fulfill({status:200,headers:{'content-type':'application/javascript'},body:fs.readFileSync(LIBS[n])});}
    if(url.includes('fonts.googleapis.com')||url.includes('fonts.gstatic.com'))return route.fulfill({status:200,headers:{'content-type':'text/css'},body:''});
    return route.abort();
  });
  await page.goto('http://nutrimachata.test/index.html');
  await page.waitForLoadState('load');
  return {browser,context,page,mock,errors,consoleErrors,requests,rejections:()=>page.evaluate(()=>window.__rej)};
}
async function login(page,email,pass){
  await page.fill('#login-email',email);await page.fill('#login-password',pass);
  await page.click('#login-submit');
}
module.exports={openApp,login,createMock};
