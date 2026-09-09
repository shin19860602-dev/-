// フルネーム（姓 名）からアバター表示用の1文字（名の先頭）を取り出す
export function givenNameInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const given = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return given.slice(0, 1) || "?";
}
