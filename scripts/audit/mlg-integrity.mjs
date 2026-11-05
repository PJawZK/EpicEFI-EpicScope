// Offline, read-only full-record audit. Never used by viewport navigation.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const [file,output,...channelNames]=process.argv.slice(2);
if(!file||!output)throw Error('Usage: node scripts/audit/mlg-integrity.mjs <recording.mlg> <output-directory> [exact channel source names…]');
const handle=await fs.open(file,'r'),stat=await handle.stat();let server,reads=0,bytesRead=0;
const source={size:stat.size,async read(offset,length){const bytes=new Uint8Array(length);let filled=0;while(filled<length){const result=await handle.read(bytes,filled,length-filled,offset+filled);if(!result.bytesRead)throw Error(`Unexpected short read at ${offset+filled}`);filled+=result.bytesRead;}reads++;bytesRead+=length;return bytes;}};
try{
 server=await createServer({root:root+'/apps/web',configFile:root+'/vite.config.ts',server:{middlewareMode:true},appType:'custom'});
 const {parseMlg}=await server.ssrLoadModule(root+'/core/parsers/mlg/mlg-parser.ts');
 const {auditMlgIntegrity}=await server.ssrLoadModule(root+'/core/parsers/mlg/mlg-integrity-audit.ts');
 const started=performance.now();console.log('Scanning complete source with canonical CRC/retry validation');
 const parsed=await parseMlg(source,{id:'offline-audit:'+path.basename(file),displayName:path.basename(file),format:'MLG',sizeBytes:stat.size},{incompleteTail:'retain-complete-records'});
 const parseMs=performance.now()-started,parseIo={reads,bytesRead};
 const rawTimestamps=new Uint16Array(parsed.recordIndex.offsets.length);let pageStart=-1,page;
 for(let i=0;i<rawTimestamps.length;i++){
  const offset=parsed.recordIndex.offsets[i];const start=Math.floor(offset/65536)*65536;
  if(start!==pageStart){pageStart=start;page=await source.read(start,Math.min(65536,source.size-start));}
  const at=offset-pageStart;const header=at+4<=page.length?page.subarray(at,at+4):await source.read(offset,4);
  rawTimestamps[i]=header[2]*256+header[3];
 }
 const names=channelNames.length?channelNames:['RPM','MAP'];const selected=parsed.summary.channels.filter(c=>names.includes(c.sourceName));
 const channels=new Map();for(const channel of selected){console.log('Inspecting complete channel',channel.sourceName);channels.set(`${channel.sourceName} [${channel.id}]`,await parsed.channelData.readChannelRange(channel.id,0,rawTimestamps.length));}
 const auditStarted=performance.now(),ledger=auditMlgIntegrity(parsed.recordIndex,parsed.summary.diagnostics,parsed.header.recordLength,{rawTimestamps,channels}),auditMs=performance.now()-auditStarted;
 const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
 await fs.mkdir(output,{recursive:true});
 const events=ledger.events.map(event=>{let crcValidRecords=0,crcInvalidRecords=0;const selectedChannelValidRecords=Object.fromEntries([...channels.keys()].map(name=>[name,0]));for(let i=event.startRecordIndex;i<=event.endRecordIndex;i++){if(parsed.recordIndex.crcValid[i]===1){crcValidRecords++;for(const [name,range]of channels){const local=i-range.startSampleIndex;if(range.validity[local]===1&&Number.isFinite(range.values[local])&&range.timeMs[local]===parsed.recordIndex.timeMs[i])selectedChannelValidRecords[name]++;}}else crcInvalidRecords++;}return{...event,crcValidRecords,crcInvalidRecords,selectedChannelValidRecords};});
 const report={source:{name:path.basename(file),sizeBytes:stat.size,sha256:hash.digest('hex')},scope:'Complete source CRC/index/raw timestamps; channel inspection limited to the explicitly listed channels. Not a substitute for another recording.',channelsInspected:selected.map(c=>c.sourceName),inspectedChannelIds:selected.map(c=>c.id),requestedChannelsNotFound:names.filter(n=>!selected.some(c=>c.sourceName===n)),parseMs,auditMs,canonicalParseIo:parseIo,totalSourceIo:{reads,bytesRead},hashExtraReadBytes:stat.size,performance:parsed.performance,...ledger,events};
 await fs.writeFile(path.join(output,'ledger.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(output,'diagnostics.json'),JSON.stringify(parsed.summary.diagnostics,null,2));
 console.log(JSON.stringify({records:ledger.recordCount,invalidRecords:ledger.invalidRecords,events:ledger.events.length,observedCounts:ledger.observedCounts,parseMs,auditMs,output}));
}finally{await server?.close();await handle.close();}
