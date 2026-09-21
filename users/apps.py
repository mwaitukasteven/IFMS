from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        # Register post_save signal that auto-creates a UserProfile.
        from . import signals  # noqa: F401
