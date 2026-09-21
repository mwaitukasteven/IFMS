"""
ASSETS APP — Signals

When an AssetEvent is recorded, mirror it onto the Asset's status so
the rest of the system (lease officer, reports, dashboards) sees the
right availability without every caller having to compute it.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Asset, AssetEvent


# Event-type → asset status mapping.
# Only lifecycle events that CHANGE availability update the status.
# Revaluation and upgrade don't affect availability so we leave the
# current status alone.
EVENT_TO_STATUS = {
    AssetEvent.EVENT_DISPOSAL: Asset.STATUS_DISPOSED,
    AssetEvent.EVENT_TRANSFER: Asset.STATUS_TRANSFERRED,
    AssetEvent.EVENT_IMPAIRMENT: Asset.STATUS_IMPAIRED,
    AssetEvent.EVENT_MAINTENANCE: Asset.STATUS_MAINTENANCE,
}


@receiver(post_save, sender=AssetEvent)
def sync_asset_status_from_event(sender, instance, created, **kwargs):
    if not created:
        return
    new_status = EVENT_TO_STATUS.get(instance.event_type)
    if not new_status:
        return
    asset = instance.asset
    if asset.status == new_status:
        return
    asset.status = new_status
    asset.save(update_fields=['status', 'updated_at'])
