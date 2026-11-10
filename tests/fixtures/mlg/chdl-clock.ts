import {idleContractMlg} from '../idle/mlg-contract';
/** Independent bytes reproducing the real CHDL header transition 38102→5876
 * and its coarse startup cadence followed by faster logging. No private payload. */
export function chdlClockFixture() {
  const records=Array.from({length:23},(_,i)=>({counter:i,timestamp:(7709+i*30000)%65536,rpm:0}));
  records.push({counter:75,timestamp:38102,rpm:0},{counter:97,timestamp:5876,rpm:0},{counter:119,timestamp:47055,rpm:0},{counter:141,timestamp:9522,rpm:0},{counter:163,timestamp:33955,rpm:0});
  for(let i=1;i<=130;i++)records.push({counter:(163+i)%256,timestamp:(33955+i*1380)%65536,rpm:0});
  return idleContractMlg(records);
}
