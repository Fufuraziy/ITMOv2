"""Regression tests for the vulnerabilities fixed in practice 6.

Each test asserts the hardened behaviour and fails against the original
vulnerable service.py.
"""

import unittest

from service import Shop


class SecurityTest(unittest.TestCase):
    def setUp(self):
        self.shop = Shop()
        self.addCleanup(self.shop.close)

    def request(self, method, path, body=None, headers=None):
        with self.shop.lock:
            return self.shop.dispatch(method, path, body or {}, headers or {})

    def login(self, username="alice", password="learn-alice"):
        status, result = self.request("POST", "/login", {"username": username, "password": password})
        self.assertEqual(status, 200)
        return {"X-Token": result["token"]}

    # --- authentication / authorization -----------------------------------

    def test_profile_requires_session(self):
        self.assertEqual(self.request("GET", "/profile?id=1")[0], 401)

    def test_customer_cannot_read_other_profile(self):
        self.assertEqual(self.request("GET", "/profile?id=2", headers=self.login())[0], 403)

    def test_orders_scoped_to_owner(self):
        status, orders = self.request("GET", "/orders", headers=self.login("bob", "learn-bob"))
        self.assertEqual(status, 200)
        self.assertTrue(all(o["owner"] == 2 for o in orders))

    def test_admin_export_ignores_spoofed_role_header(self):
        # A customer session with a forged X-Role header must not export profiles.
        auth = {**self.login(), "X-Role": "staff"}
        self.assertEqual(self.request("GET", "/admin/export", headers=auth)[0], 403)

    def test_search_is_staff_only(self):
        self.assertEqual(self.request("GET", "/search?q=TEST", headers=self.login())[0], 403)

    def test_debug_logs_staff_only_and_no_secrets(self):
        auth = self.login()
        self.assertEqual(self.request("GET", "/debug/logs", headers=auth)[0], 403)
        staff = {**self.login("staff", "learn-staff")}
        status, logs = self.request("GET", "/debug/logs", headers=staff)
        self.assertEqual(status, 200)
        blob = str(logs)
        self.assertNotIn("learn-alice", blob)
        self.assertNotIn(auth["X-Token"], blob)

    # --- injection ---------------------------------------------------------

    def test_profile_id_not_sql_injectable(self):
        # Classic "0 OR 1=1" dump attempt must not return every profile.
        status, rows = self.request("GET", "/profile?id=0 OR 1=1", headers=self.login())
        self.assertEqual(status, 400)

    def test_search_injection_contained(self):
        staff = self.login("staff", "learn-staff")
        status, rows = self.request("GET", "/search?q=%' OR '1'='1", headers=staff)
        self.assertEqual(status, 200)
        self.assertEqual(rows, [])  # the literal is matched, not interpreted

    # --- pricing -----------------------------------------------------------

    def test_price_override_ignored(self):
        status, order = self.request("POST", "/orders", {"product": "chair", "price": 1}, self.login())
        self.assertEqual(status, 201)
        self.assertEqual(order["price"], 5000)

    # --- file access / path traversal -------------------------------------

    def test_files_traversal_to_private_blocked(self):
        auth = self.login()
        status, _ = self.request("GET", "/files?user=../private&path=operator-note.txt", headers=auth)
        self.assertEqual(status, 403)

    def test_files_cannot_read_other_users_receipt(self):
        auth = self.login()
        self.assertEqual(self.request("GET", "/files?user=bob&path=receipt.txt", headers=auth)[0], 403)

    # --- assistant executor / prompt injection -----------------------------

    def test_execute_requires_session(self):
        status, _ = self.request("POST", "/assistant/execute",
                                 {"decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}})
        self.assertEqual(status, 401)

    def test_execute_read_file_enforces_ownership(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute",
                                 {"decision": {"tool": "read_file",
                                               "arguments": {"path": "files/bob/receipt.txt"}}}, auth)
        self.assertEqual(status, 403)

    def test_execute_read_private_blocked_for_customer(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute",
                                 {"decision": {"tool": "read_file",
                                               "arguments": {"path": "private/operator-note.txt"}}}, auth)
        self.assertEqual(status, 403)

    def test_execute_export_profiles_staff_only(self):
        auth = self.login()
        status, _ = self.request("POST", "/assistant/execute",
                                 {"decision": {"tool": "export_profiles"}}, auth)
        self.assertEqual(status, 403)

    def test_execute_delete_tree_forbidden(self):
        staff = self.login("staff", "learn-staff")
        status, _ = self.request("POST", "/assistant/execute",
                                 {"decision": {"tool": "delete_tree", "arguments": {"path": "."}}}, staff)
        self.assertEqual(status, 403)
        # Fixture files survive the injected deletion attempt.
        self.assertTrue((self.shop.sandbox.root / "files" / "alice" / "receipt.txt").exists())

    # --- stored XSS --------------------------------------------------------

    def test_reviews_view_requires_session(self):
        self.assertEqual(self.request("GET", "/reviews/view")[0], 401)

    def test_review_html_is_escaped(self):
        auth = self.login()
        self.request("POST", "/reviews", {"product": "chair", "text": "<script>alert(1)</script>"}, auth)
        html = self.request("GET", "/reviews/view", headers=auth)[1]
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)

    # --- error handling ----------------------------------------------------

    def test_assistant_context_scoped_to_owner(self):
        auth = self.login()
        self.assertEqual(self.request("GET", "/assistant/context?order_id=2", headers=auth)[0], 404)


if __name__ == "__main__":
    unittest.main()
