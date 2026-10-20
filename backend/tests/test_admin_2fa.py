import pyotp

from app.models import User, UserRole


def test_admin_without_2fa_completed_cannot_reach_admin_routes(client, world):
    admin, ah = world.admin(with_2fa=False)
    assert client.get("/api/admin/sellers", headers=ah).status_code == 403
    assert client.get("/api/admin/payouts", headers=ah).status_code == 403


def test_enroll_confirm_and_login_requires_totp(client, world, db):
    admin, ah = world.admin(with_2fa=False)
    # still 403 on business routes until enrolled+confirmed
    assert client.get("/api/admin/sellers", headers=ah).status_code == 403

    enroll = client.post("/api/auth/admin/2fa/enroll", headers=ah).json()
    secret = enroll["secret"]
    assert "otpauth://" in enroll["otpauth_uri"]
    bad = client.post("/api/auth/admin/2fa/confirm", json={"code": "000000"}, headers=ah)
    assert bad.status_code == 400

    code = pyotp.TOTP(secret).now()
    confirm = client.post("/api/auth/admin/2fa/confirm", json={"code": code}, headers=ah)
    assert confirm.status_code == 200
    codes = confirm.json()["recovery_codes"]
    assert len(codes) == 8

    # a fresh login now challenges for a second factor
    login = client.post("/api/auth/login", json={"email": admin.email, "password": "correct-horse-battery"})
    assert login.status_code == 200 and login.json().get("mfa_required")
    mfa_token = login.json()["mfa_token"]
    assert client.post("/api/auth/admin/2fa/verify", json={"mfa_token": mfa_token, "code": "000000"}).status_code == 401
    ok = client.post("/api/auth/admin/2fa/verify", json={"mfa_token": mfa_token, "code": pyotp.TOTP(secret).now()})
    assert ok.status_code == 200
    headers = {"Authorization": f"Bearer {ok.json()['access_token']}"}
    assert client.get("/api/admin/sellers", headers=headers).status_code == 200


def test_enroll_is_idempotent_while_pending(client, world):
    admin, ah = world.admin(with_2fa=False)
    first = client.post("/api/auth/admin/2fa/enroll", headers=ah).json()
    second = client.post("/api/auth/admin/2fa/enroll", headers=ah).json()
    assert first["secret"] == second["secret"]  # re-clicking "start setup" must not invalidate it
    # confirming with a code from the (stable) secret still works
    confirm = client.post("/api/auth/admin/2fa/confirm", json={"code": pyotp.TOTP(second["secret"]).now()}, headers=ah)
    assert confirm.status_code == 200


def test_confirm_issues_a_session_that_can_reach_admin_routes_immediately(client, world):
    admin, ah = world.admin(with_2fa=False)
    secret = client.post("/api/auth/admin/2fa/enroll", headers=ah).json()["secret"]
    confirm = client.post("/api/auth/admin/2fa/confirm", json={"code": pyotp.TOTP(secret).now()}, headers=ah).json()
    assert confirm["access_token"] and len(confirm["recovery_codes"]) == 8
    fresh_headers = {"Authorization": f"Bearer {confirm['access_token']}"}
    assert client.get("/api/admin/sellers", headers=fresh_headers).status_code == 200
    # the stale pre-2FA token from world.admin() is no longer sufficient
    assert client.get("/api/admin/sellers", headers=ah).status_code == 403


def test_recovery_code_is_single_use(client, world, db):
    admin, ah = world.admin(with_2fa=False)
    secret = client.post("/api/auth/admin/2fa/enroll", headers=ah).json()["secret"]
    codes = client.post(
        "/api/auth/admin/2fa/confirm", json={"code": pyotp.TOTP(secret).now()}, headers=ah
    ).json()["recovery_codes"]
    login = client.post("/api/auth/login", json={"email": admin.email, "password": "correct-horse-battery"})
    mfa_token = login.json()["mfa_token"]
    first = client.post("/api/auth/admin/2fa/verify", json={"mfa_token": mfa_token, "code": codes[0]})
    assert first.status_code == 200
    login2 = client.post("/api/auth/login", json={"email": admin.email, "password": "correct-horse-battery"})
    second = client.post("/api/auth/admin/2fa/verify", json={"mfa_token": login2.json()["mfa_token"], "code": codes[0]})
    assert second.status_code == 401  # already used


def test_rate_limit_on_2fa_attempts(client, world):
    admin, ah = world.admin(with_2fa=False)
    secret = client.post("/api/auth/admin/2fa/enroll", headers=ah).json()["secret"]
    client.post("/api/auth/admin/2fa/confirm", json={"code": pyotp.TOTP(secret).now()}, headers=ah)
    from app.ratelimit import limiter

    limiter.enabled = True
    try:
        for _ in range(11):
            login = client.post("/api/auth/login", json={"email": admin.email, "password": "correct-horse-battery"})
            r = client.post("/api/auth/admin/2fa/verify", json={"mfa_token": login.json()["mfa_token"], "code": "000000"})
        assert r.status_code == 429
    finally:
        limiter.enabled = False
        limiter.reset()
