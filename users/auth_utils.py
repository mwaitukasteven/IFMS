"""
Authentication helpers ported from the ASSET side of the merge.

Login rules:
  - The login form accepts either a username or an email address
  - For a freshly registered user the initial password is their LAST NAME
    in capital letters, and must_change_password=True forces them to set a
    new password on first login
"""

from .models import User


def default_password_from_last_name(last_name):
    """First-login password = last name uppercased. Falls back to TENANT."""
    return (last_name or '').strip().upper() or 'TENANT'


def find_user_by_login(login_id):
    """Look up a user by username first, then by email. Case-insensitive."""
    login_id = (login_id or '').strip()
    if not login_id:
        return None
    user = User.objects.filter(username__iexact=login_id).first()
    if user:
        return user
    return User.objects.filter(email__iexact=login_id).first()


def authenticate_login(login_id, password):
    """Authenticate by username/email. Tolerates uppercase-surname passwords."""
    login_id = (login_id or '').strip()
    password = password or ''

    user = find_user_by_login(login_id)
    if not user:
        return None

    if user.check_password(password):
        return user

    upper_password = password.strip().upper()
    if upper_password != password and user.check_password(upper_password):
        return user

    if user.role == User.ROLE_TENANT:
        default_pwd = default_password_from_last_name(user.last_name)
        if upper_password == default_pwd and user.check_password(default_pwd):
            return user

    return None
