import {spawn} from 'node:child_process';

// Opt-in synthetic acceptance only; provider credentials remain on the HK host.
export function liveBuilderProbe(phase: string, payload: unknown): Promise<any> {
  return new Promise((resolve,reject)=>{
    const child=spawn('ssh',['-F','C:/Users/Leo/.ssh/meta-exb-hongkong.conf','meta-exb-hongkong','sh /home/admin/builder-recovery-probe-20260915/recovery-live-provider.sh'],{windowsHide:true});
    let output='',errors='';const timer=setTimeout(()=>{child.kill();reject(new Error('Live builder probe timed out'));},240000);
    child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error(`Provider probe failed (${code}): ${errors.slice(-500)}`));try{resolve(JSON.parse(output));}catch(error){reject(error);}});
    child.stdin.end(JSON.stringify({phase,payload}));
  });
}
