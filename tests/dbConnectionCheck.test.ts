import assert from "node:assert/strict";
import test from "node:test";
import { checkDatabaseTarget, EXPECTED_PROJECT_REF } from "../lib/dbConnectionCheck";

test("直接接続とセッション・トランザクションプーラーの候補一致を判定する", () => {
  assert.equal(checkDatabaseTarget(`postgresql://postgres:fake@db.${EXPECTED_PROJECT_REF}.supabase.co:5432/postgres`), "matches_candidate");
  for (const port of [5432, 6543]) {
    assert.equal(checkDatabaseTarget(`postgres://postgres.${EXPECTED_PROJECT_REF}:fake@aws-0-ap-northeast-1.pooler.supabase.com:${port}/postgres?pgbouncer=true`), "matches_candidate");
  }
});

test("異なるSupabaseプロジェクトと独自ホストを区別する", () => {
  assert.equal(checkDatabaseTarget("postgresql://postgres:fake@db.otherref.supabase.co/postgres"), "different_target");
  assert.equal(checkDatabaseTarget("postgresql://postgres.otherref:fake@aws-0-ap-northeast-1.pooler.supabase.com/postgres"), "different_target");
  assert.equal(checkDatabaseTarget(`postgresql://postgres.${EXPECTED_PROJECT_REF}:fake@evil.pooler.supabase.com.example.org/postgres`), "unrecognized");
  assert.equal(checkDatabaseTarget("postgresql://custom:fake@custom.example.org/postgres"), "unrecognized");
});

test("欠落・不正入力でも秘密値や例外文を返さない", () => {
  assert.equal(checkDatabaseTarget(undefined), "missing");
  assert.equal(checkDatabaseTarget("not-a-url-test-secret"), "invalid");
  assert.equal(checkDatabaseTarget(`https://postgres:fake@db.${EXPECTED_PROJECT_REF}.supabase.co/postgres`), "invalid");
  assert.equal(checkDatabaseTarget(`postgresql://db.${EXPECTED_PROJECT_REF}.supabase.co/postgres`), "invalid");
});
