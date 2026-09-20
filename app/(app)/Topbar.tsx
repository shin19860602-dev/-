import { jstParts } from "@/lib/date";

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
  const now = jstParts();
  const dateLabel = `${now.year}年${now.month + 1}月${now.date}日（${WEEKDAYS[now.day]}）`;

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
