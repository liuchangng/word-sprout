import { go, type Route } from "../lib/router";

// 直接存 Route 对象，避免 go({ page: it.page } as Route) 这种宽化断言
const ITEMS: { route: Route; label: string; icon: string }[] = [
  { route: { page: "today" }, label: "花园", icon: "🌱" },
  { route: { page: "garden" }, label: "花圃", icon: "🪴" },
  { route: { page: "me" }, label: "我的", icon: "🌼" },
];

export function Nav({ page }: { page: Route["page"] }) {
  return (
    <nav className="nav" aria-label="主导航">
      {ITEMS.map((it) => (
        <button
          key={it.route.page}
          type="button"
          className={page === it.route.page ? "nav-item is-active" : "nav-item"}
          aria-current={page === it.route.page ? "page" : undefined}
          onClick={() => go(it.route)}
        >
          <span aria-hidden="true">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
