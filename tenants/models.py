from django.db import models
from users.models import User


class Tenant(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE
    )

    full_name = models.CharField(
        max_length=255
    )

    email = models.EmailField(
        unique=True
    )

    phone_number = models.CharField(
        max_length=20
    )

    address = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.full_name