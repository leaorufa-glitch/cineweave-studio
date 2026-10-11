import {cp,mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {resolve} from "node:path";
const source=resolve(process.cwd(),"../../design/approved-ui-2026");
const dest=resolve(process.cwd(),"public/approved");
await rm(dest,{recursive:true,force:true});
await mkdir(dest,{recursive:true});
await cp(source,dest,{recursive:true});
let html=await readFile(resolve(dest,"index.html"),"utf8");
if(!html.includes("bridge.js")) html=html.replace("</body>",'<script defer src="/workspace.js"></script></body>');
await writeFile(resolve(dest,"index.html"),html,"utf8");
// Expose the original prototype's existing state/actions to the functional bridge.
// This operates on the compiled copy only; the creator-approved source remains untouched.
const appJsPath=resolve(dest,"app.js");
let appJs=await readFile(appJsPath,"utf8");
if(!appJs.includes("window.CWPrototype=")){
 appJs+="\nwindow.CWPrototype={state,projects,assets,scenes,clips,renderApp,turnPage,getAsset,getClip,getProd,toast};\n";
 await writeFile(appJsPath,appJs);
}
console.log("Copied approved seven-page HTML into public/approved, attached production workspace controller.");
