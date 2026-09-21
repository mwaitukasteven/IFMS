from django.apps import AppConfig


class IntegrationConfig(AppConfig):
    """
    Django app config for the integration module.

    Sets BigAutoField as default to match the project-wide setting.
    """

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'integration'
    verbose_name = 'Integration (External API)'
