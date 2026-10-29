import { useRef, useState } from "react";
import { parseBackup, serializeBackup, actions, useSave } from "../store/store";
import { Sheet } from "../ui/Sheet";
import { Toast } from "../ui/Toast";

export function Me() {
  const save = useSave((s) => s);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportFile = () => {
    const blob = new Blob([serializeBackup(save)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `word-sprout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    // 延迟撤销，避免浏览器取消下载
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setToast("备份已下载");
  };

  const importFile = async (file: File | undefined, target?: HTMLInputElement) => {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (result.ok) {
      actions.replace(result.save);
      setToast(`已导入 ${Object.keys(result.save.cards).length} 个词`);
    } else {
      setToast(result.error);
    }
    // 重置 input，允许再次导入同一文件时触发 change
    if (target) target.value = "";
  };

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">我的</p>
          <h1>小园丁的设置</h1>
        </div>
      </header>

      <section className="card">
        <h2>每天学几个</h2>
        <div className="choice-grid compact">
          {([5, 10, 15, 20] as const).map((g) => (
            <button key={g} type="button" className={save.settings.dailyGoal === g ? "choice is-on" : "choice"} onClick={() => actions.settings({ dailyGoal: g })}>{g} 个</button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>发音</h2>
        <div className="choice-grid compact">
          <button type="button" className={save.settings.accent === "uk" ? "choice is-on" : "choice"} onClick={() => actions.settings({ accent: "uk" })}>英式</button>
          <button type="button" className={save.settings.accent === "us" ? "choice is-on" : "choice"} onClick={() => actions.settings({ accent: "us" })}>美式</button>
        </div>
        <label className="range-row">
          语速
          <input type="range" min={0.7} max={1.2} step={0.05} value={save.settings.rate} onChange={(e) => actions.settings({ rate: Number(e.target.value) })} />
          <span className="muted">{save.settings.rate.toFixed(2)}</span>
        </label>
        <div className="choice-grid compact">
          <button type="button" className={save.settings.motion === "off" ? "choice is-on" : "choice"} onClick={() => actions.settings({ motion: save.settings.motion === "off" ? "system" : "off" })}>
            动效：{save.settings.motion === "off" ? "关闭" : "跟随系统"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>备份</h2>
        <p className="muted">进度只存在这台设备，换设备前先导出。</p>
        <button type="button" className="btn-primary wide" onClick={exportFile}>导出备份</button>
        <button type="button" className="btn-ghost wide" onClick={() => fileRef.current?.click()}>导入备份</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => importFile(e.target.files?.[0], e.target)}
        />
        <button
          type="button"
          className="btn-ghost wide danger"
          onClick={() => setConfirmOpen(true)}
        >
          清空进度
        </button>
      </section>

      <Sheet open={confirmOpen} title="清空学习进度" onClose={() => setConfirmOpen(false)}>
        <p className="muted">确定清空所有学习进度？这个操作不能撤销。</p>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost wide" onClick={() => setConfirmOpen(false)}>取消</button>
          <button
            type="button"
            className="btn-ghost wide danger"
            onClick={() => {
              actions.reset();
              setConfirmOpen(false);
              setToast("已清空");
            }}
          >
            清空
          </button>
        </div>
      </Sheet>

      <section className="card">
        <h2>关于</h2>
        <p className="muted">词表来自人教版 PEP 英语教材，仅供本地个人学习使用。图标来自 OpenMoji，许可 CC BY-SA 4.0。</p>
      </section>

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
