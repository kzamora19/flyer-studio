// Flyer Studio catalog proxy — no credentials, no dynamic host forwarding.
// Public product listings with an explicit browser-origin allowlist.
const STORE = "https://www.1stmegasaver.com.ph";
const ORIGINS = new Set([
  "https://kzamora19.github.io",
  "https://flyer-studio-ken-s-project5.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_BYTES = 20 * 1024 * 1024;
function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
function json(payload: unknown, code: number, origin: string): Response {
  return new Response(JSON.stringify(payload), {
    status: code, headers: {...cors(origin), "Content-Type": "application/json"}
  });
}
function storeUrl(raw: string | null, prefix: string): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.origin === STORE && !url.username && !url.password &&
      url.pathname.startsWith(prefix) ? url : null;
  } catch { return null; }
}
function hasModel(name: string, model: string): boolean {
  const parts = model.match(/[a-z0-9]+/gi);
  if (!parts) return false;
  return new RegExp("(?:^|[^a-z0-9])" + parts.join("[^a-z0-9]*") + "(?![a-z0-9])", "i").test(name);
}
async function storeFetch(url: URL): Promise<Response> {
  const response = await fetch(url, {redirect:"error",signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw Error("Catalog request failed");
  return response;
}
async function searchProducts(field: string, value: string): Promise<any[]> {
  const url = new URL("/wp-json/wc/store/v1/products", STORE);
  url.search = new URLSearchParams({[field]:value,per_page:"20"}).toString();
  const result = await (await storeFetch(url)).json();
  if (!Array.isArray(result)) throw Error("Catalog response is invalid");
  return result;
}
async function photos(sku: string, model: string) {
  let products = (await searchProducts("sku",sku)).filter((p:any)=>p?.sku===sku);
  let match = "barcode";
  if (!products.length && model) {
    products = (await searchProducts("search",model)).filter((p:any)=>hasModel(String(p?.name||""),model));
    match = "model";
  }
  return products.flatMap((p:any)=>{
    if (!storeUrl(p?.permalink,"/product/") || !Array.isArray(p.images)) return [];
    return p.images.flatMap((item:any)=>{
      const original = storeUrl(item?.src,"/wp-content/uploads/");
      const preview = storeUrl(item?.thumbnail,"/wp-content/uploads/") || original;
      return original ? [{
        title:String(p.name||""),sku:String(p.sku||""),match,source:String(p.permalink),
        original:original.href,preview:preview?.href||original.href
      }] : [];
    });
  }).slice(0,12);
}
Deno.serve(async (request: Request): Promise<Response> => {
  const origin = request.headers.get("origin")||"";
  if (!ORIGINS.has(origin)) return new Response("Origin not allowed.", {status:403});
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  if (request.method!=="GET") return json({error:"GET is required"},405,origin);
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  try {
    if (mode==="photos") {
      const sku = (url.searchParams.get("sku")||"").trim();
      const model = (url.searchParams.get("model")||"").trim();
      if (!sku || sku.length>100 || model.length>100) return json({error:"Enter a valid SKU or model."},400,origin);
      return json({photos:await photos(sku,model)},200,origin);
    }
    if (mode==="image") {
      const imageUrl = storeUrl(url.searchParams.get("url"),"/wp-content/uploads/");
      if (!imageUrl) return json({error:"Choose a photo from the 1st Megasaver catalog."},400,origin);
      const response=await storeFetch(imageUrl);
      const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
      if (!["image/jpeg","image/png","image/webp"].includes(type)) {
        await response.body?.cancel();
        return json({error:"Unsupported photo format."},415,origin);
      }
      if (Number(response.headers.get("content-length")||"0")>MAX_BYTES) {
        await response.body?.cancel();
        return json({error:"Photo exceeds 20 MB."},413,origin);
      }
      if (!response.body) throw Error("No image returned");
      const reader=response.body.getReader();
      let length=0;const chunks:Uint8Array[]=[];
      while(true){
        const {value,done}=await reader.read();if(done)break;
        length+=value.length;
        if(length>MAX_BYTES){await reader.cancel();return json({error:"Photo exceeds 20 MB."},413,origin)}
        chunks.push(value);
      }
      const bytes=new Uint8Array(length);let pos=0;
      for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
      return new Response(bytes,{status:200,headers:{...cors(origin),
        "Content-Type":type,"Cache-Control":"private, max-age=300","Content-Length":String(length)}});
    }
    return json({error:"Choose mode=photos or mode=image."},400,origin);
  }catch{
    return json({error:"The First Megasaver catalog is unavailable. Try again or upload the photo."},502,origin);
  }
});