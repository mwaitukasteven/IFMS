"""
PROPERTIES APP — Models

After the merge, buildings are stored in `assets.Asset` (with
category='building'). This app only holds the *unit* concept —
sub-parcels of a building that can be leased separately (rooms,
floors, sections).

PropertyUnit.property → assets.Asset (limited to buildings).
"""

from django.db import models


class PropertyUnit(models.Model):
    property = models.ForeignKey(
        'assets.Asset',
        on_delete=models.CASCADE,
        related_name='units',
        limit_choices_to={'category': 'building'},
        help_text='The building (asset) this unit belongs to.',
    )
    unit_number = models.CharField(max_length=50)
    floor = models.CharField(max_length=50, blank=True, null=True)
    is_occupied = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.property.name} - {self.unit_number}"
