from django.core.management.base import BaseCommand

from users.auth_utils import default_password_from_last_name
from users.models import User


class Command(BaseCommand):
    help = 'Reset tenant account passwords to default (surname in uppercase)'

    def handle(self, *args, **options):
        fixed = 0
        for user in User.objects.filter(role='tenant').order_by('username'):
            pwd = default_password_from_last_name(user.last_name)
            user.set_password(pwd)
            user.is_active = True
            user.must_change_password = True
            user.save()
            fixed += 1
            self.stdout.write(f'Reset {user.username} -> password: {pwd}')

        self.stdout.write(self.style.SUCCESS(f'Fixed {fixed} tenant login(s).'))
