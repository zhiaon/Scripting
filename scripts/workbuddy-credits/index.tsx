import { Navigation, Script } from "scripting"
import { MainView } from "./app"
import { listSessions } from "./auth"
import { safeMessage } from "./balance"

async function run() {
  try {
    listSessions()
    await Navigation.present({ element: <MainView /> })
  } catch (error) {
    await Dialog.alert({ title: "WorkBuddy 积分", message: safeMessage(error), buttonLabel: "关闭" })
  } finally { Script.exit() }
}
void run()
