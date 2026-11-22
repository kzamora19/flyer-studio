import test from "node:test";
import assert from "node:assert/strict";
import {studioSupabaseKey} from "../supabase/functions/_shared/studio-supabase-keys.mjs";

const env = values => name => values[name];
test("new Supabase named default secret key dictionary", () => {
  assert.equal(studioSupabaseKey(env({SUPABASE_SECRET_KEYS:JSON.stringify({default:"sb_secret_test_only"})}),"secret"),"sb_secret_test_only");
});
test("explicit and legacy secrets stay supported", () => {
  assert.equal(studioSupabaseKey(env({SUPABASE_SECRET_KEY:"direct_test",SUPABASE_SECRET_KEYS:"{}"}),"secret"),"direct_test");
  assert.equal(studioSupabaseKey(env({SUPABASE_SECRET_KEYS:"malformed",SUPABASE_SERVICE_ROLE_KEY:"legacy_test"}),"secret"),"legacy_test");
});
test("missing default key fails closed", () => {
  assert.equal(studioSupabaseKey(env({SUPABASE_SECRET_KEYS:"{}"}),"secret"),"");
  assert.equal(studioSupabaseKey(env({SUPABASE_SECRET_KEYS:'{"default":123}'}),"secret"),"");
});
