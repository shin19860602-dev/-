const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function Topbar({
  title,
  scopeLabel,
  roleLabel,
}: {
  title: string;
  scopeLabel: string;
  roleLabel: string;
}) {
  const now = new Date();
  const dateLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${WEEKDAYS[now.getDay()]}）`;

  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        <div className="date">
          {dateLabel}・表示範囲：{scopeLabel}
        </div>
      </div>
      <span className="badge badge-owner">{roleLabel}</span>
    </div>
  );
}
