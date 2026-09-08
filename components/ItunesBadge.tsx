import Image from "next/image";
import { itunesArtworkUrl } from "@/lib/images/itunes";
export function ItunesBadge({id,coverUrl}:{id?:string|null;coverUrl?:string|null}) {
 if(!id||!/^[0-9]{1,20}$/.test(id)||!itunesArtworkUrl(coverUrl))return null;
 return <a href={`https://itunes.apple.com/album/id${id}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 p-1" aria-label="Ver este álbum en iTunes Store"><Image src="/assets/itunes-badge.png" alt="Get it on iTunes Store" width={104} height={30} /></a>;
}
