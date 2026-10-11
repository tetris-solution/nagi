import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import worker from '../worker/index.js';
const request=(path,opts={})=>worker.fetch(new Request('https://nagi.test'+path,opts),{});
let r=await request('/');assert.equal(r.status,200);assert.match(await r.text(),/今日に、ありがとう/);
for(const p of ['/app.js','/timing.js']){r=await request(p);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>1000)}
r=await request('/api/status');assert.deepEqual(await r.json(),{elevenlabs:false,google:false});
r=await request('/api/voices');assert.deepEqual(await r.json(),{voices:[]});
const post=(body,headers={})=>request('/api/speech',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
assert.equal((await post({text:'ありがとう',provider:'google',voice:'ja-JP-Neural2-B'})).status,503);
assert.equal((await post({text:'ありがとう',provider:'elevenlabs',voice:'abc123def456'})).status,503);
assert.equal((await post({text:'',provider:'google',voice:'ja-JP-Neural2-B'})).status,400);
assert.equal((await post({text:'あ'.repeat(1600),provider:'google',voice:'ja-JP-Neural2-B'})).status,400);
assert.equal((await post({text:'ありがとう',provider:'google',voice:'ja-JP-Neural2-B'},{Origin:'https://other.test'})).status,403);
assert.equal((await request('/api/speech')).status,405);
const originalFetch=globalThis.fetch;let sent;globalThis.fetch=async(url)=>new Response(new Uint8Array(2000),{headers:{'Content-Type':'image/jpeg'}});for(const p of ['/assets/lake.jpg','/assets/forest.jpg','/assets/night.jpg','/assets/sunrise.jpg']){const image=await request(p);assert.equal(image.status,200);assert.equal((await image.arrayBuffer()).byteLength,2000)};
globalThis.fetch=async(url,options)=>{sent={url,options};return new Response(JSON.stringify({audioContent:btoa('audio')}),{headers:{'Content-Type':'application/json'}})};
r=await worker.fetch(new Request('https://nagi.test/api/speech',{method:'POST',body:JSON.stringify({text:'ありがとう',provider:'google',voice:'ja-JP-Neural2-B'})}),{GOOGLE_TTS_API_KEY:'test-only'});assert.equal(r.status,200);assert.equal(await r.text(),'audio');assert.equal(sent.url,'https://texttospeech.googleapis.com/v1/text:synthesize');assert.equal(JSON.parse(sent.options.body).voice.name,'ja-JP-Neural2-B');assert.equal(sent.options.headers['x-goog-api-key'],'test-only');
globalThis.fetch=async(url,options)=>{sent={url,options};return new Response('audio',{headers:{'Content-Type':'audio/mpeg'}})};
r=await worker.fetch(new Request('https://nagi.test/api/speech',{method:'POST',body:JSON.stringify({text:'ありがとう',provider:'elevenlabs',voice:'abc123def456'})}),{ELEVENLABS_API_KEY:'test-only'});assert.equal(r.status,200);assert.equal(sent.options.headers['xi-api-key'],'test-only');assert.equal(JSON.parse(sent.options.body).model_id,'eleven_v3');assert.equal(JSON.parse(sent.options.body).voice_settings.speed,1);
assert.equal(JSON.parse(sent.options.body).language_code,'ja');assert.equal(JSON.parse(sent.options.body).voice_settings.stability,.5);
r=await worker.fetch(new Request('https://nagi.test/api/speech',{method:'POST',body:JSON.stringify({text:'ありがとう',provider:'elevenlabs',voice:'abc123def456',model:'eleven_multilingual_v2',speed:.95})}),{ELEVENLABS_API_KEY:'test-only'});assert.equal(r.status,200);assert.equal(JSON.parse(sent.options.body).model_id,'eleven_multilingual_v2');assert.equal(JSON.parse(sent.options.body).language_code,undefined);assert.equal(JSON.parse(sent.options.body).voice_settings.speed,.95);
for(const extras of [{model:'unsupported'},{speed:0},{speed:'1'}]){r=await worker.fetch(new Request('https://nagi.test/api/speech',{method:'POST',body:JSON.stringify({text:'ありがとう',provider:'elevenlabs',voice:'abc123def456',...extras})}),{ELEVENLABS_API_KEY:'test-only'});assert.equal(r.status,400)}
globalThis.fetch=async()=>new Response(JSON.stringify({voices:[{voice_id:'PmgfHCGeS5b7sH90BOOJ',name:'Fumi - Calm Japanese Woman'},{voice_id:'english-test-voice',name:'English Narrator',labels:{language:'en'}},{voice_id:'new-japanese-voice',name:'Japanese Voice',labels:{language:'ja'}}]}));
r=await worker.fetch(new Request('https://nagi.test/api/voices'),{ELEVENLABS_API_KEY:'test-only'});const japanese=await r.json();assert.equal(japanese.voices.length,2);assert.equal(japanese.voices[0].name,'ふみ');assert.ok(!japanese.voices.some(v=>v.voice_id==='english-test-voice'));assert.ok(japanese.voices.every(v=>/[ぁ-んァ-ヶ一-龯]/.test(v.name)));
globalThis.fetch=async()=>new Response(JSON.stringify({detail:{status:'payment_required'}}),{status:402});r=await worker.fetch(new Request('https://nagi.test/api/speech',{method:'POST',body:JSON.stringify({text:'ひと呼吸',provider:'elevenlabs',voice:'PmgfHCGeS5b7sH90BOOJ'})}),{ELEVENLABS_API_KEY:'test-only'});const paid=await r.json();assert.equal(paid.provider_code,'payment_required');assert.match(paid.error,/サラ/);globalThis.fetch=originalFetch;
assert.equal((await request('/missing')).status,404);
console.log('Passed: page/assets, provider readiness, input/origin/method validation, mocked Google & ElevenLabs speech contracts.');

const timing=vm.createContext({});vm.runInContext(await readFile(new URL('../timing.js',import.meta.url),'utf8'),timing);
for(const [text,expected] of [['普通のガイドです。',1.5],['深呼吸を3回しましょう。',30],['深呼吸を３回しましょう。',30],['三回、深呼吸をしましょう。',30],['深呼吸をさん回しましょう。',30],['30秒間、静かに待ちます。',30],['2分間、呼吸を続けましょう。',120]]){assert.equal(vm.runInContext(`practicePause(${JSON.stringify(text)})`,timing),expected)}
assert.equal(vm.runInContext(`practicePause('深呼吸を3回しましょう。',2)`,timing),30);const planned=vm.runInContext(`planSession({id:'test',minutes:15,cues:[[0,'短い言葉。'],[90,'深呼吸を3回しましょう。'],[180,'終わります。']]})`,timing);assert.ok(planned.cues[1][0]<10);assert.equal(planned.holds[1],30);assert.ok(planned.duration<90);console.log('Passed: compact timing, explicit breath counts, timed instructions and duration estimates.');

const split=vm.runInContext(`planSession({id:'test',cues:[[0,'楽に座ります。深呼吸を3回しましょう。次に肩をゆるめます。']]})`,timing);assert.equal(split.cues.length,2);assert.equal(split.holds[0],30);assert.match(split.cues[0][1],/深呼吸/);assert.match(split.cues[1][1],/^次に/);
