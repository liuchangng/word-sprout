import { useEffect } from "react";
import { useRoute } from "./lib/router";
import { useSave, useSaveError } from "./store/store";
import { Nav } from "./ui/Nav";
import { Garden } from "./pages/Garden";
import { Learn } from "./pages/Learn";
import { Me } from "./pages/Me";
import { Onboarding } from "./pages/Onboarding";
import { Today } from "./pages/Today";
import { Word } from "./pages/Word";

export function App() {
  const route = useRoute();
  const fullScreen = route.page === "learn" || route.page === "onboarding";
  const motionOff = useSave((s) => s.settings.motion === "off");
  const saveError = useSaveError();

  // 只以 motionOff 为键，开关变化时重写 <html> 上的动效标记
  useEffect(() => {
    document.documentElement.dataset.motion = motionOff ? "off" : "system";
  }, [motionOff]);

  return (
    <div className={fullScreen ? "app app-full" : "app"}>
      {saveError && (
        <div className="save-warning" role="alert">
          进度无法保存，可能是浏览器隐私模式或存储已满。
        </div>
      )}
      {route.page === "today" && <Today />}
      {route.page === "garden" && <Garden book={route.book} />}
      {route.page === "learn" && <Learn />}
      {route.page === "word" && <Word id={route.id} />}
      {route.page === "me" && <Me />}
      {route.page === "onboarding" && <Onboarding />}
      {!fullScreen && <Nav page={route.page} />}
    </div>
  );
}
