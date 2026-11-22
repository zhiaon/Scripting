import { Widget, Script, VStack } from 'scripting'
import { load, Result } from './quota'
import { record } from './history'
import { C } from './theme'
import { View } from './view'

async function run(){
  const r:Result=await load().catch(()=>({data:null,label:'暂时无法读取'}))
  if(r.data){ try{ record(r.data) }catch(_){ /* 记录失败不影响展示 */ } }
  const reset=r.data?Date.parse(r.data.reset_at):NaN
  const fallback=Date.now()+15*60_000
  const next=Number.isFinite(reset)&&reset>Date.now()?Math.min(fallback,reset):fallback
  Widget.present(<VStack widgetBackground={C.bg} widgetURL={Script.createRunSingleURLScheme('TokenHarbor 七天额度')} frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'leading'}}>
    <View result={r} family={String(Widget.family)} size={Widget.displaySize}/>
  </VStack>,{policy:'after',date:new Date(next)})
}
void run()
