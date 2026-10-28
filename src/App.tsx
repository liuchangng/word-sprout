import { useRoute } from "./lib/router";
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

  return (
    <div className={fullScreen ? "app app-full" : "app"}>
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
