import { Navigation, NavigationStack, Script, Widget, useEffect, useState } from 'scripting'
import { load, setKey, Result } from './quota'
import { record } from './history'
import { bjShort } from './format'
import { HomePage } from './home'
import type { Flash } from './home'

let working=false
function Page(){
  const [result,set]=useState<Result>({data:null,label:'正在读取'})
  const [busy,busySet]=useState(false)
  const [now,nowSet]=useState(Date.now())
  const [settings,settingsSet]=useState(false)
  const [flash,flashSet]=useState<Flash>(null)
  const dismiss=Navigation.useDismiss()
  function apply(r:Result){ if(r.data){try{record(r.data)}catch(_){ /* 历史记录失败不影响展示 */ }} set(r); nowSet(Date.now()) }
  function hint(f:Flash,ms=2600){ flashSet(f); if(f) setTimeout(()=>flashSet(null),ms) }
  async function act(fn:()=>Promise<void>){
    if(working)return
    working=true;busySet(true)
    try {await fn()} catch {set({data:null,label:'操作未完成,请重试'}); hint({kind:'error',text:'操作未完成,请检查网络后重试'})} finally{working=false;busySet(false)}
  }
  useEffect(()=>{void act(async()=>apply(await load()))},[])
  function refresh(){
    return act(async()=>{
      const r=await load(true)
      apply(r)
      if(r.data) hint({kind:'ok',text:`已刷新 · ${bjShort(new Date().toISOString())} 北京时间`})
      else hint({kind:'error',text:r.label})
      Widget.reloadAll()
    })
  }
  return <NavigationStack><HomePage result={result} busy={busy} now={now} settings={settings} flash={flash}
    onSettings={settingsSet}
    onRefresh={()=>void refresh()}
    onSetKey={()=>void act(async()=>{
      const key=await Dialog.prompt({title:'CPA 客户端 Key',message:'使用访问 cpa.zhiaon.top 的客户端 Key。',obscureText:true,placeholder:'客户端 Key',confirmLabel:'验证并保存',cancelLabel:'取消'})
      if(key==null)return
      const r=await setKey(key);apply(r)
      if(r.data){hint({kind:'ok',text:'Key 已验证并保存到本机钥匙串'});Widget.reloadAll()}
      else hint({kind:'error',text:r.label})
    })}
    onPreview={()=>void act(async()=>{await Widget.preview({family:'systemMedium'})})}
    onClose={dismiss}/></NavigationStack>
}
async function run(){try{await Navigation.present({element:<Page/>})}finally{Script.exit()}}
void run()
