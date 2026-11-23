const STOCK_URL = 'https://n8n-m4fm.srv2059868.hstgr.cloud/webhook/lcare-live-stock';

exports.handler = async function (event) {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
  if (event.httpMethod !== 'GET') return {statusCode:405,headers,body:JSON.stringify({success:false})};
  try {
    const res = await fetch(STOCK_URL, {signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
    if (!res.ok) throw new Error('Stock service unavailable');
    const data = await res.json();
    const products = ['libre3-plus','sibionics-gs1-eu'].map(sku => {
      const p = data.products?.find(x => x.sku === sku);
      if (!p || !Number.isSafeInteger(p.available) || p.available < 0) throw new Error('Invalid stock response');
      return {id:sku === 'libre3-plus'?'libre3':'dexcom7',available:p.available};
    });
    if (data.success !== true) throw new Error('Stock not confirmed');
    return {statusCode:200,headers,body:JSON.stringify({success:true,updated_at:data.updated_at,products})};
  } catch (_) {
    return {statusCode:503,headers,body:JSON.stringify({success:false,message:'تعذر تحديث المخزون حالياً'})};
  }
};
