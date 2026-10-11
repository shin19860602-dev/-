import type { Customer } from "@prisma/client";

// 元カルテは非表示で保管する。両方に値がある項目は残すカルテを優先する。
export function mergedCustomerData(target: Customer, source: Customer) {
  const notes = [target.allergyNote, source.allergyNote].filter((note): note is string => !!note?.trim());
  return {
    kana: target.kana || source.kana,
    gender: target.gender || source.gender,
    birthday: target.birthday ?? source.birthday,
    phone: target.phone || source.phone,
    postalCode: target.postalCode || source.postalCode,
    address: target.address || source.address,
    primaryStaffId: target.primaryStaffId ?? source.primaryStaffId,
    tier: target.tier === "プレミアム会員" || source.tier === "プレミアム会員" ? "プレミアム会員" : target.tier,
    memberSince: target.memberSince && source.memberSince
      ? (target.memberSince < source.memberSince ? target.memberSince : source.memberSince)
      : target.memberSince ?? source.memberSince,
    allergyNote: [...new Set(notes)].join("\n") || null,
  };
}
