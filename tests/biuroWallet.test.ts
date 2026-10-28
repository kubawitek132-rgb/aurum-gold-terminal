import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chainLabel,
  formatWalletBalance,
  nativeSymbol,
  walletAccounts,
  walletChain,
  walletError,
} from "../src/lib/biuroWallet";

test("wallet data rejects malformed provider payloads", () => {
  assert.deepEqual(walletAccounts(["0x123", null, "0x" + "a".repeat(40)]), [
    "0x" + "a".repeat(40),
  ]);
  assert.deepEqual(walletAccounts({ address: "0x" + "a".repeat(40) }), []);
  assert.equal(walletChain("ethereum"), null);
  assert.equal(walletChain("0xAA36A7"), "0xaa36a7");
  assert.equal(formatWalletBalance("0xZZ"), null);
  assert.equal(formatWalletBalance("-1"), null);
});

test("wallet balance preserves integer precision and identifies native networks", () => {
  assert.equal(formatWalletBalance("0xde0b6b3a7640000"), "1.0000");
  assert.equal(formatWalletBalance("0x1"), "0.0000");
  assert.equal(formatWalletBalance("0x0"), "0.0000");
  assert.match(chainLabel("0xaa36a7"), /testnet/);
  assert.equal(nativeSymbol("0x89"), "POL");
  assert.equal(nativeSymbol("0x38"), "BNB");
  assert.equal(nativeSymbol("0x123"), "jedn. natywnych");
  assert.match(walletError({ code: 4001 }), /odrzucone/);
  assert.match(walletError({ code: -32002 }), /czeka/);
});
