/* Smart product photo identity rules. Staging-only: built into protected MegaFlyer. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.FLYER_PRODUCT_PHOTO_MATCH=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalize=value=>String(value??'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' ');
  const barcode=value=>normalize(value).replace(/[^A-Z0-9]/g,'').slice(0,100);
  const word=value=>normalize(value).replace(/[^A-Z0-9]+/g,' ').trim().slice(0,100);
  const description=value=>String(value??'').trim().replace(/\s+/g,' ').slice(0,180);
  function product(value={}){
    const barcodeValue=barcode(value.barcode||value.sku||value.BARCODE);
    const brand=word(value.brand||value.BRAND);
    const model=word(value.model||value.MODEL);
    const label=description(value.description||value.name||value.title||value.DESCRIPTION);
    const productKey=barcodeValue?'b:'+barcodeValue:brand&&model?'m:'+brand+'|'+model:'';
    return {barcode:barcodeValue,brand,model,description:label,productKey};
  }
  function matchingPriority(current,photos){
    const p=product(current);
    if(p.barcode){
      const rows=photos.filter(x=>barcode(x.barcode_norm||x.barcode)===p.barcode);
      if(rows.length)return {match:'barcode',photos:rows,requiresConfirmation:false};
    }
    if(p.brand&&p.model){
      const rows=photos.filter(x=>word(x.brand_norm||x.brand)===p.brand&&word(x.model_norm||x.model)===p.model);
      if(rows.length)return {match:'model',photos:rows,requiresConfirmation:false};
    }
    const tokens=word(p.description).split(' ').filter(x=>x.length>=3);
    const suggestions=tokens.length>=2?photos.filter(x=>{
      const target=word(x.description);
      return tokens.filter(t=>target.includes(t)).length>=2;
    }):[];
    return {match:suggestions.length?'description':'none',photos:suggestions,requiresConfirmation:true};
  }
  return Object.freeze({normalize,barcode,word,description,product,matchingPriority});
});
