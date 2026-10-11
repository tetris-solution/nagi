const rates=new Map();
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function api(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/api/status'&&request.method==='GET')return json({elevenlabs:!!env.ELEVENLABS_API_KEY,google:!!env.GOOGLE_TTS_API_KEY});
 if(path==='/api/voices'&&request.method==='GET'){
  if(!env.ELEVENLABS_API_KEY)return json({voices:[]});
  try{const r=await fetch('https://api.elevenlabs.io/v1/voices',{headers:{'xi-api-key':env.ELEVENLABS_API_KEY},signal:AbortSignal.timeout(15000)});if(!r.ok)return json({error:'音声一覧を取得できませんでした。'},502);const d=await r.json();return json({voices:(d.voices||[]).map(v=>({voice_id:v.voice_id,name:v.name})).slice(0,60)})}catch{return json({error:'音声サービスに接続できませんでした。'},502)}
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
    const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice),{method:'POST',headers:{'xi-api-key':env.ELEVENLABS_API_KEY,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.75,similarity_boost:.75,speed:.8}}),signal:AbortSignal.timeout(40000)});
    if(!r.ok)return json({error:'ElevenLabsで音声を生成できませんでした。'},502);return new Response(r.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});
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
