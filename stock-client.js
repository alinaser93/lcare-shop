(function () {
  'use strict';
  var tracked = ['libre3','dexcom7'];
  var counts = {}, refreshedAt = 0, pending = null;
  var original = {renderProds:renderProds,openModal:openModal,addCart:addCart,qtyCart:qtyCart,mQ:mQ,addPlan:addPlan,buyDirect:buyDirect,openCheckout:openCheckout,submitOrder:submitOrder,renderPlans:renderPlans,pickCond:pickCond};
  var style = document.createElement('style');
  style.textContent = '.lc-stock{display:flex;align-items:center;gap:8px;padding:11px 13px;margin:13px 0;border-radius:12px;background:#eaf5ef;color:#176344;font-size:14px;font-weight:700;line-height:1.6}.lc-stock::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;flex-shrink:0}.lc-stock.low{background:#fff2e4;color:#95520b}.lc-stock.empty,.lc-stock.wait{background:#f0efed;color:#68645e}.lc-stock small{display:block;font-size:11px;font-weight:400}.pcard-add:disabled,.modal-add:disabled,.modal-wa:disabled,.ms-add:disabled,.plan-cta:disabled{opacity:.45;cursor:not-allowed}.lc-stock-note{font-size:12px;color:var(--ink-m);line-height:1.7;margin:8px 0}';
  document.head.appendChild(style);
  function isTracked(id) { return tracked.indexOf(id) !== -1; }
  function fresh() { return refreshedAt > 0 && Date.now()-refreshedAt < 60000; }
  function available(id) { return fresh() && Number.isInteger(counts[id]) ? counts[id] : null; }
  function arabic(n) { return Number(n).toLocaleString('ar-IQ'); }
  function apply() {
    PRODUCTS.forEach(function(p){
      if (!isTracked(p.id)) return;
      p.fomo = '';
      if (p.id === 'libre3') p.old = null;
      var n = available(p.id);
      if (n !== null) { p.soon = n === 0; p.outOfStock = n === 0; }
    });
  }
  function badge(id) {
    var n=available(id), b=document.createElement('div');
    b.className='lc-stock'+(n===null?' wait':n===0?' empty':n<=3?' low':'');
    b.dataset.lcStock=id;
    b.setAttribute('role','status');
    var t=document.createElement('div');
    t.textContent=n===null?'جارٍ التحقق من المخزون':n===0?'نفدت الدفعة الحالية':'متبقي '+arabic(n)+' '+(n===1?'قطعة':'قطع')+' من الدفعة الحالية';
    if(n>0){var small=document.createElement('small');small.textContent=id==='libre3'?'متوفر مجدداً — بنفس السعر ٨٥٬٠٠٠ د.ع':'اختَر الكمية المناسبة لك';t.appendChild(small);}
    b.appendChild(t);return b;
  }
  function setBadge(container,id,before) {
    if(!container)return;
    container.querySelectorAll('[data-lc-stock]').forEach(function(x){x.remove();});
    container.insertBefore(badge(id),before||null);
  }
  function decorate() {
    document.querySelectorAll('.pcard[onclick]').forEach(function(card){
      var match=(card.getAttribute('onclick')||'').match(/openModal\('([^']+)'\)/), id=match&&match[1];
      if(!isTracked(id))return;
      var body=card.querySelector('.pcard-body');setBadge(body,id,body&&body.querySelector('.pcard-foot'));
      var add=card.querySelector('.pcard-add');if(add){add.disabled=available(id)===null;add.setAttribute('aria-label',available(id)===null?'جارٍ التحقق من التوفر':available(id)===0?'أبلغني عند التوفر':'أضف للسلة');}
    });
    var cmp=document.querySelector('[data-stock-compare="libre3"]');
    if(cmp){var cb=cmp.querySelector('.cmp-badge');if(cb)cb.textContent=available('libre3')===null?'جارٍ التحقق':available('libre3')===0?'غير متوفر':'متبقي '+arabic(available('libre3'));}
    if(mProd&&isTracked(mProd.id)&&document.getElementById('pModal').classList.contains('on')){
      var body=document.getElementById('mBody'), n=available(mProd.id);setBadge(body,mProd.id,body&&body.querySelector('.modal-price'));
      document.querySelectorAll('#mBody .modal-add,#mBody .modal-wa,#mSticky .ms-add:not(.ms-notify)').forEach(function(b){b.disabled=n===null||n===0;});
      if(!body.querySelector('.lc-stock-note')){var note=document.createElement('p');note.className='lc-stock-note';note.textContent='تُثبَّت الكمية عند تسجيل الطلب على واتساب. إضافة المنتج للسلة لا تحجز المخزون.';body.appendChild(note);}
    }
    document.querySelectorAll('.plan-cta').forEach(function(b){var m=(b.getAttribute('onclick')||'').match(/addPlan\('([^']+)'\)/);if(m&&isTracked(m[1])){var n=available(m[1]);b.disabled=n===null||planMonths*2>n;}});
  }
  function repaint() { apply();original.renderProds();original.renderPlans();decorate();if(typeof reveals==='function')reveals(); }
  function refresh(force) {
    if(pending)return pending;
    if(!force&&fresh())return Promise.resolve(true);
    pending=fetch('/.netlify/functions/stock',{cache:'no-store',signal:AbortSignal.timeout(10000)})
      .then(function(r){if(!r.ok)throw new Error('stock');return r.json();})
      .then(function(data){if(!data.success||!Array.isArray(data.products))throw new Error('stock');var next={};tracked.forEach(function(id){var p=data.products.find(function(x){return x.id===id;});if(!p||!Number.isInteger(p.available)||p.available<0)throw new Error('stock');next[id]=p.available;});counts=next;refreshedAt=Date.now();repaint();return true;})
      .catch(function(){if(!fresh()){refreshedAt=0;decorate();}return false;})
      .finally(function(){pending=null;});
    return pending;
  }
  function allow(id,total) {
    if(!isTracked(id))return true;
    var n=available(id);
    if(n===null){toast('لحظة، نتحقق من المخزون المتوفر');refresh(true);return false;}
    if(!Number.isInteger(total)||total<1||total>n){toast(n===0?'هذا المنتج غير متوفر حالياً':'المتبقي '+arabic(n)+' قطع من هذه الدفعة');return false;}
    return true;
  }
  renderProds=function(){apply();original.renderProds();decorate();};
  renderPlans=function(){apply();original.renderPlans();decorate();};
  openModal=function(id){apply();original.openModal(id);decorate();};
  pickCond=function(id){original.pickCond(id);decorate();};
  addCart=function(id,qty,src,noFly,pOv){qty=qty||1;if(!allow(id,itemQty(id)+qty))return false;return original.addCart(id,qty,src,noFly,pOv);};
  qtyCart=function(id,d){if(d>0&&!allow(id,itemQty(id)+d))return;return original.qtyCart(id,d);};
  mQ=function(d){if(d>0&&mProd&&!allow(mProd.id,itemQty(mProd.id)+mQty+d))return;return original.mQ(d);};
  addPlan=function(id){if(!allow(id,Math.max(itemQty(id),planMonths*2)))return;return original.addPlan(id);};
  buyDirect=function(id){if(!allow(id,1))return;return original.buyDirect(id);};
  function validCart(){return cart.every(function(i){return allow(i.id,i.qty);});}
  openCheckout=async function(){if(!(await refresh(true))){toast('تعذر تحديث المخزون، حاول بعد لحظات');return;}if(!validCart())return;return original.openCheckout();};
  submitOrder=async function(){if(!(await refresh(true))){toast('تعذر تحديث المخزون، لم يتم إرسال الطلب');return;}if(!validCart())return;return original.submitOrder();};
  document.addEventListener('DOMContentLoaded',function(){decorate();refresh(true);setInterval(function(){if(!document.hidden)refresh(true);},20000);});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh(true);});
}());
