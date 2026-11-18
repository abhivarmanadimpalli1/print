import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePageRange,splitPagesByFile,formatPageRanges} from '../src/lib/pageRangeParser.ts';
test('rejects malformed selections rather than charging for a truncated value',()=>{for(const input of ['1abc','1-2-3','1,,2','-1','3-2','0','1.5','1-9'])assert.equal(parsePageRange(input,8).valid,false,input);});
test('maps combined customer ranges to each original PDF',()=>{const selection=parsePageRange('2-4, 6, 8',8);assert.equal(selection.count,5);const files=splitPagesByFile([3,3,2],selection.pages);assert.deepEqual(files,[[2,3],[1,3],[2]]);assert.deepEqual(files.map(formatPageRanges),['2-3','1, 3','2']);});
test('two one-page originals need two duplex sheets per copy',()=>{const files=splitPagesByFile([1,1],parsePageRange('',2).pages);assert.equal(files.reduce((sum,pages)=>sum+Math.ceil(pages.length/2),0),2);});
test('deduplicates overlapping ranges and identifies files with no selected pages',()=>{const selection=parsePageRange('1-2, 2',8);assert.equal(selection.count,2);assert.deepEqual(splitPagesByFile([3,5],selection.pages),[[1,2],[]]);});

test('shop settings reject invalid prices instead of showing free or negative charges',async()=>{const {validateShop}=await import('../src/lib/shopValidation.ts');const shop={name:'Test Shop',pricing:{bwPerPage:2,colorPerPage:10,duplexRateRatio:.9,paperSizes:[{id:'A4',multiplier:1}]},retentionMinutes:10,monthlySubscriptionFee:0};assert.doesNotThrow(()=>validateShop(shop));for(const value of [-1,0,NaN,Infinity])assert.throws(()=>validateShop({...shop,pricing:{...shop.pricing,bwPerPage:value}}));assert.throws(()=>validateShop({...shop,monthlySubscriptionFee:-1}));});
