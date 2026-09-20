const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// サーバーの実行環境のタイムゾーン（Vercel等では通常UTC）に依存せず、
// 常に日本時間として解釈して日付を組み立てる。
//
// 日付フォーム欄（type="date"）は "YYYY-MM-DD" の日本時間カレンダー日を返すが、
// これに時刻（登録時刻や、編集時に元の時刻を引き継ぐ場合など）を組み合わせて
// `new Date(y, m, d, h, mi, s)` のようにローカルコンストラクタで組み立てると、
// サーバーの実行環境がUTCの場合、時刻部分だけUTCとして解釈されてズレてしまう
// （日本時間の深夜0時〜8時台に登録すると、翌日として保存される不具合の原因）。
//
// timeSource（時刻を引き継ぎたい基準のDate）を日本時間に変換して時:分:秒だけ取り出し、
// dateStr（日本時間の年月日）と組み合わせて、正しいUTC上のDateを作る。
export function jstDateWithTimeOf(dateStr: string, timeSource: Date): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`invalid date string: ${dateStr}`);

  const sourceJst = new Date(timeSource.getTime() + JST_OFFSET_MS);
  const hh = sourceJst.getUTCHours();
  const mi = sourceJst.getUTCMinutes();
  const ss = sourceJst.getUTCSeconds();

  const targetUtcMs = Date.UTC(y, m - 1, d, hh, mi, ss) - JST_OFFSET_MS;
  return new Date(targetUtcMs);
}

export type JstParts = {
  year: number;
  month: number; // 0-indexed（Dateのgetmonth()と同じ）
  date: number;
  hours: number;
  minutes: number;
  seconds: number;
  day: number; // 0=日曜
};

// 与えられたDate（省略時は現在時刻）を、サーバーの実行環境タイムゾーンに関係なく
// 常に日本時間として分解する。ダッシュボードの「本日」「今月」の判定や、
// 画面表示（日付・時刻ラベル）はこれを使う。
export function jstParts(d: Date = new Date()): JstParts {
  const shifted = new Date(d.getTime() + JST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    day: shifted.getUTCDay(),
  };
}

// 日本時間としてのY/M/D(/H/M/S)から、正しいUTC上のDateを作る。
// 月・日が範囲外（例: 13月、0日）でも自動的に繰り上げ・繰り下げされる
// （ネイティブの `new Date(y, m, d)` ローカルコンストラクタと同じ挙動）。
export function jstDate(year: number, month: number, date: number, hours = 0, minutes = 0, seconds = 0): Date {
  return new Date(Date.UTC(year, month, date, hours, minutes, seconds) - JST_OFFSET_MS);
}
