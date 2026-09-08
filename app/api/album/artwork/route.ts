import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {itunesArtworks} from "@/lib/itunes/api";
export async function POST(request:Request) {
 const parsed=z.object({ids:z.array(z.string().regex(/^[0-9]{1,20}$/)).min(1).max(20)}).safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Referencias inválidas"},{status:400});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:"Inicia sesión"},{status:401});
 try {const covers=await itunesArtworks(parsed.data.ids);
 for(const cover of covers){const {error}=await db.rpc("ding_set_itunes_artwork",{p_id:cover.id,p_url:cover.url});if(error)console.warn("artwork_persistence_failed",{code:error.code});}
 return NextResponse.json({covers});
 }catch{return NextResponse.json({error:"No pudimos cargar las portadas"},{status:502});}
}
