/** iTunes artwork is served only from Apple's image CDN. */
export function itunesArtworkUrl(value:unknown):string|undefined {
 if(typeof value!=="string")return;
 try {const url=new URL(value);if(url.protocol!=="https:"||url.port||url.username||url.password||!/^is[0-9]+-ssl\.mzstatic\.com$/.test(url.hostname)||!url.pathname.startsWith('/image/'))return;url.pathname=url.pathname.replace(/100x100bb(?=\.)/,'600x600bb');return url.href;}catch{return;}
}
