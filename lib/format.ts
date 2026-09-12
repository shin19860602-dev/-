// フルネーム（姓 名）からアバター表示用の1文字（名の先頭）を取り出す
export function givenNameInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const given = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return given.slice(0, 1) || "?";
}

// 全角数字を半角に変換し、数字以外を取り除く（スマホの日本語入力で全角数字が入るケースへの対策）
export function sanitizeDigits(value: string): string {
  const halfWidth = value.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return halfWidth.replace(/[^0-9]/g, "");
}

// 金額入力欄のonChangeで使う共通ハンドラ。
// IME変換中（全角数字入力など）にvalueを書き換えると文字が二重に入力されるため、変換確定後だけ半角化する。
export function sanitizeAmountInput(e: { target: HTMLInputElement; nativeEvent: Event }) {
  if (e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing) return;
  e.target.value = sanitizeDigits(e.target.value);
}
