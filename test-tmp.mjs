import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim()]));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
const arg=process.argv[2];
const gws=(await sb.from("gameweeks").select("id,number")).data;
const gw7=gws.find(g=>g.number===7).id;
// Ein Spieler ohne Kadernennung und ohne Buchung in Runde 7.
const{data:besetzt}=await sb.from("squad_players").select("player_id");
const drin=new Set(besetzt.map(b=>b.player_id));
const{data:gebucht}=await sb.from("price_changes").select("player_id").eq("gameweek_id",gw7);
const hat=new Set(gebucht.map(g=>g.player_id));
const{data:alle}=await sb.from("players").select("id,last_name,price").eq("is_active",true);
const kand=alle.find(p=>!drin.has(p.id)&&!hat.has(p.id)&&Number(p.price)>5);
if(arg==="setup"){
  fs.writeFileSync("/tmp/testspieler.json",JSON.stringify(kand));
  await sb.from("price_changes").insert({player_id:kand.id,gameweek_id:gw7,delta:-0.3});
  await sb.from("players").update({price:Math.round((Number(kand.price)-0.3)*10)/10}).eq("id",kand.id);
  console.log(`Testbuchung: ${kand.last_name} ${kand.price} → ${(Number(kand.price)-0.3).toFixed(1)} (−0.3, ohne Regelgrundlage)`);
}else{
  const t=JSON.parse(fs.readFileSync("/tmp/testspieler.json","utf8"));
  const{data:jetzt}=await sb.from("players").select("price").eq("id",t.id).single();
  const{data:zeile}=await sb.from("price_changes").select("delta").eq("player_id",t.id).eq("gameweek_id",gw7).maybeSingle();
  console.log(`${t.last_name}: Preis ${jetzt.price} (Ausgang ${t.price})  |  Buchung: ${zeile?zeile.delta:"entfernt"}`);
  console.log(Number(jetzt.price)===Number(t.price)&&!zeile?"BESTANDEN — zurückgenommen und Preis wiederhergestellt":"FEHLGESCHLAGEN");
}
