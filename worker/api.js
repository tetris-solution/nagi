const japaneseVoices={
'EXAVITQu4vr4xnSDxMaL':{name:'サラ — やさしい語り',description:'日本語読み上げ対応 · 標準の多言語音声'},
'PmgfHCGeS5b7sH90BOOJ':{name:'ふみ',description:'日本語 · 落ち着いた女性の声 · 有料プランが必要'},
'WQz3clzUdMqvBf0jswZQ':{name:'しずか',description:'日本語 · 自然でやわらかな声'},
'NQZUZmZFxoCYFGj4gD2o':{name:'あいこ',description:'日本語の声'},
'my3P6caXGLzHy2BLxEdS':{name:'くみ',description:'日本語 · やわらかな声'},
'GxhGYQesaQaYKePCZDEC':{name:'さくら',description:'日本語 · 女性の声'},
'RBnMinrYKeccY3vaUxlZ':{name:'鈴木さくら',description:'日本語の声'},
'DOL4zlUH4vnnX1hByxsw':{name:'あきら',description:'日本語 · 男性の声'},
'8kgj5469z1URcH4MB2G4':{name:'さくや',description:'日本語 · かわいらしいアニメ風の声'},
'8EkOjt4xTPGMclNlh1pk':{name:'もりおき',description:'日本語の声'}
};
function localizeJapaneseVoices(list){return list.filter(v=>japaneseVoices[v.voice_id]||['ja','ja-jp','japanese','日本語'].includes(String(v.labels?.language||'').toLowerCase())).sort((a,b)=>{const ids=Object.keys(japaneseVoices);return (ids.indexOf(a.voice_id)<0?99:ids.indexOf(a.voice_id))-(ids.indexOf(b.voice_id)<0?99:ids.indexOf(b.voice_id))}).map((v,i)=>({voice_id:v.voice_id,...(japaneseVoices[v.voice_id]||{name:'日本語の声 '+(i+1),description:'日本語の声'})})).slice(0,60)}
const rates=new Map();
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function elevenLabsError(response){
 let code='unknown';try{const data=await response.json();const candidate=data.detail?.status||data.detail?.code||data.error?.code;if(typeof candidate==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(candidate))code=candidate}catch{}
 let message='音声を生成できませんでした。別の声を選ぶか、少し時間をおいてお試しください。';
 if(['quota_exceeded','insufficient_credits','insufficient_credit_balance'].includes(code))message='ElevenLabsの利用枠が不足しています。クレジット残高を確認してください。';
 else if(['paid_plan_required','subscription_required','voice_not_allowed','only_for_creator_subscription','payment_required'].includes(code)||response.status===402)message='この声はElevenLabsの有料プランが必要です。「サラ — やさしい語り」または端末の声を選んでください。';
 else if(response.status===401)message='ElevenLabsのAPIキーを確認してください。キーが無効か、利用期限が切れています。';
 else if(response.status===403)message='この声を利用できません。APIキーの読み上げ権限、声の利用条件、プランを確認してください。';
 else if(response.status===429)message='ElevenLabsの利用上限に達しています。少し時間をおいてお試しください。';
 else if(response.status===404)message='この声が見つかりません。声の一覧を更新して選び直してください。';
 return json({error:message,provider_code:code,provider_status:response.status},response.status===429?429:502)
}
export async function api(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/api/status'&&request.method==='GET')return json({elevenlabs:!!env.ELEVENLABS_API_KEY,google:!!env.GOOGLE_TTS_API_KEY});
 if(path==='/api/voices'&&request.method==='GET'){
  if(!env.ELEVENLABS_API_KEY)return json({voices:[]});
  try{const r=await fetch('https://api.elevenlabs.io/v1/voices',{headers:{'xi-api-key':env.ELEVENLABS_API_KEY},signal:AbortSignal.timeout(15000)});if(!r.ok)return json({error:'音声一覧を取得できませんでした。'},502);const d=await r.json();return json({voices:localizeJapaneseVoices(d.voices||[])})}catch{return json({error:'音声サービスに接続できませんでした。'},502)}
 }
 if(path==='/api/speech'){
  if(request.method!=='POST')return json({error:'POSTを使用してください。'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'許可されていないリクエストです。'},403);
  const who=request.headers.get('cf-connecting-ip')||'local-preview';const now=Date.now();for(const [key,v]of rates)if(v.until<now)rates.delete(key);const rate=rates.get(who)||{until:now+60000,count:0};if(++rate.count>35)return json({error:'少し時間をおいてお試しください。'},429);rates.set(who,rate);
  if(Number(request.headers.get('content-length')||0)>12000)return json({error:'文章が長すぎます。'},413);
  let body;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>12000)return json({error:'文章が長すぎます。'},413);body=JSON.parse(raw)}catch{return json({error:'正しいJSONを指定してください。'},400)}
  const{text,provider,voice}=body;if(typeof text!=='string'||!text.trim()||new TextEncoder().encode(text).length>4500||typeof voice!=='string')return json({error:'音声の文章と声を確認してください。'},400);
  try{
   if(provider==='elevenlabs'){
    if(!env.ELEVENLABS_API_KEY)return json({error:'ElevenLabsは未接続です。'},503);
    if(!/^[a-zA-Z0-9_-]{8,80}$/.test(voice))return json({error:'声の指定が正しくありません。'},400);
    const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice),{method:'POST',headers:{'xi-api-key':env.ELEVENLABS_API_KEY,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify({text:text.replaceAll('おつかれ','お疲れ'),model_id:'eleven_multilingual_v2',voice_settings:{stability:.75,similarity_boost:.75,speed:.9}}),signal:AbortSignal.timeout(40000)});
    if(!r.ok)return elevenLabsError(r);return new Response(r.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
   }
   if(provider==='google'){
    if(!env.GOOGLE_TTS_API_KEY)return json({error:'Google TTSは未接続です。'},503);
    if(!['ja-JP-Neural2-B','ja-JP-Neural2-C'].includes(voice))return json({error:'声の指定が正しくありません。'},400);
    const r=await fetch('https://texttospeech.googleapis.com/v1/text:synthesize',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GOOGLE_TTS_API_KEY},body:JSON.stringify({input:{text},voice:{languageCode:'ja-JP',name:voice},audioConfig:{audioEncoding:'MP3',speakingRate:.8}}),signal:AbortSignal.timeout(40000)});
    if(!r.ok)return json({error:'Google TTSで音声を生成できませんでした。'},502);const d=await r.json();if(!d.audioContent)return json({error:'音声データがありません。'},502);const binary=atob(d.audioContent),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
   }
   return json({error:'対応していない音声サービスです。'},400);
  }catch{return json({error:'音声サービスへの接続がタイムアウトしました。'},502)}
 }
 return json({error:'見つかりません。'},404);
}
