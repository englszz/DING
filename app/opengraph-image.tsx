import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export const alt = "DING — Tu diario musical. Registra, califica y descubre música.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function SocialImage() {
 const icon = await readFile(join(process.cwd(), "public/assets/icon-white.png"));
 return new ImageResponse(<div style={{display:"flex",width:"100%",height:"100%",background:"#0097b2",color:"white",alignItems:"center",justifyContent:"center",flexDirection:"column",padding:70}}>
   <div style={{display:"flex",alignItems:"center",gap:28}}><img src={`data:image/png;base64,${icon.toString("base64")}`} width={145} height={145} alt=""/><span style={{fontSize:150,fontWeight:800,letterSpacing:-8}}>DING</span></div>
   <div style={{display:"flex",fontSize:48,marginTop:26}}>Tu diario musical</div>
   <div style={{display:"flex",fontSize:25,marginTop:24,color:"#d9f7fc"}}>Registra · Califica · Descubre</div>
 </div>, size);
}
