import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Exercise the real application transaction callbacks against an isolated in-memory driver.
async function database() {
  const records = new Map(); let serial = Promise.resolve(); let fail = false;
  const snapshot = key => ({ id: key.split('/').at(-1), exists: () => records.has(key), data: () => structuredClone(records.get(key)) });
  const sdk = {
    getFirestore: () => ({}), doc: (_, group, id) => `${group}/${id}`, deleteField: () => null,
    runTransaction: async (_, callback) => {
      const previous = serial; let release; serial = new Promise(resolve => { release = resolve; }); await previous;
      const pending = [];
      try { const result = await callback({get: async key => snapshot(key),set: (key,value) => pending.push([key,value]),update: (key,value) => pending.push([key,{...records.get(key),...value}])});
        if (fail) throw Error('Database unavailable'); for (const [key,value] of pending) records.set(key,structuredClone(value)); return result;
      } finally { release(); }
    },
  };
  let code = stripTypeScriptTypes(await readFile(new URL('../src/lib/firebase.ts',import.meta.url),'utf8'),{mode:'transform'});
  const imports=[...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)];
  const context=vm.createContext({console,setTimeout,clearTimeout,Promise});
  const dependencies=new Map();
  for(const [,names,specifier] of imports){const symbols=names.split(',').map(s=>s.trim()).filter(Boolean);const values=Object.fromEntries(symbols.map(name=>[name,sdk[name]|| (name==='getApps'?()=>[]:()=>({}))]));dependencies.set(specifier,new vm.SyntheticModule(symbols,function(){for(const name of symbols)this.setExport(name,values[name]);},{context}));}
  const module=new vm.SourceTextModule(code,{context,initializeImportMeta(meta){meta.env={};}});await module.link(specifier=>dependencies.get(specifier));await module.evaluate();
  return {api:module.namespace,records,setFailure:value=>{fail=value;}};
}
const draft=id=>({id,shopId:'test-shop',orderNumber:0,status:'new',config:{subtotal:10},paymentStatus:'pending',createdAt:new Date().toISOString()});
test('concurrent orders get unique durable queue numbers without production writes',async()=>{const db=await database();const orders=await Promise.all(Array.from({length:20},(_,i)=>db.api.createOrderInFirestore(draft(`order-${i}`))));assert.equal(new Set(orders.map(o=>o.orderNumber)).size,20);assert.equal(db.records.get('orders/quickprint-order-sequence').lastOrderNumber,1000020);for(const order of orders)assert.equal(db.records.get(`orders/${order.id}`).orderNumber,order.orderNumber);});
test('failed database commits never leave an order or a reserved queue number',async()=>{const db=await database();db.setFailure(true);await assert.rejects(db.api.createOrderInFirestore(draft('failure')));assert.equal(db.records.size,0);});
test('quote and payment changes preserve one another using current server data',async()=>{const db=await database();await db.api.createOrderInFirestore(draft('order'));await Promise.all([db.api.updateOrderInFirestore('order',current=>({config:{...current.config,revisedAmount:12.5},status:'review'})),db.api.updateOrderPaymentInFirestore('order',()=>({paymentStatus:'pending',upiPayment:{utr:'123456789012'}}))]);const stored=db.records.get('orders/order');assert.equal(stored.config.revisedAmount,12.5);assert.equal(stored.status,'review');assert.equal(stored.upiPayment.utr,'123456789012');});
test('a rejected order mutation does not overwrite server data',async()=>{const db=await database();await db.api.createOrderInFirestore(draft('order'));const before=structuredClone(db.records.get('orders/order'));await assert.rejects(db.api.updateOrderInFirestore('order',()=>{throw Error('Not allowed');}));assert.deepEqual(db.records.get('orders/order'),before);});
async function storeDriver() {
 const db=await database(),cache=new Map();let allowed=true;
 const context=vm.createContext({console,Promise,setTimeout,clearTimeout,Date,localStorage:{getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value),removeItem:key=>cache.delete(key)}});
 const code=stripTypeScriptTypes(await readFile(new URL('../src/lib/store.ts',import.meta.url),'utf8'),{mode:'transform'});
 const imports=[...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g)];const modules=new Map();
 for(const [,names,path] of imports){const symbols=names.split(',').map(x=>x.trim()).filter(Boolean);let values;
  if(path==='./firebase')values=Object.fromEntries(symbols.map(name=>[name,db.api[name]]));
  else if(path==='./supabase')values=Object.fromEntries(symbols.map(name=>[name,name==='canAccessCounter'?async()=>allowed:name==='hasVerifiedCounter'?()=>false:async()=>true]));
  else {const imported=await import(new URL('../src/lib/'+path.slice(2)+'.ts',import.meta.url));values=Object.fromEntries(symbols.map(name=>[name,imported[name]]));}
  modules.set(path,new vm.SyntheticModule(symbols,function(){for(const name of symbols)this.setExport(name,values[name]);},{context}));
 }
 const module=new vm.SourceTextModule(code,{context});await module.link(path=>modules.get(path));await module.evaluate();return {...db,store:module.namespace,cache,setAccess:value=>{allowed=value;}};
}
test('a fresh browser has no fabricated sample orders or carried-over city cache',async()=>{const driver=await storeDriver();driver.cache.set('qr_print_orders_v1',JSON.stringify([{id:'ORD-1040'}]));assert.equal(driver.store.getAllOrders().length,0);});
test('failed counter saves leave the cached order unchanged',async()=>{const driver=await storeDriver();const order=await driver.api.createOrderInFirestore({...draft('order'),statusHistory:[]});driver.store.saveOrderToLocal(order);driver.setFailure(true);await assert.rejects(driver.store.updateOrderStatus(order.id,'approved'));assert.equal(driver.store.getOrder(order.id).status,'new');assert.equal(driver.records.get('orders/order').status,'new');});
test('counter access is checked before recording a real payment',async()=>{const driver=await storeDriver();const order=await driver.api.createOrderInFirestore({...draft('cash'),paymentMode:'counter',paymentStatus:'pay_at_counter',statusHistory:[]});driver.store.saveOrderToLocal(order);driver.setAccess(false);await assert.rejects(driver.store.confirmCounterPayment('cash'));assert.equal(driver.records.get('orders/cash').paymentStatus,'pay_at_counter');driver.setAccess(true);const paid=await driver.store.confirmCounterPayment('cash');assert.equal(paid.paymentStatus,'paid');assert.ok(paid.paymentReceivedAt);await assert.rejects(driver.store.confirmCounterPayment('cash'));});
test('quote revisions are persisted together with the clarification and preserve a zero total',async()=>{const driver=await storeDriver();const order=await driver.api.createOrderInFirestore({...draft('quote'),paymentMode:'counter',statusHistory:[]});driver.store.saveOrderToLocal(order);const updated=await driver.store.requestClarification('quote','No charge for reprint',0);assert.equal(updated.config.revisedAmount,0);assert.equal(driver.records.get('orders/quote').clarificationNote,'No charge for reprint');assert.equal(driver.records.get('orders/quote').status,'review');});
